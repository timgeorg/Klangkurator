#!/usr/bin/env python3
"""Deterministic gates for a `docs/requirements/` folder.

Checks the parts of [[Requirements-Standard]] that a script can decide: the
folder contract, requirement-block fields, the status vocabulary, ID
uniqueness, cross-reference integrity, and the diff-scoped rules that force a
requirement change and its changelog entry into the same change.

Advisory by default: prints findings and exits 0. Use --strict to exit 1 on
warnings, or rely on errors, which always exit 2.

Exit codes: 0 clean, 1 findings under --strict, 2 errors found, 3 usage error.

Design notes. The gate is stdlib-only and reads markdown, not a model of
markdown: a requirement block is a heading plus the lines until the next
heading of the same or higher rank. That is enough for a folder an agent
maintains, and it keeps the script one file with no dependencies.

Two parsers, not one. Real requirement folders arrive in one of two shapes:
`### PREFIX-n - Title` (Smartimize) and `### Title (REQ-13-CT; issue #46)`
(Klangkurator). Supporting both costs one regex and means the gate can be
adopted without a migration. `--id-style` makes a repo pick one and warns on
the other, so a repo can converge without a flag day.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

REQUIREMENTS_DIR = "docs/requirements"

CANONICAL_STATUS = ("Active", "Partial", "Done", "Proposed", "Deferred", "Rejected", "Superseded", "Obsolete")
CANONICAL_PRIORITY = ("P0", "P1", "P2", "P3")
ASSIGNED = ("Active", "Partial", "Done")

# The epistemic mark on a requirement's `Basis:` field.
#   V verified, N not yet researched, Q questionable, I inferred by the author.
# `Source:` is a different field with a different job: document provenance.
BASIS_MARKS = ("V", "N", "Q", "I")

# A status value may carry a dated note ("Done (PLAN-13, branch x)"). Only the
# leading word is the vocabulary item; the rest is the reader's context.
STATUS_WORD = re.compile(r"^\**\s*Status\s*:\s*\**\s*([A-Za-z]+)")

HEADING = re.compile(r"^(#{1,6})\s+(.*)$")

# The ID token: prefix segments, a number, and optional trailing segments.
# The trailing part matters — `REQ-33-SC` and `REQ-33-SV` are two sections of
# one domain, and truncating both to `REQ-33` invents thirteen duplicates.
ID_TOKEN = r"[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[a-z]?(?:-[A-Z0-9]+)*"

# `### COL-1 - Create collection` / `### DOC-NOTES-1 — ...`
ID_AT_START = re.compile(rf"^({ID_TOKEN})\b")

# `### Scan progress (REQ-10-SP, PF-86; built 2026-10-23)` — the ID is the token
# inside the parentheses that carries a `REQ-` prefix. Parenthesised groups that
# hold file numbers or issue numbers are provenance, not identity.
ID_IN_PARENS = re.compile(rf"\(\s*({ID_TOKEN})\b")

# Any requirement ID, wherever it appears in prose.
ANY_ID = re.compile(rf"\b({ID_TOKEN})\b")

# A table row that declares an ID: `| AX-1 | ... |` or `| NFR-1 | Quality | ... |`.
TABLE_DEFINITION = re.compile(rf"^\|\s*\**\s*({ID_TOKEN})\s*\**\s*\|")

# References that are not requirement IDs even though they match ANY_ID.
NON_REQUIREMENT_IDS = re.compile(
    r"^(SHA|MD5|ISO|IEC|IEEE|RFC|UTC|UTF|GB|MB|KB|TB|ADR|PM|PLAN|ISSUE|BC|WP|TBD|TBR)-\d+",
)

# Global-file ID prefixes: they are rows in a 9x file, not blocks in a domain.
GLOBAL_ID_PREFIXES = frozenset({"NFR", "INV", "PF", "ASM", "CON", "OOS", "AX", "PR"})

CHANGELOG = "99_CHANGELOG.md"
INDEX_NAMES = ("00_INDEX.md", "00_Index.md")

# A note that lives in the folder without being a requirement file: a split
# plan from before the folder contract, an audit record. The standard allows
# these; the gate only asks that the name says so.
SUPPORTING_NOTE = re.compile(r"(?i)(PLAN|AUDIT|NOTES|README|MIGRATION)")

# Prefix ranges from the folder contract. `00a`-style suffixes are rejected
# because "one number, one file" is the point.
RANGE_RULES = (
    (0, 0, "index"),
    (1, 2, "core"),
    (10, 19, "feature domain"),
    (20, 29, "data contract"),
    (30, 39, "architecture"),
    (90, 94, "global file"),
    (99, 99, "changelog"),
)

GLOBAL_FILES = {
    "90": "NFRS",
    "91": "INVARIANTS",
    "92": "PLANNED_FEATURES",
    "93": "OUT_OF_SCOPE",
    "94": "ASSUMPTIONS",
}

NFRS_KINDS = ("quality", "constraint")

DEFAULT_GATE_CONFIG = {
    "max_sentence_words": 25,
    # Adopting a gate on a folder that already has debt must not require fixing
    # everything first. `baseline` records the accepted count per code; the gate
    # fails when a count exceeds it, so existing debt is visible and frozen and
    # new debt is refused. Same shape as the code-standards gate.
    "baseline": {},
    "id_style": "either",
    "technology_patterns": [],
}


# --------------------------------------------------------------------------
# findings
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Finding:
    """One violation, addressed to a file and a line."""

    code: str
    path: str
    line: int
    message: str
    severity: str = "error"

    def as_dict(self) -> dict:
        """Machine-readable form."""
        return {
            "code": self.code,
            "path": self.path,
            "line": self.line,
            "severity": self.severity,
            "message": self.message,
        }

    def render(self, root: Path) -> str:
        """One greppable line, relative to the repo root."""
        try:
            rel = Path(self.path).relative_to(root)
        except ValueError:
            rel = Path(self.path)
        return f"{rel}:{self.line}: {self.code} [{self.severity}] {self.message}"


@dataclass
class Requirement:
    """A requirement block: its heading, its ID, its body, and its line span."""

    path: Path
    heading_line: int
    heading: str
    req_id: str
    style: str
    body: list[str] = field(default_factory=list)
    end_line: int = 0

    @property
    def body_text(self) -> str:
        """The block body as one string."""
        return "\n".join(self.body)

    def field_value(self, name: str) -> str | None:
        """First `Name: value` in the block, or None."""
        pattern = re.compile(rf"^\**\s*{re.escape(name)}\s*\**\s*:\s*\**\s*(.*)$", re.IGNORECASE)
        for line in self.body:
            match = pattern.match(line.strip())
            if match:
                return match.group(1).strip()
        return None


# --------------------------------------------------------------------------
# parsing
# --------------------------------------------------------------------------


def split_frontmatter(text: str) -> tuple[dict[str, str], list[str]]:
    """Return (frontmatter-ish key/value, body lines).

    Deliberately a line parser rather than a YAML import: the vault's YAML is
    flat lists and scalars, and a requirements file must not fail the gate
    because a full YAML parser dislikes a colon in a title.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, lines
    meta: dict[str, str] = {}
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return meta, lines[index + 1:]
        match = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", line)
        if match:
            meta[match.group(1)] = match.group(2).strip().strip('"').strip("'")
    return meta, lines


