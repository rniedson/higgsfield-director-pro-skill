#!/usr/bin/env python3
"""Checks the repository before publishing: skill format, JSON, links and anchors of the Markdown files, the
calibration records with their scoreboard in calibration/README.md (tools/aggregate_calibration.py), and that everything is in English
(file names and text; see "Everything in the repository is in English" in CONTRIBUTING.md).

Usage: python3 tools/check_repo.py [--require-yaml]
Exits with 0 if everything is right; 1 with the list of problems. It only reads files; it does not touch the network.
"""
import json
import os
import re
import sys
from pathlib import Path

from public_boundary import check_public_boundary, published_files

ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / "higgsfield-director"
PUBLISHED = published_files(ROOT)
# Every Markdown file git would publish has its links and anchors checked: no list to forget one in.
MARKDOWN = [p for p in PUBLISHED if p.lower().endswith(".md")]

# Language check. README.pt-BR.md is the Portuguese translation of README.md; MIGRATION-6.md lists the old names.
# Anywhere else, Portuguese is allowed only between the lines "language-check: off" and "language-check: on".
LANGUAGE_EXEMPT = {"README.pt-BR.md", "docs/MIGRATION-6.md"}
TEXT_SUFFIXES = {".md", ".py", ".json", ".jsonl", ".yml", ".yaml", ".sh", ".txt", ".svg", ".toml", ".cfg", ".html",
                 ".css", ".js", ".csv", ".tsv", ".srt", ".vtt", ".ipynb"}
# language-check: off  (the Portuguese this check looks for)
PT_LETTERS = re.compile(r"[ãõçÃÕÇ]")
MARKER = re.compile(r"^\s*(?:#|//|<!--)\s*language-check: (off|on)\b")
PT_WORDS = re.compile(r"\b(não|nao|que|para|uma|com|são|está|esta|este|essa|esse|isso|isto|pelo|pela|então|você|"
                      r"também|quando|sem|em|da|das|dos|mais|muito|ainda|aqui|pode|deve|foi|ser|ter|português|"
                      r"tomada|tomadas|quadro|ficha|modelo|operador|custo|gerar|depois|antes|onde|cada|sua|seu|na|nas|"
                      r"nos|num|numa|ao|aos|pelos|pelas|como|mas|porque|assim|agora|também|até|entre|cena|cenas|"
                      r"plano|corte|roteiro|cliente|abrir|abre|personagem|costas|corredor|geral|praia|vídeo|"
                      r"imagem|luz|câmera|camera_lenta)\b", re.I)
