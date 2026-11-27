#!/usr/bin/env python3
"""Checks the repository before publishing: skill format, JSON, links and anchors of the Markdown files, the
calibration records with their scoreboard in calibration/README.md (tools/aggregate_calibration.py), and that everything is in English
(file names and text; see "Everything in the repository is in English" in CONTRIBUTING.md).

Usage: python3 tools/check_repo.py [--require-yaml]
Exits with 0 if everything is right; 1 with the list of problems. It only reads files; it does not touch the network.
"""
import json
import re
import sys
from pathlib import Path

from public_boundary import check_public_boundary

ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / "higgsfield-director"
MARKDOWN = ["README.md", "README.pt-BR.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "AGENTS.md", "CLAUDE.md",
            "docs/RC3-EVALUATION.md", "docs/manual/README.md", "docs/manual/visual/README.md", "calibration/README.md",
            "docs/MIGRATION-6.md", "lessons-learned/README.md", "lessons-learned/2026-11-higgsfield-channel.md",
            "lessons-learned/2026-11-higgsfield-channel-2.md", "lessons-learned/2026-11-higgsfield-channel-3.md",
            "examples/references/README.md", "docs/demo/README.md",
            "examples/README.md", "docs/README.md", "tools/README.md", "higgsfield-director/README.md",
            "higgsfield-director/references/README.md", "higgsfield-director/scripts/README.md",
            "higgsfield-director/templates/README.md", "higgsfield-director/data/README.md",
            "higgsfield-director/tests/README.md",
            "lessons-learned/tests/README.md",
            "lessons-learned/tests/2026-11-25-timed-beats.md", "lessons-learned/tests/to-test.md",
            "lessons-learned/tests/2026-11-25-timed-beats-faithful.md"]

# Language check. README.pt-BR.md is the Portuguese translation of README.md; MIGRATION-6.md lists the old names.
# Anywhere else, Portuguese is allowed only between the lines "language-check: off" and "language-check: on".
LANGUAGE_EXEMPT = {"README.pt-BR.md", "docs/MIGRATION-6.md"}
TEXT_SUFFIXES = {".md", ".py", ".json", ".yml", ".yaml", ".sh", ".txt", ".svg", ".toml", ".cfg", ".html", ".css",
                 ".js"}
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", ".venv", "node_modules"}
# language-check: off  (the Portuguese this check looks for)
PT_LETTERS = re.compile(r"[ãõçÃÕÇ]")
MARKER = re.compile(r"^\s*(?:#|//|<!--)\s*language-check: (off|on)\b")
PT_WORDS = re.compile(r"\b(não|nao|que|para|uma|com|são|está|esta|este|essa|esse|isso|isto|pelo|pela|então|você|"
                      r"também|quando|sem|em|da|das|dos|mais|muito|ainda|aqui|pode|deve|foi|ser|ter|português|"
                      r"tomada|tomadas|quadro|ficha|modelo|operador|custo|gerar|depois|antes|onde|cada|sua|seu)\b", re.I)
PT_ACCENTS = re.compile(r"[áéíóúâêôà]")
# old Portuguese names that must not come back as file or folder names
PT_NAME_PARTS = {"fluxo", "vocabulario", "modelos", "conector", "qualidade", "modos", "calibracao", "preproducao",
                 "pesos", "projeto", "avaliacao", "calibrar", "checar", "agregar", "testes", "emblema", "roteiro",
                 "legendas", "tomadas", "pedidos", "chave", "cegos", "cega", "preferencias", "retrato", "croqui",
                 "croquis", "folha", "tomada", "teste", "sintetica", "quadro", "quadros", "recorte", "recortes"}
# language-check: on

try:
    import yaml
except ImportError:
    yaml = None


def slug(title):
    """Anchor in the GitHub style."""
    t = re.sub(r"<[^>]+>", "", title).strip().lower().replace("`", "")
    t = re.sub(r"[^\w\- ]", "", t)
    return t.replace(" ", "-")


def anchors(file):
    body = re.sub(r"```.*?```", "", file.read_text(encoding="utf-8"), flags=re.S)
    seen, out = {}, set()
    for title in re.findall(r"^#{1,6} (.+?)\s*$", body, re.M):
        s = slug(title)
        n = seen.get(s, 0)
        out.add(s if n == 0 else f"{s}-{n}")
        seen[s] = n + 1
    return out