def classify_heading(text: str, id_style: str) -> tuple[str, str] | None:
    """Return (id, style) for a requirement heading, or None.

    style is "prefix" for `PREFIX-n - Title` and "parens" for
    `Title (REQ-13-CT; ...)`. `id_style` restricts which is accepted.

    The parenthesised form only counts when the ID carries the `REQ-` prefix.
    Without that rule every heading whose provenance list starts with a file
    number (`(02, 10, 13, 90; issue #1)`) would be read as requirement `02-10`.
    """
    start = ID_AT_START.match(text)
    if start and id_style in ("either", "prefix"):
        return start.group(1), "prefix"
    if id_style in ("either", "parens"):
        parens = ID_IN_PARENS.search(text)
        if parens and parens.group(1).startswith("REQ-"):
            return parens.group(1), "parens"
    return None


def parse_requirements(path: Path, id_style: str = "either") -> list[Requirement]:
    """Every requirement block in one file, in order."""
    _, body = split_frontmatter(path.read_text(encoding="utf-8", errors="replace"))
    blocks: list[Requirement] = []
    current: Requirement | None = None
    for number, line in enumerate(body, start=1):
        heading = HEADING.match(line)
        if heading:
            level = len(heading.group(1))
            if current is not None and level <= current_level:  # type: ignore[used-before-def]
                current.end_line = number - 1
                blocks.append(current)
                current = None
            if current is None:
                found = classify_heading(heading.group(2).strip(), id_style)
                if found:
                    req_id, style = found
                    current = Requirement(
                        path=path,
                        heading_line=number,
                        heading=heading.group(2).strip(),
                        req_id=req_id,
                        style=style,
                    )
                    current_level = level  # type: ignore[used-before-def]
                    continue
            if current is not None:
                current.body.append(line)
            continue
        if current is not None:
            current.body.append(line)
    if current is not None:
        current.end_line = len(body)
        blocks.append(current)
    return blocks


