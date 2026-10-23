#!/usr/bin/env python3
"""
check_code_standards.py

Deterministic, diff-scoped gates for the rules that are otherwise only enforced
by review: docstrings, the logging standard, function size/complexity, and
"don't touch files outside the ticket".

Diff-scoped by default. Only code you actually changed is judged, so a repo with
legacy debt still passes while the next violation is blocked. Use --all for a
full audit.

Exit code 1 on any error (or on warnings with --strict), 0 otherwise.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from fnmatch import fnmatch
from pathlib import Path
from typing import Iterable, Sequence

SKIP_DIRS = {
    ".git", "venv", "__pycache__", "node_modules", "build", "dist",
    "out", ".next", ".pytest_cache", ".mypy_cache", ".ruff_cache", "site-packages",
}

# Tests are not production code; docs are not code at all.
DEFAULT_EXCLUDES = ["test/*", "tests/*", "test_*.py", "docs/*", "*.venv*", ".venv*"]

# A CLI whose stdout *is* its interface. Same exemption LOGGING.md LR-1 grants,
# expressed as a rule instead of a filename so a renamed copy keeps it.
DEFAULT_ALLOW = [
    "check_code_standards.py:STD001",
    "test_check_code_standards.py:STD001",
]

DEFAULT_MAX_COMPLEXITY = 12
DEFAULT_MAX_FUNCTION_LINES = 60

SEVERITY_ORDER = {"error": 0, "warning": 1}


@dataclass
class Finding:
    """One standards violation, located at a file and line."""

    code: str
    severity: str
    path: str
    line: int
    message: str
    scope: str = ""

    def as_dict(self) -> dict:
        """Serialise for `--json` consumers."""
        return {
            "code": self.code,
            "severity": self.severity,
            "path": self.path,
            "line": self.line,
            "message": self.message,
        }


@dataclass
class Settings:
    """Thresholds and filters for a run, from config or CLI flags."""

    max_complexity: int = DEFAULT_MAX_COMPLEXITY
    max_function_lines: int = DEFAULT_MAX_FUNCTION_LINES
    scope: list[str] = field(default_factory=list)
    ignored: set[str] = field(default_factory=set)
    exclude: list[str] = field(default_factory=lambda: list(DEFAULT_EXCLUDES))
    allow: list[str] = field(default_factory=lambda: list(DEFAULT_ALLOW))


def is_excluded(path: str, patterns: Sequence[str]) -> bool:
    """True when the path or its basename matches any skip pattern."""
    name = Path(path).name
    return any(
        fnmatch(path, pattern) or fnmatch(name, pattern)
        for pattern in patterns
    )


def is_allowed(finding: Finding, settings: Settings) -> bool:
    """True when a `glob:CODE` exception covers this finding."""
    for rule in settings.allow:
        pattern, _, code = rule.partition(":")
        if code.strip().upper() == finding.code and fnmatch(finding.path, pattern.strip()):
            return True
    return False


def is_skipped(path: str, settings: Settings) -> bool:
    """Skip vendored, generated and excluded paths."""
    parts = Path(path).parts
    if any(part in SKIP_DIRS or "venv" in part.lower() for part in parts):
        return True
    return is_excluded(path, settings.exclude)


# ---------------------------------------------------------------------------
# Diff discovery
# ---------------------------------------------------------------------------

def run_git(root: Path, *args: str) -> str:
    """Run a git command in `root` and return stdout, or raise on failure."""
    result = subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout


def repo_root(start: Path) -> Path:
    """Return the git toplevel for `start`, or `start` when it is not a repo."""
    try:
        return Path(run_git(start, "rev-parse", "--show-toplevel").strip())
    except (RuntimeError, OSError):
        return start


def changed_lines(root: Path, args: Sequence[str]) -> dict[str, set[int]]:
    """Map repo-relative path -> added line numbers in the requested diff.

    Removed lines are ignored on purpose: deleting code cannot introduce a new
    standards violation.

    Args:
        root (Path): Repository toplevel.
        args (Sequence[str]): git diff arguments.

    Returns:
        dict[str, set[int]]: Added line numbers per path.
    """
    diff = run_git(root, "diff", "--unified=0", "--no-color", "--no-ext-diff", *args)
    result: dict[str, set[int]] = {}
    current: str | None = None

    for raw in diff.splitlines():
        if raw.startswith("+++ "):
            target = raw[4:].strip()
            current = None if target == "/dev/null" else target.removeprefix("b/")
            if current is not None:
                result.setdefault(current, set())
            continue
        if not raw.startswith("@@") or current is None:
            continue
        match = re.search(r"\+(\d+)(?:,(\d+))?", raw)
        if not match:
            continue
        start = int(match.group(1))
        count = int(match.group(2) or 1)
        result[current].update(range(start, start + count))

    tracked = {path: lines for path, lines in result.items() if lines}
    tracked.update(untracked_files(root, args))
    return tracked


def untracked_files(root: Path, args: Sequence[str]) -> dict[str, set[int]]:
    """New files are part of the change even though they have no diff hunks."""
    if "--cached" in args:
        return {}
    listing = run_git(root, "ls-files", "--others", "--exclude-standard")
    return {path: set() for path in listing.splitlines() if path.endswith(".py")}


def baseline_ref(args: argparse.Namespace, root: Path) -> str | None:
    """The ref the change started from, used to tell legacy code from new code."""
    if args.rev_range:
        return args.rev_range.split("...")[0] or args.base
    return args.base if has_head(root) else None


def baseline_source(root: Path, path: str, ref: str | None) -> str | None:
    """Read the file as it was at `ref`; None when it did not exist."""
    if not ref:
        return None
    try:
        return run_git(root, "show", f"{ref}:{path}")
    except (RuntimeError, OSError):
        return None


def all_python_files(root: Path) -> dict[str, set[int]]:
    """Every Python file under `root` with no line filter (audit mode)."""
    found: dict[str, set[int]] = {}
    for path in root.rglob("*.py"):
        if any(part in SKIP_DIRS or "venv" in part.lower() for part in path.parts):
            continue
        found[str(path.relative_to(root))] = set()
    return found


# ---------------------------------------------------------------------------
# AST helpers
# ---------------------------------------------------------------------------

FUNCTION_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)
CONTAINER_NODES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)


def parse_source(source: str) -> ast.Module:
    """Parse Python source, tolerating a byte-order mark from git."""
    return ast.parse(source.lstrip("\ufeff"))


def iter_containers(tree: ast.AST) -> Iterable[ast.AST]:
    """Yield every function/class node, including nested ones."""
    for node in ast.walk(tree):
        if isinstance(node, CONTAINER_NODES):
            yield node


def node_span(node: ast.AST) -> tuple[int, int]:
    """Return the line span of a node, including decorators."""
    start = node.lineno
    first_decorator = getattr(node, "decorator_list", [])
    if first_decorator:
        start = min(d.lineno for d in first_decorator)
    return start, getattr(node, "end_lineno", node.lineno)


def is_touched(node: ast.AST, lines: set[int]) -> bool:
    """True when any changed line falls inside the node's span."""
    if not lines:
        return True
    start, end = node_span(node)
    return any(start <= line <= end for line in lines)


