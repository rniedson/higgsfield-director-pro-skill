"""Fail closed on project files and local references in the shared repository.

This is a path and high-confidence content guard, not a substitute for reviewing
the meaning of a contribution before publishing it.
"""

import re
from pathlib import Path

ROOT_FILES = {
    ".gitignore", "AGENTS.md", "CHANGELOG.md", "CLAUDE.md", "CONTRIBUTING.md", "LICENSE",
    "README.md", "README.pt-BR.md", "SECURITY.md",
}
TOP_LEVEL = {".github", "calibration", "docs", "examples", "higgsfield-director", "lessons-learned", "tools"}
SKILL_AREAS = {"agents", "data", "references", "scripts", "templates", "tests"}
PERSONAL_AREAS = {
    "artifact", "artifacts", "client", "clients", "customer", "customers",
    "output", "outputs", "personal", "private", "production", "productions",
    "project", "projects", "session", "sessions",
}
REVIEW_PAGES = {"review.html", "folha.html"}
MEDIA_SUFFIXES = {".gif", ".jpeg", ".jpg", ".mov", ".mp3", ".mp4", ".pdf",
                  ".png", ".svg", ".wav", ".webm", ".webp", ".zip"}
TEXT_SUFFIXES = {".md", ".py", ".json", ".yml", ".yaml", ".sh", ".txt",
                 ".svg", ".toml", ".cfg", ".html", ".css", ".js"}
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", ".venv", "node_modules"}
PATH_FIXTURES = {"tools/public_boundary.py", "tools/tests/test_public_boundary.py"}
# The README's demo, published by the maintainer's decision (2026-11-26): exactly these files, nothing beside them.
DEMO_MEDIA = {"docs/demo/kung-fu-vs-robot-clone.mp4", "docs/demo/kung-fu-vs-robot-clone.jpg",
              "docs/demo/how-it-was-made.jpg"}
LOCAL_PATH = re.compile(r"(?:file://|/Users/[^/\s]+/|/home/[^/\s]+/|[A-Za-z]:\\Users\\)")


def check_public_path(path):
    """Return problems for a repository-relative file path."""
    rel = Path(path)
    parts = rel.parts
    name = rel.name
    problems = []
    if not parts or any(part in {".", ".."} for part in parts):
        return [f"{path}: invalid repository path"]
    if any(part.lower() in PERSONAL_AREAS for part in parts[:-1]):
        problems.append(f"{path}: project or personal production directory belongs outside this repository")
    if name.lower() in REVIEW_PAGES:
        problems.append(f"{path}: production review page belongs in the operator's project")
    if len(parts) == 1:
        if name not in ROOT_FILES:
            problems.append(f"{path}: unreviewed top-level file; add only shared skill material")
    elif parts[0] not in TOP_LEVEL:
        problems.append(f"{path}: unreviewed top-level directory; project files stay outside this repository")
    elif parts[0] == "higgsfield-director" and parts[1] not in SKILL_AREAS and path != "higgsfield-director/SKILL.md":
        problems.append(f"{path}: outside the shared skill's source areas")
    if rel.suffix.lower() in MEDIA_SUFFIXES and path not in DEMO_MEDIA:
        shared_visual = path.startswith(("docs/manual/visual/assets/", "docs/manual/visual/atlas/",
                                         "docs/manual/visual/style/", "docs/assets/"))
        # Frame sheets of the skill's own tests: generic scenes, still images only, never video.
        test_evidence = path.startswith(("lessons-learned/tests/", "examples/")) \
            and rel.suffix.lower() in {".jpg", ".png"}
        if not test_evidence and (not shared_visual or rel.suffix.lower() not in {".gif", ".png", ".svg"}):
            problems.append(f"{path}: production media belongs outside this repository")
    return problems


def check_local_references(path, content):
    """Flag machine-specific paths in publishable text; URLs to public sites pass."""
    return [f"{path}: machine-specific file path belongs in the private project"] if LOCAL_PATH.search(content) else []


def check_public_boundary(root):
    """Inspect every publishable file in a repository checkout."""
    root = Path(root)
    problems = []
    for file in sorted(root.rglob("*")):
        rel = file.relative_to(root)
        if any(part in SKIP_DIRS for part in rel.parts) or not file.is_file():
            continue
        path = rel.as_posix()
        problems.extend(check_public_path(path))
        if file.suffix.lower() in TEXT_SUFFIXES and path not in PATH_FIXTURES:
            content = file.read_text(encoding="utf-8", errors="replace")
            problems.extend(check_local_references(path, content))
    return problems
