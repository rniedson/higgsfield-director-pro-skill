"""Fail closed on project files and local references in the shared repository.

This is a path and high-confidence content guard, not a substitute for reviewing
the meaning of a contribution before publishing it.
"""

import os
import re
import subprocess
from pathlib import Path, PurePosixPath

ROOT_FILES = {
    ".gitignore", "AGENTS.md", "CHANGELOG.md", "CLAUDE.md", "CONTRIBUTING.md", "LICENSE",
    "README.md", "README.pt-BR.md", "SECURITY.md", "install.sh",
}
TOP_LEVEL = {".github", "blocking-studio", "calibration", "docs", "examples", "higgsfield-director", "lessons-learned",
             "price-history", "tools", "website"}
SKILL_AREAS = {"agents", "data", "references", "scripts", "templates", "tests"}
PERSONAL_AREAS = {
    "artifact", "artifacts", "client", "clients", "customer", "customers",
    "output", "outputs", "personal", "private", "production", "productions",
    "project", "projects", "session", "sessions",
    # language-check: off  (the same folders under the Portuguese names an operator's workspace uses)
    "cliente", "clientes", "entrega", "entregas", "pessoal", "privado", "privados", "producao", "producoes",
    "produção", "produções", "projeto", "projetos", "saida", "saidas", "saída", "saídas", "sessao", "sessoes",
    "sessão", "sessões",
    # language-check: on
}
REVIEW_PAGES = {"review.html", "folha.html"}
MEDIA_SUFFIXES = {
    ".3gp", ".7z", ".aac", ".avi", ".avif", ".bmp", ".bz2", ".dng", ".exr", ".flac", ".flv", ".gif", ".gz",
    ".heic", ".heif", ".ico", ".jpeg", ".jpg", ".m4a", ".m4v", ".mkv", ".mov", ".mp3", ".mp4", ".mpeg", ".mpg",
    ".oga", ".ogg", ".opus", ".pdf", ".png", ".psd", ".rar", ".raw", ".svg", ".tar", ".tgz", ".tif", ".tiff",
    ".wav", ".webm", ".webp", ".wmv", ".xz", ".zip",
}
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", ".venv", "node_modules"}
PATH_FIXTURES = {"tools/public_boundary.py", "tools/tests/test_public_boundary.py"}
# At the skill's root: the skill itself, and the folder's guide for people reading it on GitHub.
SKILL_ROOT_FILES = {"higgsfield-director/SKILL.md", "higgsfield-director/README.md"}
# The README's demo, published by the maintainer's decision (2026-11-26): exactly these files, nothing beside them.
DEMO_MEDIA = {"docs/demo/kung-fu-vs-robot-clone.mp4", "docs/demo/kung-fu-vs-robot-clone.jpg",
              "docs/demo/how-it-was-made.jpg"}
SHARED_VISUALS = ("docs/manual/visual/assets/", "docs/manual/visual/atlas/", "docs/manual/visual/style/",
                  "docs/assets/")
TEST_EVIDENCE = ("lessons-learned/tests/", "examples/")
# The blocking studio's own pictures, by the maintainer's decision (2026-11-27): each character's design sheets and the
# images of the studio's guide. Still images only. Its models (.glb) are not media for this check.
BLOCKING_VISUALS = re.compile(r"blocking-studio/(?:assets/characters/[a-z0-9-]+/sheets|docs)/[^/]+$")
# A path of someone's machine: a home folder, a mounted volume, a temporary folder, a file:// link. A home folder
# written with a placeholder name in angle brackets, and a URL that happens to contain such a folder, pass.
LOCAL_PATH = re.compile(
    r"file://"
    r"|(?<![\w.~%-])/(?:Users|home)/(?!<)[^/\s<>\"'`)\]]+"
    r"|(?<![\w.~%-])/(?:root|Volumes/[^/\s]+|private/(?:var|tmp))/"
    r"|\b[A-Za-z]:(?:\\\\|\\|/)Users(?:\\\\|\\|/)", re.I)
# The first bytes of the formats a production leaves behind, whatever the file's extension says.
SIGNATURES = (
    (b"\xff\xd8\xff", ".jpg"), (b"\x89PNG\r\n\x1a\n", ".png"), (b"GIF87a", ".gif"), (b"GIF89a", ".gif"),
    (b"%PDF", ".pdf"), (b"PK\x03\x04", ".zip"), (b"\x1f\x8b", ".gz"), (b"7z\xbc\xaf\x27\x1c", ".7z"),
    (b"Rar!", ".rar"), (b"\x1a\x45\xdf\xa3", ".mkv"), (b"ID3", ".mp3"), (b"fLaC", ".flac"), (b"OggS", ".ogg"),
    (b"BM", ".bmp"), (b"II*\x00", ".tif"), (b"MM\x00*", ".tif"), (b"8BPS", ".psd"),
)
SAME_FORMAT = {".jpeg": ".jpg", ".tiff": ".tif", ".oga": ".ogg", ".opus": ".ogg", ".webm": ".mkv",
               ".m4v": ".mp4", ".mov": ".mp4", ".m4a": ".mp4", ".3gp": ".mp4", ".heif": ".heic", ".tgz": ".gz"}