def qualified_name(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> str:
    """Best-effort dotted name for a nested definition."""
    parts = [getattr(node, "name", "<anonymous>")]
    parent = parents.get(node)
    while parent is not None:
        if isinstance(parent, CONTAINER_NODES):
            parts.append(getattr(parent, "name", "<anonymous>"))
        parent = parents.get(parent)
    return ".".join(reversed(parts))


def child_parent_map(tree: ast.AST) -> dict[ast.AST, ast.AST]:
    """Build a parent lookup for every node in the tree."""
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent
    return parents


def parameters(node: ast.AST) -> list[ast.arg]:
    """Return all declared parameters, without `self`/`cls`."""
    args = node.args
    params = [*args.posonlyargs, *args.args, *args.kwonlyargs]
    if args.vararg:
        params.append(args.vararg)
    if args.kwarg:
        params.append(args.kwarg)
    return [p for p in params if p.arg not in {"self", "cls"}]


def returns_value(node: ast.AST) -> bool:
    """True when the function either annotates or actually returns a value."""
    if node.returns is not None and not (
        isinstance(node.returns, ast.Constant) and node.returns.value is None
    ):
        return True
    for child in ast.walk(node):
        if isinstance(child, ast.Return) and child.value is not None:
            return True
    return False


def docstring_sections(doc: str) -> set[str]:
    """Return the Google-style section headers present in a docstring."""
    return {m.group(1) for m in re.finditer(r"^\s*(Args|Arguments|Returns|Yields|Raises|Attributes):", doc, re.M)}


def body_length(node: ast.AST) -> int:
    """Line count of a function body, excluding decorators."""
    return node_span(node)[1] - node.lineno + 1


class ComplexityCounter(ast.NodeVisitor):
    """Count decision points, without descending into nested definitions."""

    BRANCHES = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.ExceptHandler, ast.Assert, ast.IfExp)

    def __init__(self) -> None:
        self.score = 1

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """Do not count a nested function's branches against the outer one."""
        return

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """Same as the sync case."""
        return

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """Class bodies are not part of the surrounding function's flow."""
        return

    def generic_visit(self, node: ast.AST) -> None:
        """Add a point for each branch construct, then keep walking."""
        if isinstance(node, self.BRANCHES):
            self.score += 1
        elif isinstance(node, ast.BoolOp):
            self.score += len(node.values) - 1
        elif isinstance(node, ast.comprehension):
            self.score += 1 + len(node.ifs)
        elif isinstance(node, ast.match_case):
            self.score += 1
        super().generic_visit(node)