def check_skill(problems, require_yaml):
    txt = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
    if not m:
        problems.append("SKILL.md: no frontmatter")
        return
    if yaml is None:
        if require_yaml:
            problems.append("PyYAML not installed (--require-yaml)")
        meta = dict(re.findall(r"^(\w+): (.*)$", m.group(1), re.M))
        meta = {k: v.strip('"') for k, v in meta.items()}
    else:
        try:
            meta = yaml.safe_load(m.group(1))
        except yaml.YAMLError as e:
            problems.append(f"SKILL.md: the frontmatter is not valid YAML: {e}")
            return
        try:
            yaml.safe_load((SKILL / "agents/openai.yaml").read_text(encoding="utf-8"))
        except yaml.YAMLError as e:
            problems.append(f"agents/openai.yaml: invalid YAML: {e}")
    if not isinstance(meta, dict) or meta.get("name") != SKILL.name:
        problems.append(f"SKILL.md: 'name' must be {SKILL.name}")
    desc = (meta or {}).get("description") if isinstance(meta, dict) else None
    if not isinstance(desc, str) or not desc.strip():
        problems.append("SKILL.md: empty 'description'")
    elif len(desc) > 1024:
        problems.append(f"SKILL.md: 'description' with {len(desc)} characters (at most 1024)")
    elif re.search(r"[<>]", desc):
        problems.append("SKILL.md: 'description' cannot have < or >")
    for ref in sorted((SKILL / "references").glob("*.md")):
        if ref.name == "README.md":  # the folder's guide for people reading it on GitHub, never loaded
            continue
        if f"references/{ref.name}" not in txt:
            problems.append(f"SKILL.md: references/{ref.name} is never cited, so it is never loaded")


def check_json(problems):
    for f in sorted(ROOT.rglob("*.json")):
        if ".git" in f.parts:
            continue
        try:
            json.loads(f.read_text(encoding="utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            problems.append(f"{f.relative_to(ROOT)}: invalid JSON: {e}")


def check_links(problems):
    cache = {}
    for name in MARKDOWN:
        f = ROOT / name
        if not f.exists():
            problems.append(f"{name}: does not exist")
            continue
        text = re.sub(r"```.*?```", "", f.read_text(encoding="utf-8"), flags=re.S)
        targets = re.findall(r"\]\(([^)\s]+)\)", text) + re.findall(r'(?:src|href)="([^"]+)"', text)
        for target in targets:
            if re.match(r"^[a-z]+:", target):
                continue
            path, _, frag = target.partition("#")
            dest = (f.parent / path).resolve() if path else f
            if not dest.exists():
                problems.append(f"{name}: broken link {target}")
                continue
            if frag and dest.suffix == ".md":
                if dest not in cache:
                    cache[dest] = anchors(dest)
                if frag not in cache[dest]:
                    problems.append(f"{name}: missing anchor {target}")


def portuguese(line):
    """True when a line reads as Portuguese: a letter only Portuguese uses (a or o with a tilde, c with a cedilla), two
    distinct common Portuguese words, or one of them next to an accented letter. An accented proper name alone passes.
    Link targets and URLs are ignored (an anchor of README.pt-BR.md is Portuguese by design), and so is the text of a
    link to README.pt-BR.md (the language switch names the language in Portuguese)."""
    line = re.sub(r"https?://\S+", "", line)
    line = re.sub(r"\[[^\]]*\]\((?:\.\./)*README\.pt-BR\.md[^)]*\)", "", line)
    line = re.sub(r"\]\([^)]*\)", "]", line)
    words = {w.lower() for w in PT_WORDS.findall(line)}
    return bool(PT_LETTERS.search(line)) or len(words) >= 2 or bool(words and PT_ACCENTS.search(line))


def check_language(problems):
    for f in sorted(ROOT.rglob("*")):
        rel = f.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        for part in rel.parts:
            pieces = set(re.split(r"[-_. ]", part.lower()))
            if PT_LETTERS.search(part) or re.search(r"[\u00e0-\u00fc]", part) or pieces & PT_NAME_PARTS:
                problems.append(f"{rel}: the name '{part}' is not in English")
                break
        if not f.is_file() or f.suffix not in TEXT_SUFFIXES or rel.as_posix() in LANGUAGE_EXEMPT:
            continue
        off = False
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            marker = MARKER.match(line)
            if marker:
                off = marker.group(1) == "off"
            elif not off and portuguese(line):
                problems.append(f"{rel}:{n}: text in Portuguese ({line.strip()[:60]!r})")
        if off:
            problems.append(f"{rel}: 'language-check: off' without a matching 'language-check: on'")


def main():
    require_yaml = "--require-yaml" in sys.argv[1:]
    problems = []
    check_skill(problems, require_yaml)
    check_json(problems)
    check_links(problems)
    check_language(problems)
    problems.extend(check_public_boundary(ROOT))
    sys.path.insert(0, str(ROOT / "tools"))
    import aggregate_calibration
    aggregate_calibration.check(problems)
    for p in problems:
        print(p)
    print(f"{len(problems)} problem(s)" if problems else "ok: skill, JSON, links, anchors, calibration, language and public/private boundary")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