def split_sentences(text: str) -> list[str]:
    """Sentences for the length check; fenced code and tables are dropped."""
    out: list[str] = []
    in_fence = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or not stripped:
            continue
        if stripped.startswith("|") or stripped.startswith("#"):
            continue
        cleaned = re.sub(r"`[^`]*`", "", stripped)
        cleaned = re.sub(r"\[[^\]]*\]\([^)]*\)", "", cleaned)
        out.extend(part.strip() for part in re.split(r"(?<=[.!?])\s+", cleaned) if part.strip())
    return out


def word_count(sentence: str) -> int:
    """Words in a sentence, excluding markdown furniture."""
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’\-]*", sentence))


# --------------------------------------------------------------------------
# folder-level checks
# --------------------------------------------------------------------------


def prefix_of(name: str) -> str | None:
    """The leading numeric prefix of a requirements filename."""
    match = re.match(r"^(\d+)", name)
    return match.group(1) if match else None


def range_kind(prefix: int) -> str | None:
    """Which folder-contract range a numeric prefix belongs to."""
    for low, high, label in RANGE_RULES:
        if low <= prefix <= high:
            return label
    return None


def check_folder(folder: Path) -> tuple[list[Finding], dict]:
    """Contract checks that need the whole folder: ids, ranges, index, files."""
    findings: list[Finding] = []
    files = sorted(p for p in folder.glob("*.md") if p.is_file())

    if not files:
        return [Finding("REQ001", str(folder), 0, "no requirement files found")], {}

    # one number, one file
    seen: dict[str, list[str]] = {}
    for path in files:
        if path.name in INDEX_NAMES:
            # The index shares prefix `00` by construction with its twin; that
            # is REQ006's job, not a numbering collision.
            continue
        prefix = prefix_of(path.name)
        if prefix is None:
            # A supporting note (a split plan, an audit) has no address of its
            # own. The standard tolerates it; the gate only asks that the name
            # say so, so a requirements file never hides as one.
            if not SUPPORTING_NOTE.search(path.stem):
                findings.append(
                    Finding(
                        "REQ002",
                        str(path),
                        0,
                        "file has no numeric prefix and is not named as a supporting note "
                        "(PLAN, AUDIT, NOTES, README); the contract has no slot for it",
                        "warning",
                    )
                )
            continue
        seen.setdefault(prefix, []).append(path.name)
        numeric = int(re.match(r"\d+", prefix).group())
        if range_kind(numeric) is None:
            findings.append(
                Finding(
                    "REQ003",
                    str(path),
                    0,
                    f"prefix {prefix} is outside every contract range (00, 01-02, 10-19, 20-29, 30-39, 90-94, 99)",
                )
            )
    for prefix, names in sorted(seen.items()):
        if len(names) > 1:
            findings.append(
                Finding(
                    "REQ004",
                    str(folder / names[0]),
                    0,
                    f"prefix {prefix} is shared by {', '.join(names)}; one number, one file",
                )
            )

    # exactly one index
    indexes = [p for p in files if p.name in INDEX_NAMES]
    if not indexes:
        findings.append(Finding("REQ005", str(folder), 0, f"no index file ({' or '.join(INDEX_NAMES)})"))
    elif len(indexes) > 1:
        findings.append(
            Finding(
                "REQ006",
                str(folder),
                0,
                f"two index files ({', '.join(p.name for p in indexes)}); they will disagree",
            )
        )

    # every file is named in the index
    if len(indexes) == 1:
        index_text = indexes[0].read_text(encoding="utf-8", errors="replace")
        for path in files:
            if path.name in INDEX_NAMES:
                continue
            if path.name not in index_text:
                findings.append(
                    Finding("REQ007", str(indexes[0]), 0, f"{path.name} is not listed in the index")
                )

    # the changelog exists and carries a date heading
    changelog = folder / CHANGELOG
    if changelog not in files:
        findings.append(Finding("REQ008", str(folder), 0, f"{CHANGELOG} is missing; a spec with no history is not alive"))
    else:
        text = changelog.read_text(encoding="utf-8", errors="replace")
        if not re.search(r"(?m)^##\s+\d{4}-\d{2}-\d{2}", text):
            findings.append(
                Finding("REQ009", str(changelog), 0, "no `## YYYY-MM-DD` section; the changelog is not a date record")
            )

    # global files, when a repo carries the 90 range at all
    present = {prefix_of(p.name) for p in files}
    carries_global_range = any(p in GLOBAL_FILES for p in present if p)
    if carries_global_range:
        for prefix, stem in GLOBAL_FILES.items():
            if prefix not in present:
                findings.append(
                    Finding(
                        "REQ010",
                        str(folder),
                        0,
                        f"{prefix}_{stem}.md is missing; a repo with 90-range files carries the whole set",
                        severity="warning",
                    )
                )

    stats = {
        "files": len(files),
        "prefixes": sorted(seen),
        "supporting_notes": sorted(p.name for p in files if prefix_of(p.name) is None),
    }
    return findings, stats