def complexity_of(node: ast.AST) -> int:
    """Cyclomatic complexity proxy for a single function."""
    counter = ComplexityCounter()
    for statement in getattr(node, "body", []):
        counter.visit(statement)
    return counter.score


# ---------------------------------------------------------------------------
# Standards checks
# ---------------------------------------------------------------------------

def check_module(path: str, tree: ast.Module) -> list[Finding]:
    """Every module carries a header describing its purpose."""
    if ast.get_docstring(tree):
        return []
    return [Finding("STD004", "error", path, 1, "module has no docstring header")]


def check_docstrings(
    path: str, tree: ast.AST, lines: set[int], parents: dict[ast.AST, ast.AST]
) -> list[Finding]:
    """Public definitions need a docstring with the sections their signature implies."""
    findings: list[Finding] = []

    for node in iter_containers(tree):
        if not is_touched(node, lines):
            continue
        name = qualified_name(node, parents)
        if name.split(".")[-1].startswith("_"):
            continue

        finding = docstring_finding(path, node, name)
        if finding is not None:
            findings.append(finding)

    return findings


def docstring_finding(path: str, node: ast.AST, name: str) -> Finding | None:
    """Judge one definition's docstring, or return None when it is fine."""
    doc = ast.get_docstring(node)

    if not doc:
        is_class = not isinstance(node, FUNCTION_NODES)
        return Finding(
            "STD009" if is_class else "STD003",
            "warning" if is_class else "error",
            path,
            node.lineno,
            f"public {type(node).__name__.lower()} '{name}' has no docstring",
            scope=name,
        )

    if not isinstance(node, FUNCTION_NODES) or len(doc.splitlines()) < 3:
        return None

    missing = missing_sections(node, doc)
    if not missing:
        return None

    return Finding(
        "STD005",
        "warning",
        path,
        node.lineno,
        f"'{name}' docstring is missing section(s): {', '.join(missing)}",
        scope=name,
    )