def media_format(head):
    """The media format the first bytes of a file show (".mp4", ".png"...), or None for anything else."""
    for magic, fmt in SIGNATURES:
        if head.startswith(magic):
            return fmt
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        return ".heic" if brand in (b"heic", b"heix", b"mif1", b"msf1") else ".avif" if brand == b"avif" else ".mp4"
    if head[:4] == b"RIFF":
        return {b"WEBP": ".webp", b"WAVE": ".wav", b"AVI ": ".avi"}.get(head[8:12], ".riff")
    if head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xf1", b"\xff\xf9"):
        return ".mp3"
    return None


def _personal(part):
    """A folder named like a production's or a person's: the whole name, or one word of it (client-work)."""
    part = part.lower()
    return part in PERSONAL_AREAS or bool(set(re.split(r"[-_. ]+", part)) & PERSONAL_AREAS)


def check_public_path(path):
    """Return problems for a repository-relative file path."""
    rel = Path(path)
    parts = rel.parts
    name = rel.name
    problems = []
    if not parts or any(part in {".", ".."} for part in parts):
        return [f"{path}: invalid repository path"]
    if any(_personal(part) for part in parts[:-1]):
        problems.append(f"{path}: project or personal production directory belongs outside this repository")
    if name.lower() in REVIEW_PAGES:
        problems.append(f"{path}: production review page belongs in the operator's project")
    if len(parts) == 1:
        if name not in ROOT_FILES:
            problems.append(f"{path}: unreviewed top-level file; add only shared skill material")
    elif parts[0] not in TOP_LEVEL:
        problems.append(f"{path}: unreviewed top-level directory; project files stay outside this repository")
    elif parts[0] == "higgsfield-director" and parts[1] not in SKILL_AREAS and path not in SKILL_ROOT_FILES:
        problems.append(f"{path}: outside the shared skill's source areas")
    if rel.suffix.lower() in MEDIA_SUFFIXES and not _media_allowed(path, rel.suffix.lower()):
        problems.append(f"{path}: production media belongs outside this repository")
    return problems


def _media_allowed(path, suffix):
    if path in DEMO_MEDIA:
        return True
    if BLOCKING_VISUALS.match(path):
        return suffix in {".png", ".webp"}
    # The manual's own schematic images.
    if path.startswith(SHARED_VISUALS):
        return suffix in {".gif", ".png", ".svg"}
    # Frame sheets of the skill's own tests and the example references: generic scenes, still images only.
    return path.startswith(TEST_EVIDENCE) and suffix in {".jpg", ".png"}


def check_media_content(path, head):
    """A file whose bytes are media must carry its format's extension and sit where that media is allowed: a video
    renamed to .jpg, or saved with no extension or one outside the list, is refused."""
    fmt = media_format(head)
    if fmt is None:
        return []
    suffix = PurePosixPath(path).suffix.lower()
    if SAME_FORMAT.get(suffix, suffix) != fmt:
        return [f"{path}: the content is {fmt} media, not what its extension says"]
    return [] if _media_allowed(path, suffix) else [f"{path}: production media belongs outside this repository"]


def check_local_references(path, content):
    """Flag machine-specific paths in publishable text; URLs to public sites pass."""
    return [f"{path}: machine-specific file path belongs in the private project"] if LOCAL_PATH.search(content) else []


def published_files(root):
    """The repository-relative paths git would publish: tracked files plus new files that are not ignored. Outside a
    git checkout (an exported copy), every file except the version-control and cache folders."""
    root = Path(root)
    try:
        out = subprocess.run(["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                             capture_output=True, check=True).stdout
        names = {n for n in out.decode("utf-8", "surrogateescape").split("\0") if n}
    except (OSError, subprocess.CalledProcessError):
        names = {f.relative_to(root).as_posix() for f in root.rglob("*")
                 if not f.is_dir() and f.name != ".DS_Store"
                 and not any(part in SKIP_DIRS for part in f.relative_to(root).parts)}
    return sorted(n for n in names if os.path.lexists(root / n))


def check_public_boundary(root):
    """Inspect every publishable file in a repository checkout: its path, its first bytes, and any machine path in
    its text, or in the metadata of a binary file."""
    root = Path(root)
    problems = []
    for path in published_files(root):
        file = root / path
        problems.extend(check_public_path(path))
        if file.is_symlink():
            problems.append(f"{path}: a symbolic link publishes its target's path; commit the file itself")
            continue
        data = file.read_bytes()
        problems.extend(check_media_content(path, data[:16]))
        if path not in PATH_FIXTURES:
            problems.extend(check_local_references(path, data.decode("utf-8", errors="replace")
                                                   if b"\0" not in data[:8192] else data.decode("latin-1")))
    return list(dict.fromkeys(problems))