# --------------------------------------------------------------------------
# per-requirement checks
# --------------------------------------------------------------------------


def check_requirement(req: Requirement, settings: dict) -> list[Finding]:
    """Field and vocabulary checks for one block."""
    findings: list[Finding] = []
    where = str(req.path)

    def add(code: str, message: str, severity: str = "error") -> None:
        findings.append(Finding(code, where, req.heading_line, message, severity))

    status_value = req.field_value("Status")
    if status_value is None:
        add("REQ020", f"{req.req_id} has no `Status:`")
    else:
        word_match = STATUS_WORD.match(f"Status: {status_value}")
        word = word_match.group(1) if word_match else status_value.split()[0] if status_value.split() else ""
        canonical = [s.lower() for s in CANONICAL_STATUS]
        if word.lower() not in canonical:
            add(
                "REQ021",
                f"{req.req_id} status '{word}' is not in the closed set ({', '.join(CANONICAL_STATUS)})",
            )

    priority = req.field_value("Priority")
    if priority is None:
        add("REQ022", f"{req.req_id} has no `Priority:`")
    elif priority.split()[0] not in CANONICAL_PRIORITY:
        add(
            "REQ023",
            f"{req.req_id} priority '{priority.split()[0]}' is not one of {', '.join(CANONICAL_PRIORITY)}",
        )

    basis = req.field_value("Basis")
    if basis is None:
        # A requirement written before the Basis field existed still carries its
        # provenance in `Source:`. Accept that as the mark's home rather than
        # demanding both, so the 2026-11-03 split needs no migration.
        legacy = req.field_value("Source") or ""
        if legacy.strip().lstrip("*").strip()[:1].upper() in BASIS_MARKS:
            basis = legacy
    if basis is None:
        severity = "warning"
        add("REQ024", f"{req.req_id} has no `Basis:` mark (V / N / Q / I)", severity)
    else:
        mark = basis.strip().lstrip("*").strip()[:1].upper()
        if mark not in BASIS_MARKS:
            add(
                "REQ025",
                f"{req.req_id} Basis '{basis[:40]}' does not start with one of {', '.join(BASIS_MARKS)}",
            )
        elif mark in ("N", "Q", "I") and len(basis.strip()) < 12:
            add(
                "REQ026",
                f"{req.req_id} is marked {mark} with no stated reason; an unmarked doubt is a to-do list with no item",
            )

    if not re.search(r"(?mi)^\s*(?:[-*]\s*)?\**\s*(?:VC|AC)\d+\s*\**\s*[:.)]", req.body_text):
        add("REQ027", f"{req.req_id} has no verification criterion (VC1 or AC1)")

    # Wordiness is advisory: the asd-ste100 linter is the authority on wording,
    # and a requirements gate that fails on prose gets switched off.
    limit = settings.get("max_sentence_words", 25)
    for sentence in split_sentences(req.body_text):
        if word_count(sentence) > limit * 2:
            add(
                "REQ028",
                f"{req.req_id} has a {word_count(sentence)}-word sentence (limit {limit}); run asd-ste100",
                "warning",
            )
            break

    status_word = (status_value or "").split()[0] if status_value else ""
    if status_word in ASSIGNED and not req.field_value("Serves"):
        add(
            "REQ029",
            f"{req.req_id} is {status_word} but names no `Serves:` goal; a requirement that cannot name its parent is unnecessary or is itself a goal",
            "warning",
        )

    if req.style == "parens" and settings.get("id_style") == "prefix":
        add("REQ030", f"{req.req_id} uses the parenthesised ID style; this repo declares the prefix style", "warning")

    return findings

def check_global_tables(folder: Path) -> list[Finding]:
    """The two tables whose columns carry a meaning the gate can test."""
    findings: list[Finding] = []
    nfr = next(iter(sorted(folder.glob("90_*.md"))), None)
    if nfr is not None:
        text = nfr.read_text(encoding="utf-8", errors="replace")
        has_kind = any(re.search(r"\|\s*Kind\s*\|", line) for line in text.splitlines())
        if not has_kind:
            findings.append(
                Finding(
                    "REQ040",
                    str(nfr),
                    0,
                    "no `Kind` column; a quality requirement is graded and a constraint is a hard limit, and they validate differently",
                    "warning",
                )
            )
        else:
            for line in text.splitlines():
                row = re.match(r"^\|\s*(NFR-\d+)\s*\|\s*([A-Za-z]+)\s*\|", line)
                if row and row.group(2).lower() not in NFRS_KINDS:
                    findings.append(
                        Finding(
                            "REQ041",
                            str(nfr),
                            0,
                            f"{row.group(1)} Kind '{row.group(2)}' is not {' or '.join(NFRS_KINDS)}",
                        )
                    )

    assumptions = next(iter(sorted(folder.glob("94_*.md"))), None)
    if assumptions is not None:
        text = assumptions.read_text(encoding="utf-8", errors="replace")
        has_breaks = any(re.search(r"\|\s*Breaks if\s*\|", line, re.I) for line in text.splitlines())
        if not has_breaks:
            findings.append(
                Finding(
                    "REQ042",
                    str(assumptions),
                    0,
                    "no `Breaks if` column; an assumption with no break condition is decoration",
                )
            )
    return findings


