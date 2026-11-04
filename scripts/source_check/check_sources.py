#!/usr/bin/env python3
"""Check the external claims in markdown files against the pages they cite.

Two modes, because they answer different questions and cost different things:

  default   Inventory. Every URL in the folder, the claim it sits next to, and
            whether it is even checkable. Free, instant.
  --run     Send each checkable claim + URL to zenture and record the verdict.

Why the split. A requirements folder cites URLs for three different reasons, and
only one of them is a claim a checker can adjudicate:

  * A **download endpoint** ("Windows: OllamaSetup.exe from https://…") is a fact
    about where a file lives. Check it with HTTP, not with a semantic checker.
  * A **vendor's own marketing page** is the weakest possible source: the page
    will always agree with itself. A "supported" verdict there proves the vendor
    markets that way, not that the claim is true.
  * A **published specification** (a file format, a standard clause) is the case
    zenture was built for. That is the only one worth credits.

zenture needs the source as an `https` URL inside the artifact text. It cannot
take a file and it cannot take a bare URL alone, so a claim that cites a document
without a link is uncheckable no matter how much you want it checked.

Usage:
    python3 check_sources.py --root <repo>              # requirements folder + docs
    python3 check_sources.py --root <repo> --run        # check the checkable ones
    python3 check_sources.py --root <repo> --paths a.md b/  # explicit targets
    python3 check_sources.py --root <repo> --run --only lexicondj

The zenture call runs in the zenture venv (it needs that package and the stored
OAuth session), so `--run` re-executes itself under that interpreter.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

ZENTURE_VENV = Path.home() / ".local/share/zenture-mcp/venv/bin/python"
REQUIREMENTS_DIR = "docs/requirements"
DEFAULT_TARGETS = (REQUIREMENTS_DIR, "docs")
MAX_FILES = 400
SKIP_FILES = {"00_INDEX.md", "00_Index.md", "99_CHANGELOG.md"}

URL_RE = re.compile(r"https?://[^\s)\]>\"'`,]+")
LOOPBACK = re.compile(r"^https?://(127\.0\.0\.1|localhost|\[::1\])")

# A vendor's own site is not evidence about the vendor's product. Listed so the
# inventory says so out loud instead of quietly checking it.
VENDOR_SELF_DESCRIPTION = re.compile(
    r"(?i)(inspiration|competitor|alternative|compare|marketing|vendor|their (?:site|page))"
)

# A URL that lives inside a Superseded requirement is history, not a live claim.
SUPERSEDED = re.compile(r"(?m)^\s*\**Status\s*:\s*\**\s*(Superseded|Obsolete)\b")


@dataclass
class Citation:
    """One URL, the claim around it, and what kind of claim it is."""

    url: str
    file: str
    line: int
    context: list[str]
    requirement: str | None = None
    status: str | None = None
    kind: str = "unknown"
    reachable: int | None = None

    @property
    def checkable(self) -> bool:
        """Whether a semantic checker has anything to adjudicate."""
        return self.kind in ("specification", "vendor-claim") and not self.superseded

    @property
    def superseded(self) -> bool:
        """The requirement that cites this URL is no longer live."""
        return (self.status or "").startswith(("Superseded", "Obsolete"))

    def as_dict(self) -> dict:
        """Report row."""
        return {
            "url": self.url,
            "file": self.file,
            "line": self.line,
            "requirement": self.requirement,
            "status": self.status,
            "kind": self.kind,
            "checkable": self.checkable,
            "http": self.reachable,
        }


def blocks(lines: list[str]) -> list[tuple[int, int, str, str | None, str | None]]:
    """(start, end, heading, requirement_id, status) for every headed block."""
    out: list[tuple[int, int, str, str | None, str | None]] = []
    starts: list[tuple[int, int, str]] = []
    for i, line in enumerate(lines):
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            starts.append((i, len(m.group(1)), m.group(2).strip()))
    for n, (start, level, heading) in enumerate(starts):
        end = len(lines)
        for later, later_level, _ in starts[n + 1:]:
            if later_level <= level:
                end = later
                break
        body = "\n".join(lines[start:end])
        rid = None
        head = re.match(r"^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[a-z]?)\b", heading)
        if head:
            rid = head.group(1)
        else:
            paren = re.search(r"\(\s*(REQ-[A-Z0-9-]+)\b", heading)
            rid = paren.group(1) if paren else None
        sm = re.search(r"(?m)^\s*\**Status\s*:\s*\**\s*(.+)$", body)
        status = sm.group(1).strip() if sm else None
        out.append((start, end, heading, rid, status))
    return out


def enclosing_item(lines: list[str], index: int) -> list[str]:
    """The markdown list item or paragraph around `index`, as its own lines.

    A bullet may wrap over several lines (and often does: the second line is
    indented two spaces). Walking out from the line to the nearest blank line
    gives the whole item and nothing else, which is what the claim actually is.
    A fixed N-line window instead swallows neighbouring bullets, and a checker
    told that three claims are one claim will report all three.
    """
    start = index
    while start > 0 and lines[start - 1].strip():
        # Stop at a heading or a fence even without a blank line.
        if lines[start - 1].lstrip().startswith(("#", "```", "|")):
            break
        start -= 1
    end = index
    while end + 1 < len(lines) and lines[end + 1].strip():
        if lines[end + 1].lstrip().startswith(("#", "```", "|")):
            break
        end += 1
    item = [line for line in lines[start: end + 1]]
    # A recorded verdict is not part of the claim: feeding it back would ask the
    # checker to confirm its own earlier conclusion.
    for n, line in enumerate(item):
        if line.lstrip().startswith(("**Basis:", "Basis:")):
            item = item[:n]
            break
    # A run of items with no blank lines between them (a tight list) would still
    # span several bullets, so trim to the bullet that contains the index.
    bullets = [n for n, line in enumerate(item) if line.lstrip().startswith(("- ", "* "))]
    if len(bullets) > 1:
        local = index - start
        before = [b for b in bullets if b <= local]
        first = before[-1] if before else bullets[0]
        after = [b for b in bullets if b > first]
        last = after[0] if after else len(item)
        item = item[first:last]
    return item


def classify(url: str, context: str, in_vision: bool) -> str:
    """What kind of citation this is."""
    if LOOPBACK.match(url):
        return "loopback"
    if re.search(r"(?i)(download|\.exe|\.zip|install\.sh|releases?/)", url):
        return "download-endpoint"
    if in_vision or VENDOR_SELF_DESCRIPTION.search(context):
        return "vendor-claim"
    if re.search(r"(?i)(spec|format|schema|standard|rfc|iso|ieee|documentation|manual)", context):
        return "specification"
    return "unclassified"


def markdown_files(target: Path) -> list[Path]:
    """Markdown files under a folder or at a file path, bounded and skip-aware.

    The bound matters: run from a vault root this would otherwise walk tens of
    thousands of notes, and the rule is about the documents being written, not
    the whole archive. `MAX_FILES` keeps an accidental run cheap.
    """
    if target.is_file():
        return [target] if target.suffix == ".md" else []
    if not target.is_dir():
        return []
    out: list[Path] = []
    for path in sorted(target.rglob("*.md")):
        parts = set(path.parts)
        if parts & {"node_modules", ".git", "dist", "out", ".next", "build", ".venv"}:
            continue
        if path.name in SKIP_FILES:
            continue
        out.append(path)
        if len(out) >= MAX_FILES:
            break
    return out


def collect(folder: Path) -> list[Citation]:
    """Every URL under `folder`, with its block and the claim around it."""
    found: list[Citation] = []
    for path in markdown_files(folder):
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        spans = blocks(lines)
        in_vision = path.name.startswith("01_")
        for i, line in enumerate(lines):
            if line.lstrip().startswith("```"):
                continue
            for m in URL_RE.finditer(line):
                url = m.group(0).rstrip(".,;:")
                # The narrowest span that contains the line: a file-level header
                # contains every requirement, so taking the first match would
                # attribute every URL to the file instead of to its requirement.
                containing = [s for s in spans if s[0] <= i < s[1]]
                span = min(containing, key=lambda s: s[1] - s[0]) if containing else (
                    0, len(lines), "", None, None
                )
                # The claim is the *bullet* the URL sits in, not a window of N lines.
                # A fixed window swallowed the two neighbouring bullets of a list,
                # and zenture then reported them as unsupported claims in the same
                # answer. That is a false positive caused by the caller, and the
                # service was right about the text it was handed.
                item = enclosing_item(lines, i)
                context_lines = item or lines[max(0, i - 1): min(len(lines), i + 2)]
                citation = Citation(
                    url=url,
                    file=str(path),
                    line=i + 1,
                    context=context_lines,
                    requirement=span[3],
                    status=span[4],
                )
                citation.kind = classify(url, "\n".join(context_lines), in_vision)
                found.append(citation)
    return found


def head_check(urls: list[str], workers: int = 8) -> dict[str, int]:
    """HTTP status per URL, 0 on a transport error. Cheap liveness only.

    One `curl` per URL through a small thread pool. Serially, a dead host costs
    the full timeout and the next URL starts after it, which made a 17-link scan
    feel broken. Capped at 8: a document can cite thirty links and this must not
    look like a crawler.
    """

    def one(url: str) -> int:
        try:
            out = subprocess.run(
                ["curl", "-sS", "-o", "/dev/null", "-L", "-I", "-m", "12",
                 "-w", "%{http_code}", url],
                capture_output=True, text=True, timeout=20,
            )
            return int(out.stdout.strip() or 0)
        except (subprocess.SubprocessError, ValueError):
            return 0

    if not urls:
        return {}
    from concurrent.futures import ThreadPoolExecutor

    result: dict[str, int] = {}
    with ThreadPoolExecutor(max_workers=min(workers, len(urls))) as pool:
        for url, code in zip(urls, pool.map(one, urls)):
            result[url] = code
    return result


def build_artifact(citation: Citation) -> tuple[str, str]:
    """(task, artifact) for one zenture run.

    zenture's contract, from its own tool description, is: `task` is the work with
    its criteria, `artifact` is **one selected answer** to that work. The checker
    then asks "does this answer meet the task", not "is this URL good".

    So the task must *contain* the verdict demand, and the artifact must be the
    sentence that answers it. The first version of this function inverted them —
    it put the demand in the task and the claim, with no verdict, in the artifact.
    zenture correctly replied `revise: no verdict word in the answer`, twice. The
    lesson generalises: an evaluation service is only as good as the answer you
    hand it, and an answer that restates a claim has not evaluated anything.

    The source has to travel inside the artifact text as an `https` link, because
    the run takes no source list.
    """
    raw = " ".join(line.strip() for line in citation.context if line.strip())
    raw = re.sub(r"^[#\-\s]*", "", raw)
    raw = raw.replace("`", "")
    claim = raw[:600] or citation.url
    task = (
        "Check whether the cited web page supports this statement. "
        f"Statement: {claim} "
        f"Cited page: {citation.url} "
        "Answer with a verdict on the statement, using exactly one of: supported, "
        "contradicted, uncertain. Then quote the passage from the page that decides it. "
        "The cited page is the only permitted authority. If the page cannot be read, "
        "say uncertain and say why."
    )
    # The artifact is the answer under evaluation. It carries the claim and the
    # link; a run with no link ends in revise by design.
    artifact = (
        f"The statement '{claim}' is supported by {citation.url}, as stated on that page."
    )
    return task, artifact


async def zenture_check(pairs: list[tuple[Citation, str, str]]) -> list[dict]:
    """Run each (citation, task, artifact) through the hosted zenture transport.

    The zenture client exposes a transport object with `list_tools` / `call_tool`,
    not an MCP client session — see `zenture_mcp_bridge.py`, which forwards to it
    the same way. Talking to the transport directly avoids re-implementing the
    session handshake in a script that only needs two calls.
    """
    from zenture._auth.model import DEFAULT_ENDPOINT
    from zenture._auth.stored import open_stored_session
    from zenture._mcp.transport import open_streamable_http_transport

    def payload(result: object) -> dict:
        """Unwrap a tool result into a dict, whatever shape it arrived in."""
        content = getattr(result, "content", None) or []
        if not content:
            return {}
        text = getattr(content[0], "text", None)
        if text is None and isinstance(content[0], dict):
            text = content[0].get("text", "")
        try:
            return json.loads(text or "{}")
        except json.JSONDecodeError:
            return {"raw": (text or "")[:400]}

    out: list[dict] = []
    session_auth = open_stored_session(DEFAULT_ENDPOINT)
    try:
        async with open_streamable_http_transport(
            DEFAULT_ENDPOINT, session=session_auth, timeout=180.0
        ) as transport:
            for citation, task, artifact in pairs:
                started = await transport.call_tool(
                    "run",
                    {
                        "task": task,
                        "artifact": {"type": "text", "value": artifact},
                        "profile": "standard",
                        "wait_seconds": 30,
                    },
                    read_timeout_seconds=180.0,
                )
                first = payload(started)
                run_id = first.get("run_id") or first.get("id")
                verdict: dict = {
                    "url": citation.url,
                    "requirement": citation.requirement,
                    "run_id": run_id,
                    "status": first.get("status"),
                    "decision": first.get("acceptance_decision"),
                    "findings": [],
                }
                if run_id and verdict["decision"] in (None, "", "pending"):
                    read = await transport.call_tool(
                        "get_run",
                        {"run_id": run_id, "view": "full", "wait_seconds": 30},
                        read_timeout_seconds=180.0,
                    )
                    detail = payload(read)
                    verdict["decision"] = detail.get("acceptance_decision") or verdict["decision"]
                    verdict["status"] = detail.get("status") or verdict["status"]
                    for finding in detail.get("findings") or []:
                        verdict["findings"].append(
                            (finding.get("assessment"), (finding.get("statement") or "")[:200])
                        )
                out.append(verdict)
    finally:
        session_auth.close()
    return out


def render(citations: list[Citation]) -> None:
    """Human report."""
    if not citations:
        print("No external URLs in the requirements folder.")
        return
    order = {"specification": 0, "vendor-claim": 1, "unclassified": 2,
             "download-endpoint": 3, "loopback": 4}
    print(f"{len(citations)} citation(s) across {len({c.file for c in citations})} file(s)\n")
    for c in sorted(citations, key=lambda x: (order.get(x.kind, 9), x.file, x.line)):
        flag = "checkable" if c.checkable else "not checkable"
        extra = " [requirement superseded]" if c.superseded else ""
        print(f"  {c.kind:18} {flag:14} {c.url}{extra}")
        print(f"      {c.file}:{c.line}  {c.requirement or '(no requirement id)'}")
        print(f"      http {c.reachable}  claim: {' '.join(l.strip() for l in c.context if l.strip())[:150]}")
        print()
    checkable = [c for c in citations if c.checkable]
    print(f"Worth a semantic check: {len(checkable)} of {len(citations)}")
    for c in checkable:
        print(f"  - {c.url} ({c.requirement or c.file})")


def main(argv: list[str] | None = None) -> int:
    """Entry point. Re-executes in the zenture venv when --run is used."""
    parser = argparse.ArgumentParser(
        description="Inventory the external links in documents, and check the checkable claims."
    )
    parser.add_argument("--root", help="repository or vault root (default: cwd)")
    parser.add_argument(
        "--folder", help=f"one folder to scan (default: {', '.join(DEFAULT_TARGETS)})"
    )
    parser.add_argument(
        "--paths", nargs="+", help="explicit files or folders, relative to --root"
    )
    parser.add_argument("--run", action="store_true", help="send checkable claims to zenture")
    parser.add_argument("--only", help="substring filter on the URL")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve() if args.root else Path.cwd()
    if args.paths:
        targets = [root / p for p in args.paths]
    elif args.folder:
        targets = [root / args.folder]
    else:
        targets = [root / name for name in DEFAULT_TARGETS]
    targets = [t for t in targets if t.exists()]
    if not targets:
        print(f"nothing to scan under {root}", file=sys.stderr)
        return 2

    # `docs/requirements` sits inside `docs`, so the defaults would scan the same
    # file twice and report every finding in it twice. Dedupe on the resolved path.
    seen: set[Path] = set()
    citations: list[Citation] = []
    for target in targets:
        for path in markdown_files(target):
            if path in seen:
                continue
            seen.add(path)
            citations.extend(collect(path))
    if args.only:
        citations = [c for c in citations if args.only in c.url]
    liveness = head_check(sorted({c.url for c in citations}))
    for c in citations:
        c.reachable = liveness.get(c.url)

    if not args.run:
        if args.json:
            print(json.dumps([c.as_dict() for c in citations], indent=2))
        else:
            render(citations)
        return 0

    # The zenture package lives in its own venv; hand over rather than pretending
    # to import it from an interpreter that does not have it.
    if not os.environ.get("REQUIREMENTS_SOURCE_CHECK_IN_VENV"):
        if not ZENTURE_VENV.is_file():
            print(f"zenture venv missing: {ZENTURE_VENV}", file=sys.stderr)
            return 3
        env = dict(os.environ, REQUIREMENTS_SOURCE_CHECK_IN_VENV="1")
        return subprocess.call([str(ZENTURE_VENV), __file__, *sys.argv[1:]], env=env)

    pairs = []
    for c in citations:
        if c.checkable:
            task, artifact = build_artifact(c)
            pairs.append((c, task, artifact))
    if not pairs:
        print("Nothing checkable. Every URL is a loopback address, a download endpoint, "
              "or inside a superseded requirement.")
        return 0

    verdicts = asyncio.run(zenture_check(pairs))
    if args.json:
        print(json.dumps(verdicts, indent=2, default=str))
    else:
        print(f"{len(verdicts)} zenture run(s)\n")
        for v in verdicts:
            print(f"  {v['url']}")
            print(f"      requirement {v['requirement']}  run {v['run_id']}")
            print(f"      status {v['status']}  decision {v['decision']}")
            for assessment, statement in v.get("findings", [])[:4]:
                print(f"        [{assessment}] {statement}")
            print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
