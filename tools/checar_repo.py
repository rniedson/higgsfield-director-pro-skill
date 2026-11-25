#!/usr/bin/env python3
"""Confere o repositório antes de publicar: formato da skill, JSON, links e âncoras dos Markdown, e os registros de
calibração com o placar dos READMEs (tools/agregar_calibracao.py).

Uso: python3 tools/checar_repo.py [--exigir-yaml]
Sai com 0 se está tudo certo; 1 com a lista de problemas. Só lê arquivos; não acessa a rede.
"""
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SKILL = RAIZ / "higgsfield-director"
MARKDOWN = ["README.md", "README.pt-BR.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md",
            "docs/AVALIACAO-RC3.md", "docs/manual/README.md", "docs/manual/visual/README.md", "calibracao/README.md"]

try:
    import yaml
except ImportError:
    yaml = None


def slug(titulo):
    """Âncora no padrão do GitHub."""
    t = re.sub(r"<[^>]+>", "", titulo).strip().lower().replace("`", "")
    t = re.sub(r"[^\w\- ]", "", t)
    return t.replace(" ", "-")


def ancoras(arquivo):
    corpo = re.sub(r"```.*?```", "", arquivo.read_text(encoding="utf-8"), flags=re.S)
    vistas, saida = {}, set()
    for titulo in re.findall(r"^#{1,6} (.+?)\s*$", corpo, re.M):
        s = slug(titulo)
        n = vistas.get(s, 0)
        saida.add(s if n == 0 else f"{s}-{n}")
        vistas[s] = n + 1
    return saida


def checar_skill(problemas, exigir_yaml):
    txt = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
    if not m:
        problemas.append("SKILL.md: sem frontmatter")
        return
    if yaml is None:
        if exigir_yaml:
            problemas.append("PyYAML não instalado (--exigir-yaml)")
        meta = dict(re.findall(r"^(\w+): (.*)$", m.group(1), re.M))
        meta = {k: v.strip('"') for k, v in meta.items()}
    else:
        try:
            meta = yaml.safe_load(m.group(1))
        except yaml.YAMLError as e:
            problemas.append(f"SKILL.md: frontmatter não é YAML válido: {e}")
            return
        try:
            yaml.safe_load((SKILL / "agents/openai.yaml").read_text(encoding="utf-8"))
        except yaml.YAMLError as e:
            problemas.append(f"agents/openai.yaml: YAML inválido: {e}")
    if not isinstance(meta, dict) or meta.get("name") != SKILL.name:
        problemas.append(f"SKILL.md: 'name' deve ser {SKILL.name}")
    desc = (meta or {}).get("description") if isinstance(meta, dict) else None
    if not isinstance(desc, str) or not desc.strip():
        problemas.append("SKILL.md: 'description' vazia")
    elif len(desc) > 1024:
        problemas.append(f"SKILL.md: 'description' com {len(desc)} caracteres (máximo 1024)")
    elif re.search(r"[<>]", desc):
        problemas.append("SKILL.md: 'description' não pode ter < ou >")


def checar_json(problemas):
    for arq in sorted(RAIZ.rglob("*.json")):
        if ".git" in arq.parts:
            continue
        try:
            json.loads(arq.read_text(encoding="utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            problemas.append(f"{arq.relative_to(RAIZ)}: JSON inválido: {e}")


def checar_links(problemas):
    cache = {}
    for nome in MARKDOWN:
        arq = RAIZ / nome
        if not arq.exists():
            problemas.append(f"{nome}: não existe")
            continue
        texto = re.sub(r"```.*?```", "", arq.read_text(encoding="utf-8"), flags=re.S)
        alvos = re.findall(r"\]\(([^)\s]+)\)", texto) + re.findall(r'(?:src|href)="([^"]+)"', texto)
        for alvo in alvos:
            if re.match(r"^[a-z]+:", alvo):
                continue
            caminho, _, frag = alvo.partition("#")
            destino = (arq.parent / caminho).resolve() if caminho else arq
            if not destino.exists():
                problemas.append(f"{nome}: link quebrado {alvo}")
                continue
            if frag and destino.suffix == ".md":
                if destino not in cache:
                    cache[destino] = ancoras(destino)
                if frag not in cache[destino]:
                    problemas.append(f"{nome}: âncora inexistente {alvo}")


def main():
    exigir_yaml = "--exigir-yaml" in sys.argv[1:]
    problemas = []
    checar_skill(problemas, exigir_yaml)
    checar_json(problemas)
    checar_links(problemas)
    sys.path.insert(0, str(RAIZ / "tools"))
    import agregar_calibracao
    agregar_calibracao.checar(problemas)
    for p in problemas:
        print(p)
    print(f"{len(problemas)} problema(s)" if problemas else "ok: skill, JSON, links, âncoras e calibração")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