def check_source_targets(folder: Path, root: Path) -> list[Finding]:
    """A file-level `Source:` that names a path should name one that exists.

    `Source:` is document provenance, so it is legitimate for it to point at a
    document that has since been split or renamed — but a pointer to a file that no
    longer exists at all is a dead end, and this was invisible in both repos: every
    `Source:` in Smartimize names `docs/REQUIREMENTS.md`, which the 2026-05-31 split
    deleted.

    Warning, not error. The provenance is still true; only its address rotted, and
    a build must not fail because a file moved two quarters ago.
    """
    findings: list[Finding] = []
    path_token = re.compile(r"`?((?:docs|src|test|scripts|\.github)/[A-Za-z0-9_./-]+)\.(md|py|ts|tsx|js|json|ya?ml)`?")
    for path in sorted(folder.glob("*.md")):
        if path.name in INDEX_NAMES:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1):
            stripped = line.strip()
            if not re.match(r"^\**\s*Source\s*\**\s*:", stripped, re.IGNORECASE):
                continue
            for match in path_token.finditer(stripped):
                target = root / f"{match.group(1)}.{match.group(2)}"
                if not target.exists():
                    findings.append(
                        Finding(
                            "REQ052",
                            str(path),
                            number,
                            f"Source names `{match.group(1)}.{match.group(2)}`, which does not exist; "
                            "the provenance is still true but its address is stale",
                            "warning",
                        )
                    )
    return findings


def check_id_style(folder: Path, pinned: str) -> list[Finding]:
    """Warn on headings written in the other style, when a repo has declared one.

    classify_heading only returns IDs in the accepted style, so the rejected
    style is invisible to the block parser. This pass looks for it directly,
    which is what lets a repo converge without a flag day.
    """
    if pinned not in ("prefix", "parens"):
        return []
    findings: list[Finding] = []
    for path in sorted(folder.glob("*.md")):
        if path.name in INDEX_NAMES:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1):
            heading = HEADING.match(line)
            if not heading:
                continue
            text = heading.group(2).strip()
            if pinned == "prefix" and not ID_AT_START.match(text):
                other = ID_IN_PARENS.search(text)
                if other and other.group(1).startswith("REQ-"):
                    findings.append(
                        Finding(
                            "REQ030",
                            str(path),
                            number,
                            f"{other.group(1)} uses the parenthesised style; this repo declares the prefix style",
                            "warning",
                        )
                    )
            elif pinned == "parens" and ID_AT_START.match(text):
                findings.append(
                    Finding(
                        "REQ030",
                        str(path),
                        number,
                        f"{ID_AT_START.match(text).group(1)} uses the prefix style; this repo declares the parenthesised style",
                        "warning",
                    )
                )
    return findings


# --------------------------------------------------------------------------
# cross-file checks
# --------------------------------------------------------------------------


def check_ids(requirements: Iterable[Requirement]) -> list[Finding]:
    """IDs are unique, and every referenced ID exists."""
    findings: list[Finding] = []
    by_id: dict[str, list[Requirement]] = {}
    for req in requirements:
        by_id.setdefault(req.req_id, []).append(req)
    for req_id, reqs in sorted(by_id.items()):
        if len(reqs) > 1:
            places = ", ".join(f"{r.path.name}:{r.heading_line}" for r in reqs)
            findings.append(
                Finding("REQ050", str(reqs[0].path), reqs[0].heading_line, f"{req_id} is defined {len(reqs)} times ({places})")
            )
    return findings


def defined_ids(folder: Path, requirements: Sequence[Requirement]) -> set[str]:
    """Every ID this folder defines: blocks, table rows, and index bullets.

    Three sources, because the two repos use all three. Smartimize defines
    requirements as `### COL-1` blocks. Klangkurator also defines section IDs
    inline (`## Scope (REQ-33-SC)`) and row IDs in tables (`| AX-1 | ...`).
    A reference to any of them is valid, so all three count.
    """
    defined = {req.req_id for req in requirements}
    for path in folder.glob("*.md"):
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            row = TABLE_DEFINITION.match(line.strip())
            if row:
                defined.add(row.group(1))
            if line.lstrip().startswith("#"):
                for match in ANY_ID.finditer(line):
                    defined.add(match.group(1))
    return defined