def missing_sections(node: ast.AST, doc: str) -> list[str]:
    """Sections the docstring owes based on the signature."""
    if not parameters(node):
        return []

    sections = docstring_sections(doc)
    missing: list[str] = []
    if not sections & {"Args", "Arguments"}:
        missing.append("Args")
    if returns_value(node) and not sections & {"Returns", "Yields"}:
        missing.append("Returns")
    return missing


def baseline_shapes(source: str | None) -> dict[str, tuple[int, int]]:
    """Map qualified name -> (complexity, length) for the pre-change version."""
    if not source:
        return {}
    try:
        tree = parse_source(source)
    except SyntaxError:
        return {}
    parents = child_parent_map(tree)
    return {
        qualified_name(node, parents): (complexity_of(node), body_length(node))
        for node in iter_containers(tree)
        if isinstance(node, FUNCTION_NODES)
    }


def check_sizes(
    path: str,
    tree: ast.AST,
    lines: set[int],
    settings: Settings,
    parents: dict[ast.AST, ast.AST],
    baseline: dict[str, tuple[int, int]] | None = None,
) -> list[Finding]:
    """Touched functions must stay under the complexity and length limits.

    A function that already broke the limit before the change is a warning, not
    an error. Otherwise legacy debt makes the gate unusable: any one-line fix in
    an old module would be blocked by a function the change did not create.

    Args:
        path (str): Repo-relative file path.
        tree (ast.AST): Parsed module.
        lines (set[int]): Changed line numbers; empty means the whole file.
        settings (Settings): Limits and filters.
        parents (dict): Parent lookup for qualified names.
        baseline (dict | None): Name -> (complexity, length) before the change.

    Returns:
        list[Finding]: Size violations.
    """
    findings: list[Finding] = []
    baseline = baseline or {}

    for node in iter_containers(tree):
        if not isinstance(node, FUNCTION_NODES) or not is_touched(node, lines):
            continue
        name = qualified_name(node, parents)
        was = baseline.get(name)
        findings += size_findings(path, node, name, settings, was)

    return findings


def size_findings(
    path: str, node: ast.AST, name: str, settings: Settings, was: tuple[int, int] | None
) -> list[Finding]:
    """Complexity and length findings for one function.

    Args:
        path (str): Repo-relative file path.
        node (ast.AST): The function node.
        name (str): Qualified name.
        settings (Settings): Limits in force.
        was (tuple[int, int] | None): (complexity, length) before the change.

    Returns:
        list[Finding]: Zero, one or two findings.
    """
    findings: list[Finding] = []

    complexity = complexity_of(node)
    if complexity > settings.max_complexity:
        preexisting = was is not None and was[0] >= complexity
        findings.append(Finding(
            "STD006",
            "warning" if preexisting else "error",
            path,
            node.lineno,
            f"'{name}' has complexity {complexity} (limit {settings.max_complexity})"
            + (f", pre-existing at {was[0]}; do not add branches" if preexisting else "; split it"),
        ))

    length = body_length(node)
    if length > settings.max_function_lines:
        preexisting = was is not None and was[1] >= length
        findings.append(Finding(
            "STD007",
            "warning",
            path,
            node.lineno,
            f"'{name}' is {length} lines (limit {settings.max_function_lines})"
            + (f", pre-existing at {was[1]}" if preexisting else "; check the abstraction level"),
        ))

    return findings


def is_print_call(node: ast.Call) -> bool:
    """True for a bare `print(...)` call."""
    return isinstance(node.func, ast.Name) and node.func.id == "print"


def is_bare_error_log(node: ast.Call) -> bool:
    """True for `logger.error(...)` that carries no traceback."""
    if not isinstance(node.func, ast.Attribute) or node.func.attr != "error":
        return False
    if any(keyword.arg == "exc_info" for keyword in node.keywords):
        return False
    return not any(isinstance(arg, ast.Name) and arg.id == "exc_info" for arg in node.args)