# English words borrowed with an accent or a cedilla, and names, that are not Portuguese
LOANWORDS = re.compile(r"\b(?:façades?|cafés?|clichés?|résumés?|naïve|déjà|fiancée?|protégée?|rosé|soufflé|"
                       r"touché|vis-à-vis|à la|da Vinci|de facto)\b", re.I)
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
        else:
            print("note: PyYAML is not installed, so the frontmatter was read by pattern only; CI reads it as YAML "
                  "(pip install pyyaml to do the same here)")
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
    for f in (ROOT / p for p in PUBLISHED if p.lower().endswith(".json")):
        try:
            json.loads(f.read_text(encoding="utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            problems.append(f"{f.relative_to(ROOT)}: invalid JSON: {e}")


def link_targets(text):
    """Inline links (with or without a title, or in angle brackets), reference definitions, and the src, href and
    poster attributes of HTML, quoted either way."""
    out = re.findall(r"\]\(\s*<([^>]+)>", text)
    out += re.findall(r"\]\(\s*([^)\s<]+)(?:\s+(?:\"[^\"]*\"|'[^']*'))?\s*\)", text)
    out += re.findall(r"^\s{0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?", text, re.M)
    out += re.findall(r"""(?:src|href|poster)\s*=\s*["']([^"']+)["']""", text)
    return [o for o in out if o]


def exists_exactly(path):
    """Exists with this exact spelling: on a case-insensitive disk, contributing.md would open CONTRIBUTING.md here
    and break on GitHub."""
    if not path.exists():
        return False
    rel = path.relative_to(ROOT.resolve())
    here = ROOT.resolve()
    for part in rel.parts:
        if part not in os.listdir(here):
            return False
        here = here / part
    return True


def check_links(problems):
    cache = {}
    for name in MARKDOWN:
        f = ROOT / name
        if f.is_symlink():
            continue  # the boundary check refuses it
        if not f.exists():
            problems.append(f"{name}: does not exist")
            continue
        text = re.sub(r"```.*?```", "", f.read_text(encoding="utf-8"), flags=re.S)
        text = re.sub(r"`[^`\n]*`", "", text)
        for target in link_targets(text):
            if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I):
                continue
            path, _, frag = target.partition("#")
            dest = (f.parent / path).resolve() if path else f
            if ROOT.resolve() not in dest.parents and dest != ROOT.resolve():
                problems.append(f"{name}: link leaves the repository {target}")
                continue
            if not exists_exactly(dest):
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
    line = LOANWORDS.sub("", re.sub(r"https?://\S+", "", line))
    line = re.sub(r"\[[^\]]*\]\((?:\.\./)*README\.pt-BR\.md[^)]*\)", "", line)
    line = re.sub(r"\]\([^)]*\)", "]", line)
    words = {w.lower() for w in PT_WORDS.findall(line)}
    return bool(PT_LETTERS.search(line)) or len(words) >= 2 or bool(words and PT_ACCENTS.search(line))


def check_language(problems):
    for name in PUBLISHED:
        f = ROOT / name
        rel = Path(name)
        for part in rel.parts:
            pieces = set(re.split(r"[-_. ]", part.lower()))
            if PT_LETTERS.search(part) or re.search(r"[\u00e0-\u00fc]", part) or pieces & PT_NAME_PARTS:
                problems.append(f"{rel}: the name '{part}' is not in English")
                break
        if f.is_symlink() or not f.is_file() or f.suffix.lower() not in TEXT_SUFFIXES or name in LANGUAGE_EXEMPT:
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

# The language line in the header of each README: the current language in bold, the others as links to their files.
# Written with escapes so that this file stays in English for check_language.
READMES = {"README.md": "English", "README.pt-BR.md": "Portugu\u00eas"}
HEADER_LINES = 40


def readme_language_problems(root):
    problems = []
    for name, lang in READMES.items():
        f = root / name
        if not f.is_file():
            problems.append(f"{name}: missing")
            continue
        head = f.read_text(encoding="utf-8", errors="replace").splitlines()[:HEADER_LINES]
        line = next((l for l in head if " \u00b7 " in l and all(x in l for x in READMES.values())), None)
        if line is None:
            problems.append(f"{name}: no language line naming {', '.join(READMES.values())} in its first {HEADER_LINES} lines")
            continue
        if f"**{lang}**" not in line or f"[{lang}]" in line:
            problems.append(f"{name}: the language line must show {lang}, the current language, in bold and without a link")
        for other_name, other in READMES.items():
            if other_name == name:
                continue
            m = re.search(r"\[" + re.escape(other) + r"\]\(([^)\s]+)\)", line)
            if not m:
                problems.append(f"{name}: the language line has no link to {other} ({other_name})")
            elif m.group(1) != other_name or not (root / m.group(1)).is_file():
                problems.append(f"{name}: the language line links {other} to {m.group(1)}, not to {other_name}")
    return problems


def main():
    require_yaml = "--require-yaml" in sys.argv[1:]
    problems = []
    check_skill(problems, require_yaml)
    check_json(problems)
    check_links(problems)
    check_language(problems)
    problems.extend(readme_language_problems(ROOT))
    problems.extend(check_public_boundary(ROOT))
    sys.path.insert(0, str(ROOT / "tools"))
    import aggregate_calibration
    aggregate_calibration.check(problems)
    import aggregate_prices
    aggregate_prices.check(problems)
    for p in problems:
        print(p)
    print(f"{len(problems)} problem(s)" if problems else "ok: skill, JSON, links, anchors, calibration, prices, language, README language links and public/private boundary")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