def check_references(folder: Path, defined: set[str]) -> list[Finding]:
    """Every requirement-shaped ID mentioned in prose exists.

    The changelog is exempt. It is a dated narrative written before IDs were
    stable, and a historical entry that quotes an old number is correct
    history, not a broken link. Auditing the past is not this gate's job.
    """
    findings: list[Finding] = []
    for path in sorted(folder.glob("*.md")):
        if path.name in INDEX_NAMES or path.name == CHANGELOG:
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1):
            if line.lstrip().startswith("#"):
                continue
            for match in ANY_ID.finditer(line):
                candidate = match.group(1)
                if candidate in defined:
                    continue
                if NON_REQUIREMENT_IDS.match(candidate):
                    continue
                prefix = candidate.rsplit("-", 1)[0]
                if prefix in GLOBAL_ID_PREFIXES or candidate.split("-")[0] in GLOBAL_ID_PREFIXES:
                    continue
                findings.append(
                    Finding("REQ051", str(path), number, f"reference to '{candidate}' which is not defined in this folder")
                )
    return findings


def check_technology_leak(requirements: Iterable[Requirement], patterns: Sequence[str]) -> list[Finding]:
    """Capability-only rule, as far as a word list can take it.

    Advisory by design. The rule has two licensed exceptions (a constraint and
    a plan decision) and no word list can tell them apart, so a hit is a
    question for the reviewer, not a failure.
    """
    if not patterns:
        return []
    joined = re.compile(r"\b(" + "|".join(re.escape(p) for p in patterns) + r")\b", re.IGNORECASE)
    findings: list[Finding] = []
    for req in requirements:
        for offset, line in enumerate(req.body, start=req.heading_line):
            if "CON-" in line or re.search(r"(?i)\bconstraint\b", line):
                continue
            match = joined.search(line)
            if match:
                findings.append(
                    Finding(
                        "REQ060",
                        str(req.path),
                        offset,
                        f"{req.req_id} names '{match.group(1)}'; either it is a constraint with a forcing reason, or it is a plan decision",
                        "warning",
                    )
                )
    return findings


# --------------------------------------------------------------------------
# diff-scoped checks
# --------------------------------------------------------------------------


def git(root: Path, *args: str) -> str:
    """Run git in `root` and return stdout, raising on failure."""
    result = subprocess.run(
        ["git", *args], cwd=root, check=True, capture_output=True, text=True
    )
    return result.stdout


def changed_files(root: Path, base: str | None, staged: bool) -> list[str]:
    """Paths changed relative to `base`, or staged, or in the working tree."""
    if base:
        out = git(root, "diff", "--name-only", f"{base}...HEAD")
    elif staged:
        out = git(root, "diff", "--name-only", "--cached")
    else:
        out = git(root, "diff", "--name-only", "HEAD")
    return [line.strip() for line in out.splitlines() if line.strip()]


def added_lines(root: Path, path: str, base: str | None, staged: bool) -> list[tuple[int, str]]:
    """(line number, text) for lines added to `path` in the current change."""
    if base:
        args = ("diff", "-U0", f"{base}...HEAD", "--", path)
    elif staged:
        args = ("diff", "-U0", "--cached", "--", path)
    else:
        args = ("diff", "-U0", "HEAD", "--", path)
    out = git(root, *args)
    added: list[tuple[int, str]] = []
    new_line = 0
    for line in out.splitlines():
        header = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", line)
        if header:
            new_line = int(header.group(1))
            continue
        if line.startswith("+") and not line.startswith("+++"):
            added.append((new_line, line[1:]))
            new_line += 1
        elif line.startswith("-") or line.startswith("---"):
            continue
    return added


def check_same_change(root: Path, folder: Path, base: str | None, staged: bool) -> list[Finding]:
    """A touched requirement file must touch the changelog in the same change.

    This is the rule the whole scheme rests on, and it is the only one a
    reviewer reliably forgets. It is diff-scoped so it never fires on an audit.
    """
    try:
        changed = changed_files(root, base, staged)
    except (subprocess.CalledProcessError, OSError):
        return []
    try:
        folder_rel = folder.relative_to(root).as_posix()
    except ValueError:
        return []
    touched = [
        p
        for p in changed
        if p.startswith(folder_rel + "/") and p.endswith(".md") and not p.endswith(CHANGELOG)
    ]
    if not touched:
        return []
    if any(p.endswith(f"{folder_rel}/{CHANGELOG}") for p in changed):
        return []
    return [
        Finding(
            "REQ070",
            str(folder / CHANGELOG),
            0,
            f"{len(touched)} requirement file(s) changed without {CHANGELOG}; a change and its reason belong in the same change",
        )
    ]