def check_logging(path: str, tree: ast.AST, lines: set[int], parents: dict[ast.AST, ast.AST]) -> list[Finding]:
    """No print(), and no ERROR log inside an except block without a traceback."""
    findings: list[Finding] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_touched(node, lines):
            continue

        if is_print_call(node):
            findings.append(Finding(
                "STD001", "error", path, node.lineno, "print() is forbidden; use the logger", scope=enclosing(node, parents)
            ))
        elif is_bare_error_log(node) and inside_except(node, parents):
            findings.append(Finding(
                "STD002", "error", path, node.lineno,
                "ERROR log inside an except block without exc_info; use logger.exception() or exc_info=True",
                scope=enclosing(node, parents),
            ))

    return findings


def enclosing(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> str:
    """Name of the function or class a node lives in, for baseline matching."""
    current = parents.get(node)
    while current is not None:
        if isinstance(current, CONTAINER_NODES):
            return qualified_name(current, parents)
        current = parents.get(current)
    return ""


def inside_except(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> bool:
    """Walk upwards until an except handler or a function boundary is found."""
    current = parents.get(node)
    while current is not None:
        if isinstance(current, ast.ExceptHandler):
            return True
        if isinstance(current, FUNCTION_NODES + (ast.ClassDef,)):
            return False
        current = parents.get(current)
    return False


def check_scope(path: str, settings: Settings) -> list[Finding]:
    """A change may only touch the files its ticket declares."""
    if not settings.scope:
        return []
    if any(fnmatch(path, pattern) for pattern in settings.scope):
        return []
    return [
        Finding(
            "STD008",
            "error",
            path,
            0,
            f"'{path}' is outside the declared scope ({', '.join(settings.scope)}); open a separate ticket",
        )
    ]


LEGACY_CODES = {"STD001", "STD002", "STD003", "STD004", "STD009"}


def run_checks(
    path: str, tree: ast.AST, lines: set[int], settings: Settings, parents: dict[ast.AST, ast.AST]
) -> list[Finding]:
    """Run the per-file checks that do not need the baseline."""
    findings = check_module(path, tree)
    findings += check_docstrings(path, tree, lines, parents)
    findings += check_logging(path, tree, lines, parents)
    return findings


def baseline_keys(source: str | None) -> set[tuple[str, str]]:
    """Violations that already existed, as (code, enclosing scope) pairs."""
    if not source:
        return set()
    try:
        tree = parse_source(source)
    except SyntaxError:
        return set()
    parents = child_parent_map(tree)
    legacy = Settings()
    found = run_checks("", tree, set(), legacy, parents)
    return {(f.code, f.scope) for f in found}


def mark_legacy(findings: list[Finding], known: set[tuple[str, str]]) -> list[Finding]:
    """Downgrade violations that were already there before the change.

    A file full of untouched legacy is not this change's problem. Only new
    violations stay errors, so the gate can be adopted on a repo that has debt.

    Args:
        findings (list[Finding]): Findings for the current file.
        known (set[tuple[str, str]]): (code, scope) pairs present before.

    Returns:
        list[Finding]: The same findings, downgraded where pre-existing.
    """
    for finding in findings:
        if finding.code in LEGACY_CODES and (finding.code, finding.scope) in known:
            finding.severity = "warning"
            finding.message += " (pre-existing)"
    return findings


def check_file(
    path: str,
    source: str,
    lines: set[int],
    settings: Settings,
    baseline_source: str | None = None,
) -> list[Finding]:
    """Run every check against one file, tolerating syntax errors."""
    try:
        tree = ast.parse(source.lstrip("\ufeff"), filename=path)
    except SyntaxError as exc:
        return [Finding("STD000", "error", path, exc.lineno or 0, f"cannot parse: {exc.msg}")]

    parents = child_parent_map(tree)
    findings = run_checks(path, tree, lines, settings, parents)
    findings += check_sizes(path, tree, lines, settings, parents, baseline_shapes(baseline_source))
    findings += check_scope(path, settings)
    return mark_legacy(findings, baseline_keys(baseline_source))


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def load_settings(root: Path, explicit: str | None) -> Settings:
    """Read settings from pyproject.toml or a JSON file, then CLI flags override."""
    settings = Settings()
    candidates = [Path(explicit)] if explicit else [
        root / ".code-standards.json",
        root / "pyproject.toml",
    ]

    for candidate in candidates:
        if not candidate.is_file():
            continue
        raw: dict = {}
        if candidate.suffix == ".json":
            raw = json.loads(candidate.read_text(encoding="utf-8-sig"))
        else:
            try:
                import tomllib
            except ModuleNotFoundError:
                continue
            data = tomllib.loads(candidate.read_text(encoding="utf-8-sig"))
            raw = data.get("tool", {}).get("code_standards", {})
            raw = raw.get("code_standards", raw)
        if not raw:
            continue
        settings.max_complexity = int(raw.get("max_complexity", settings.max_complexity))
        settings.max_function_lines = int(raw.get("max_function_lines", settings.max_function_lines))
        settings.scope = list(raw.get("scope", settings.scope))
        settings.ignored = set(raw.get("ignore", settings.ignored))
        if raw.get("exclude"):
            settings.exclude = list(raw["exclude"])
        settings.allow = list(raw.get("allow", settings.allow))
        break

    return settings


def read_scope_file(path: Path) -> list[str]:
    """Collect declared files from frontmatter `scope:` or a `## Files in scope` list."""
    text = path.read_text(encoding="utf-8-sig")
    patterns: list[str] = []

    front = re.match(r"^---\n(.*?)\n---", text, re.S)
    if front:
        block = re.search(r"^scope:\s*\n((?:\s*-\s*.+\n)+)", front.group(1), re.M)
        if block:
            patterns += [line.split("-", 1)[1].strip().strip("\"'") for line in block.group(1).splitlines()]

    section = re.search(r"^##\s+Files?\s+in\s+scope\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S | re.I)
    if section:
        patterns += re.findall(r"`([^`]+)`", section.group(1))

    return [p for p in patterns if p]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """Definition of the command line."""
    parser = argparse.ArgumentParser(
        description="Diff-scoped gates for docstrings, logging, function size and change scope.",
    )
    parser.add_argument("--root", help="repository root (default: git toplevel of the cwd)")
    parser.add_argument("--base", default="HEAD", help="git ref to diff against (default: HEAD)")
    parser.add_argument("--staged", action="store_true", help="check the staged diff instead of the working tree")
    parser.add_argument("--range", dest="rev_range", help="explicit git range, e.g. main...HEAD")
    parser.add_argument("--all", action="store_true", help="audit every Python file instead of only the diff")
    parser.add_argument("--scope-file", help="ticket file declaring the allowed files")
    parser.add_argument("--config", help="path to a JSON or pyproject-style config")
    parser.add_argument("--max-complexity", type=int)
    parser.add_argument("--max-function-lines", type=int)
    parser.add_argument("--ignore", default="", help="comma-separated codes to skip, e.g. STD005,STD007")
    parser.add_argument("--exclude", default="", help="comma-separated path globs to skip")
    parser.add_argument(
        "--allow",
        action="append",
        default=[],
        metavar="GLOB:CODE",
        help="per-file exception, e.g. --allow 'src/backend/debug_server.py:STD001' (repeatable)",
    )
    parser.add_argument("--strict", action="store_true", help="fail on warnings too")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--quiet", action="store_true", help="only print the summary")
    return parser.parse_args(argv)


def has_head(root: Path) -> bool:
    """False in a repository whose first commit has not happened yet."""
    try:
        run_git(root, "rev-parse", "--verify", "HEAD")
        return True
    except (RuntimeError, OSError):
        return False


def diff_args(args: argparse.Namespace, root: Path) -> list[str]:
    """Translate the CLI flags into git diff arguments."""
    if args.rev_range:
        return [args.rev_range]
    base = args.base if has_head(root) else None
    if args.staged:
        return ["--cached"] + ([base] if base else [])
    return [base] if base else ["--cached"]


def settings_from_args(args: argparse.Namespace, root: Path) -> Settings:
    """Load the repo config, then let CLI flags override it."""
    settings = load_settings(root, args.config)
    if args.max_complexity is not None:
        settings.max_complexity = args.max_complexity
    if args.max_function_lines is not None:
        settings.max_function_lines = args.max_function_lines
    if args.ignore:
        settings.ignored |= {code.strip().upper() for code in args.ignore.split(",") if code.strip()}
    if args.scope_file:
        settings.scope += read_scope_file(Path(args.scope_file))
    if args.exclude:
        settings.exclude += [part.strip() for part in args.exclude.split(",") if part.strip()]
    settings.allow += args.allow
    return settings


def collect_findings(
    root: Path, targets: dict[str, set[int]], settings: Settings, base: str | None, audit: bool
) -> tuple[list[Finding], int]:
    """Judge every target file and return the findings plus the file count."""
    findings: list[Finding] = []
    checked = 0

    for path, lines in sorted(targets.items()):
        source_path = root / path
        if not path.endswith(".py") or is_skipped(path, settings) or not source_path.is_file():
            continue
        checked += 1
        source = source_path.read_text(encoding="utf-8-sig", errors="replace")
        baseline = None if audit else baseline_source(root, path, base)
        findings += check_file(path, source, lines, settings, baseline)

    findings = [f for f in findings if f.code not in settings.ignored and not is_allowed(f, settings)]
    findings.sort(key=lambda f: (SEVERITY_ORDER[f.severity], f.path, f.line))
    return findings, checked


def print_findings(findings: list[Finding]) -> None:
    """One human-readable line per finding, then a blank line."""
    for finding in findings:
        location = f"{finding.path}:{finding.line}" if finding.line else finding.path
        print(f"{finding.severity.upper():<7} {finding.code}  {location}  {finding.message}")
    print()


def report(args: argparse.Namespace, root: Path, findings: list[Finding], checked: int) -> int:
    """Print the result in the requested format and return the exit code."""
    errors = sum(1 for f in findings if f.severity == "error")
    warnings = len(findings) - errors
    failed = errors > 0 or (args.strict and warnings > 0)

    if args.json:
        print(json.dumps(
            {
                "root": str(root),
                "files_checked": checked,
                "errors": errors,
                "warnings": warnings,
                "passed": not failed,
                "findings": [f.as_dict() for f in findings],
            },
            indent=2,
        ))
        return 1 if failed else 0

    if findings and not args.quiet:
        print_findings(findings)
    print(
        f"code-standards: {checked} file(s), {errors} error(s), {warnings} warning(s) "
        f"-> {'FAIL' if failed else 'PASS'}"
    )
    return 1 if failed else 0


def main(argv: Sequence[str] | None = None) -> int:
    """Run the checks and report."""
    args = parse_args(argv or sys.argv[1:])
    root = Path(args.root).resolve() if args.root else repo_root(Path.cwd())
    settings = settings_from_args(args, root)

    try:
        targets = all_python_files(root) if args.all else changed_lines(root, diff_args(args, root))
    except (RuntimeError, OSError) as exc:
        print(f"cannot read the diff: {exc}", file=sys.stderr)
        return 2

    findings, checked = collect_findings(root, targets, settings, baseline_ref(args, root), args.all)
    return report(args, root, findings, checked)


if __name__ == "__main__":
    sys.exit(main())