def check_changelog_names_ids(
    root: Path, folder: Path, defined: set[str], base: str | None, staged: bool
) -> list[Finding]:
    """Changelog lines added in this change must name at least one ID somewhere.

    One finding per change, not per line: a changelog section is a narrative and
    its IDs may sit in any of its paragraphs.
    """
    changelog = folder / CHANGELOG
    try:
        if not changelog.is_file():
            return []
        added = added_lines(root, str(changelog.relative_to(root)), base, staged)
    except (subprocess.CalledProcessError, ValueError, OSError):
        return []
    meaningful = [text for _, text in added if text.strip() and not text.strip().startswith("#")]
    if not meaningful:
        return []
    blob = "\n".join(meaningful)
    if ANY_ID.search(blob):
        return []
    return [
        Finding(
            "REQ071",
            str(changelog),
            added[0][0],
            "the changelog addition names no requirement ID; a change nobody can trace is a log line, not a decision",
            "warning",
        )
    ]


# --------------------------------------------------------------------------
# runner
# --------------------------------------------------------------------------


def load_config(root: Path, explicit: str | None) -> dict:
    """Gate config: explicit file, then `docs/requirements/.requirements-gate.json`."""
    config = dict(DEFAULT_GATE_CONFIG)
    candidates = []
    if explicit:
        candidates.append(Path(explicit))
    candidates.append(root / REQUIREMENTS_DIR / ".requirements-gate.json")
    for candidate in candidates:
        if candidate.is_file():
            try:
                loaded = json.loads(candidate.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"requirements-gate: bad config {candidate}: {exc}") from exc
            config.update(loaded)
            break
    return config


def resolve_folder(root: Path, explicit: str | None) -> Path:
    """The requirements folder, or an empty path when the repo has none."""
    folder = Path(explicit) if explicit else root / REQUIREMENTS_DIR
    return folder.resolve() if not Path(folder).is_absolute() else Path(folder)


def run(root: Path, folder: Path, settings: dict, args: argparse.Namespace) -> tuple[list[Finding], dict]:
    """All checks that apply to this invocation."""
    findings: list[Finding] = []
    stats: dict = {"folder": str(folder)}
    if not folder.is_dir():
        return findings, stats

    folder_findings, folder_stats = check_folder(folder)
    findings.extend(folder_findings)
    stats.update(folder_stats)

    id_style = settings.get("id_style", "either")
    requirements: list[Requirement] = []
    for path in sorted(folder.glob("*.md")):
        if path.name in INDEX_NAMES:
            continue
        requirements.extend(parse_requirements(path, id_style))
    stats["requirements"] = len(requirements)

    allowed = set(args.ignore.split(",")) if args.ignore else set()
    for req in requirements:
        findings.extend(f for f in check_requirement(req, settings) if f.code not in allowed)

    by_id: dict[str, Requirement] = {}
    for req in requirements:
        by_id.setdefault(req.req_id, req)
    for finding in check_ids(requirements):
        if finding.code not in allowed:
            findings.append(finding)
    defined = defined_ids(folder, requirements)
    findings.extend(f for f in check_references(folder, defined) if f.code not in allowed)
    findings.extend(f for f in check_global_tables(folder) if f.code not in allowed)
    findings.extend(f for f in check_id_style(folder, settings.get("id_style", "either")) if f.code not in allowed)
    findings.extend(f for f in check_source_targets(folder, root) if f.code not in allowed)
    findings.extend(
        f for f in check_technology_leak(requirements, settings.get("technology_patterns", [])) if f.code not in allowed
    )

    source_misses = sum(1 for f in findings if f.code == "REQ024")
    stats["source_missing"] = source_misses

    # Apply the baseline after every check has contributed, so one rule covers
    # all of them. A code at or below its recorded count is existing debt and
    # stays quiet; anything above it is new debt and fails.
    baseline = settings.get("baseline") or {}
    code_counts: dict[str, int] = {}
    for finding in findings:
        code_counts[finding.code] = code_counts.get(finding.code, 0) + 1
    kept: list[Finding] = []
    for finding in findings:
        allowed_for_code = baseline.get(finding.code, 0)
        if allowed_for_code and code_counts.get(finding.code, 0) <= allowed_for_code:
            code_counts[finding.code] -= 1
            continue
        kept.append(finding)
    stats["baseline"] = {k: v for k, v in baseline.items() if v}
    stats["suppressed"] = sum(v for v in baseline.values() if v) - sum(
        v for k, v in code_counts.items() if k in baseline
    )
    findings = kept
    stats["technology_hits"] = sum(1 for f in findings if f.code == "REQ060")

    if args.same_change:
        findings.extend(check_same_change(root, folder, args.base, args.staged))
        findings.extend(check_changelog_names_ids(root, folder, defined, args.base, args.staged))

    return findings, stats


def report(findings: Sequence[Finding], stats: dict, root: Path, as_json: bool, strict: bool) -> int:
    """Print the report and return the exit code."""
    errors = [f for f in findings if f.severity == "error"]
    warnings = [f for f in findings if f.severity == "warning"]
    if as_json:
        print(
            json.dumps(
                {
                    "stats": stats,
                    "findings": [f.as_dict() for f in findings],
                    "errors": len(errors),
                    "warnings": len(warnings),
                },
                indent=2,
            )
        )
    else:
        by_code: dict[str, list[Finding]] = {}
        for finding in findings:
            by_code.setdefault(finding.code, []).append(finding)
        for code in sorted(by_code):
            for finding in by_code[code]:
                print(finding.render(root))
        print(
            f"\n{stats.get('requirements', 0)} requirements in {stats.get('files', 0)} files, "
            f"{len(errors)} error(s), {len(warnings)} warning(s)"
        )
        if findings:
            print("Gate: run `_meta/Agents/skills/requirements/SKILL.md` for the procedure these codes enforce.")
    if errors:
        return 2
    if strict and warnings:
        return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Command line definition."""
    parser = argparse.ArgumentParser(
        prog="requirements-gate",
        description="Deterministic gates for docs/requirements/: folder contract, block fields, ID integrity, same-change rule.",
    )
    parser.add_argument("--root", help="repository root (default: git toplevel of the cwd, else cwd)")
    parser.add_argument("--folder", help=f"requirements folder (default: <root>/{REQUIREMENTS_DIR})")
    parser.add_argument("--base", help="git ref to diff against, e.g. origin/int")
    parser.add_argument("--staged", action="store_true", help="use the staged diff instead of the working tree")
    parser.add_argument(
        "--same-change",
        action="store_true",
        help="also require a touched requirement file to touch the changelog in the same change (diff-scoped)",
    )
    parser.add_argument("--config", help="path to a gate config JSON")
    parser.add_argument("--ignore", default="", help="comma-separated codes to skip, e.g. REQ024,REQ029")
    parser.add_argument("--id-style", choices=("either", "prefix", "parens"), help="heading style this repo uses")
    parser.add_argument("--strict", action="store_true", help="exit 1 on warnings too")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument(
        "--emit-baseline",
        action="store_true",
        help="print a `baseline` object for the current findings, to paste into .requirements-gate.json",
    )
    parser.add_argument(
        "--technology",
        default="",
        help="comma-separated words that suggest a technology leak, e.g. React,SQLite,FastAPI",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point."""
    args = build_parser().parse_args(list(argv) if argv is not None else sys.argv[1:])
    if args.root:
        root = Path(args.root).resolve()
    else:
        try:
            root = Path(git(Path.cwd(), "rev-parse", "--show-toplevel").strip())
        except (subprocess.CalledProcessError, OSError):
            root = Path.cwd().resolve()
    if not root.is_dir():
        print(f"requirements-gate: no such root: {root}", file=sys.stderr)
        return 3

    try:
        settings = load_config(root, args.config)
    except SystemExit as exc:
        print(exc, file=sys.stderr)
        return 3
    if args.id_style:
        settings["id_style"] = args.id_style
    if args.technology:
        settings["technology_patterns"] = [w.strip() for w in args.technology.split(",") if w.strip()]

    folder = resolve_folder(root, args.folder)
    if not folder.is_dir():
        # A repo that has not adopted the standard yet is not a failure.
        if args.json:
            print(json.dumps({"stats": {}, "findings": [], "errors": 0, "warnings": 0}, indent=2))
        else:
            print(f"requirements-gate: no requirements folder at {folder}; nothing to check")
        return 0

    if args.emit_baseline:
        # Count what the folder has today and print it as a config fragment.
        # Adoption is then one command plus a paste, which is the difference
        # between a gate that gets enabled and one that gets postponed.
        findings, _ = run(root, folder, {**settings, "baseline": {}}, args)
        counts: dict[str, int] = {}
        for finding in findings:
            counts[finding.code] = counts.get(finding.code, 0) + 1
        print(json.dumps({"baseline": dict(sorted(counts.items()))}, indent=2))
        return 0

    findings, stats = run(root, folder, settings, args)
    return report(findings, stats, root, args.json, args.strict)


if __name__ == "__main__":
    sys.exit(main())
