#!/usr/bin/env python3
"""hfd — ferramentas locais da skill higgsfield-director.

Só biblioteca padrão (Python 3.9+). Não acessa a rede, não gera nada e não gasta créditos.
O que gera e cobra é o conector do Higgsfield, chamado pelo agente, depois do "ok" do operador.

Subcomandos:
  validar   <projeto.json>            regras, câmera, continuidade, eixo, falas e modelo
  compilar  <projeto.json> [--texto]  um prompt por tomada + parâmetros prontos para o conector
  orcamento <projeto.json> | --tomadas N --custo-teste X --custo-final Y
  otica     <mm> <distancia_m> [abertura]
  exportar  <projeto.json> <pasta>    roteiro.md, tomadas.csv e legendas.srt
  pontuar   <avaliacao.json>          nota 0-100 com evidência obrigatória
  modelos   [--tipo video|image] [--buscar termo] [--id ID]
  modelos   --importar lista.json [mais.json ...] --saida retrato.json

--retrato arquivo.json (em validar, compilar, exportar e modelos) usa outro retrato dos modelos no lugar de
data/modelos.json. Nenhum comando grava dentro da pasta da skill sem que o caminho seja dado.

Saída: JSON em stdout. Código de saída: 0 ok; 1 o projeto tem erros (listados em "erros"); 2 uso, arquivo ou
entrada fora do formato (mensagem em "erro", no stderr). Nunca um traceback: HFD_DEBUG=1 mostra o traceback.
"""
import argparse
import csv
import datetime as _dt
import json
import math
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MODELOS = DATA / "modelos.json"

MODOS = ("t2v", "i2v", "edit", "extend", "imagem")
PALAVRAS_POR_SEGUNDO = 2.5  # fala natural; acima disso a fala não cabe na tomada


class Erro(Exception):
    """Erro de uso ou de arquivo (sai com código 2)."""


# --------------------------------------------------------------------------- utilidades

def _constante_invalida(valor):
    raise Erro(f"constante JSON não finita: {valor}")


def ler_json(caminho):
    try:
        with Path(caminho).open("rb") as arquivo:
            bruto = arquivo.read(16 * 1024 * 1024 + 1)
        if len(bruto) > 16 * 1024 * 1024:
            raise Erro("JSON excede o limite de 16 MiB")
        return json.loads(bruto.decode("utf-8"), parse_constant=_constante_invalida)
    except FileNotFoundError:
        raise Erro(f"arquivo não encontrado: {caminho}")
    except json.JSONDecodeError as e:
        raise Erro(f"JSON inválido em {caminho}: {e}")
    except (OSError, UnicodeDecodeError) as e:
        raise Erro(f"não consegui ler {caminho}: {e}")


def numero(v):
    return type(v) in (int, float) and abs(v) <= 1e9 and math.isfinite(v)


def texto(v):
    return isinstance(v, str) and v.strip() != ""


def frase(s):
    """Uma frase inteira: primeira letra maiúscula e ponto final."""
    s = " ".join(str(s).split())
    if not s:
        return ""
    s = s[0].upper() + s[1:]
    return s if s[-1] in ".!?\"'”" else s + "."


# --------------------------------------------------------------------------- câmera

_ESTATICO = re.compile(
    r"\b(static|locked[- ]?off|stationary|fixed|tripod|still)\s+(camera|shot|frame|framing)\b"
    r"|\b(locked[- ]?off|static shot|fixed camera|camera (?:is |stays |remains )?(?:static|still|fixed|locked))\b"
    r"|^\s*(static|locked[- ]?off|fixed)\s*$",
    re.I,
)
_MOVIMENTOS = {
    "orbit": r"orbit(?:s|ing)?|arc(?:s|ing)?|360",
    "dolly": r"dolly(?:ing)?|push(?:es|ing)?[- ]in|pull(?:s|ing)?[- ](?:back|out)",
    "tracking": r"track(?:s|ing)?|follow(?:s|ing)? (?:the|her|him|them)",
    "pan": r"pan(?:s|ning)?|whip[- ]pan",
    "tilt": r"tilt(?:s|ing)?",
    "crane": r"crane(?:s)?|jib(?:s)?|pedestal",
    "truck": r"truck(?:s|ing)?",
    "zoom": r"zoom(?:s|ing)?|crash[- ]zoom",
    "handheld": r"handheld|hand-held|shaky",
    "aerial": r"fpv|drone|aerial|fly[- ]?(?:through|over|by)",
}
_RE_MOV = {k: re.compile(r"\b(?:" + v + r")\b", re.I) for k, v in _MOVIMENTOS.items()}
_NEGACAO = re.compile(r"\b(no|not|without|never|avoid|zero|nor)\b|\bdon'?t\b", re.I)
_FASE = re.compile(r"\bthen\b|\bafter that\b|\bfollowed by\b|\bfinally\b|\bbefore\b|->|→|;", re.I)
_SIMULTANEO = re.compile(r"\bwhile\b|\bas it\b|\bat the same time\b|\bsimultaneously\b", re.I)


def _movimentos_da_clausula(c):
    """Movimentos afirmados numa cláusula; o que vem depois de uma negação não conta."""
    m = _NEGACAO.search(c)
    afirmado = c[: m.start()] if m else c
    return [k for k, r in _RE_MOV.items() if r.search(afirmado)]


def avaliar_camera(txt):
    """Devolve (avisos, movimentos). Nunca recusa: conflito de câmera é aviso com a frase que o causou."""
    avisos, todos = [], []
    if not texto(txt):
        return avisos, todos
    fases = [f for f in _FASE.split(txt) if f.strip()]
    for fase in fases:
        clausulas = [c for c in re.split(r",|\bbut\b|\.", fase) if c.strip()]
        estatico = any(_ESTATICO.search(c) for c in clausulas)
        movs = []
        for c in clausulas:
            movs += _movimentos_da_clausula(c)
        movs = list(dict.fromkeys(movs))
        if estatico and movs:
            avisos.append(f'câmera parada e em movimento na mesma fase: "{fase.strip()}" '
                          f"({', '.join(movs)}); separe em fases (\"static, then ...\") ou escolha um")
        if len([m for m in movs if m != "handheld"]) > 1 and (_SIMULTANEO.search(fase) or len(fases) == 1):
            avisos.append(f'mais de um movimento ao mesmo tempo: "{fase.strip()}" ({", ".join(movs)}); '
                          "regra: um movimento principal por tomada")
        todos += movs
    return avisos, list(dict.fromkeys(todos))


# --------------------------------------------------------------------------- modelos

def carregar_modelos(caminho=None):
    """O retrato indicado (tem de existir) ou o que vem com a skill (se faltar, catálogo vazio)."""
    if caminho:
        cat = ler_json(caminho)
    elif MODELOS.exists():
        cat = ler_json(MODELOS)
    else:
        return {"gerado_em": None, "modelos": {}}
    if not isinstance(cat, dict) or not isinstance(cat.get("modelos"), dict):
        raise Erro(f"{caminho or MODELOS} não é um retrato dos modelos (falta o objeto 'modelos')")
    return cat


def _normalizar_modelo(m):
    ps = {p.get("name"): p for p in m.get("parameters") or [] if isinstance(p, dict)}
    dur = ps.get("duration") or {}
    duracao = None
    if dur.get("options"):
        duracao = {"opcoes": dur["options"], "padrao": dur.get("default")}
    elif dur.get("min") is not None or dur.get("max") is not None:
        duracao = {"min": dur.get("min"), "max": dur.get("max"), "padrao": dur.get("default")}
    elif m.get("duration_range"):
        duracao = {"faixa": m["duration_range"]}
    audio = None
    for nome in ("generate_audio", "sound"):
        if nome in ps:
            audio = {"parametro": nome, "padrao": ps[nome].get("default"), "opcoes": ps[nome].get("options")}
            break
    res = ps.get("resolution") or ps.get("quality") or {}
    papeis = sorted({r for md in m.get("medias") or [] if isinstance(md, dict)
                     for r in (md.get("roles") or []) if isinstance(r, str)})
    return {
        "id": m.get("id"),
        "nome": m.get("name"),
        "fornecedor": m.get("provider_name"),
        "tipo": m.get("output_type"),
        "descricao": m.get("description"),
        "proporcoes": m.get("aspect_ratios") or [],
        "duracao": duracao,
        "resolucao": {"parametro": "resolution" if "resolution" in ps else "quality",
                      "opcoes": res.get("options"), "padrao": res.get("default")} if res else None,
        "audio": audio,
        "audio_nas_tags": any(t in ("audio", "sound") for t in m.get("tags") or []),
        "modos": (ps.get("mode") or {}).get("options"),
        "midias": papeis,
        "parametros": sorted(k for k in ps if k),
        "tags": m.get("tags") or [],
    }


def _limites_duracao(d):
    """Lê limites diretos ou a faixa devolvida por alguns modelos do catálogo."""
    faixa = d.get("faixa") if isinstance(d.get("faixa"), dict) else {}
    minimo = d.get("min") if d.get("min") is not None else faixa.get("min")
    maximo = d.get("max") if d.get("max") is not None else faixa.get("max")
    return minimo, maximo


def importar_modelos(arquivos, saida, base=None):
    """Monta um retrato novo a partir das listas do models_explore e grava em `saida`.

    Parte do retrato `base` (ou do que vem com a skill). Aceita dois formatos do models_explore:
    - `list` (lista de modelos): para cada tipo presente (video, image...), o que não veio na lista sai do retrato,
      porque a lista do conector é a verdade daquele tipo. Todas as páginas de um tipo entram no mesmo comando.
    - `get` (um modelo só): entra ou é atualizado, sem tirar nenhum outro. É o jeito de validar o projeto contra
      os limites ao vivo do modelo escolhido.
    """
    if not saida:
        raise Erro("use --saida <arquivo>: o retrato novo vai para um caminho indicado, nunca para dentro da "
                   "pasta da skill sem pedido")
    novos, de_lista = {}, {}
    for arq in arquivos:
        bruto = ler_json(arq)
        um_so = isinstance(bruto, dict) and texto(bruto.get("id")) and "items" not in bruto
        itens = [bruto] if um_so else (bruto.get("items") if isinstance(bruto, dict) else bruto)
        if not isinstance(itens, list) or not itens or not all(isinstance(m, dict) for m in itens):
            raise Erro(f"{arq}: não é resposta do models_explore (list com 'items', ou get de um modelo)")
        for m in itens:
            n = _normalizar_modelo(m)
            if texto(n["id"]):
                novos[n["id"]] = n
                if not um_so:
                    de_lista[n["id"]] = n
    if not novos:
        raise Erro("nenhum modelo com id nas listas importadas")
    atual = carregar_modelos(base)
    modelos = dict(atual["modelos"])
    tipos_importados = {n["tipo"] for n in de_lista.values()}
    removidos = sorted(k for k, m in modelos.items() if isinstance(m, dict) and m.get("tipo") in tipos_importados
                       and k not in novos)
    for k in removidos:
        del modelos[k]
    modelos.update(novos)
    retrato = {"gerado_em": _dt.date.today().isoformat(), "modelos": modelos,
               "fonte": "conector Higgsfield, models_explore list (importado por hfd.py modelos --importar)"}
    destino = Path(saida)
    try:
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(json.dumps(retrato, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    except OSError as e:
        raise Erro(f"não consegui gravar {destino}: {e}")
    tipos = {}
    for n in novos.values():
        tipos[n["tipo"]] = tipos.get(n["tipo"], 0) + 1
    return {"saida": str(destino), "importados": len(novos), "por_tipo": tipos, "removidos": removidos,
            "total_no_retrato": len(modelos), "gerado_em": retrato["gerado_em"]}


def checar_modelo(p, catalogo):
    """Erros e avisos do projeto contra o retrato do catálogo."""
    erros, avisos = [], []
    mid = p.get("modelo")
    data = catalogo.get("gerado_em")
    if not texto(mid):
        avisos.append("sem 'modelo': escolha um no catálogo ao vivo (models_explore) antes de estimar o custo")
        return erros, avisos, None
    m = catalogo.get("modelos", {}).get(mid)
    if not m:
        avisos.append(f"modelo '{mid}' não está no retrato de {data}; confira o id ao vivo (models_explore get)")
        return erros, avisos, None
    if p.get("modo") == "imagem" and m["tipo"] != "image":
        erros.append(f"modo imagem com modelo de {m['tipo']} ({mid})")
    if p.get("modo") in ("t2v", "i2v", "edit", "extend") and m["tipo"] != "video":
        erros.append(f"modo {p.get('modo')} com modelo de {m['tipo']} ({mid})")
    prop = p.get("proporcao")
    if prop and m["proporcoes"] and prop not in m["proporcoes"]:
        erros.append(f"proporção {prop} não aceita por {mid} (aceita: {', '.join(m['proporcoes'])})")
    res = p.get("resolucao")
    if res and m.get("resolucao") and m["resolucao"].get("opcoes") and res not in m["resolucao"]["opcoes"]:
        erros.append(f"resolução {res} não aceita por {mid} (aceita: {', '.join(map(str, m['resolucao']['opcoes']))})")
    if p.get("modo") == "i2v" and m["midias"] and not ({"start_image", "image", "image_references"} & set(m["midias"])):
        erros.append(f"{mid} não recebe imagem inicial; i2v precisa de outro modelo")
    d = m.get("duracao") or {}
    minimo, maximo = _limites_duracao(d)
    for t in p.get("tomadas") or []:
        if not isinstance(t, dict) or not numero(t.get("duracao")):
            continue
        dur = t["duracao"]
        if d.get("opcoes") and dur not in d["opcoes"]:
            erros.append(f"{t.get('id')}: {dur} s não é opção de {mid} (opções: {d['opcoes']})")
        if maximo is not None and dur > maximo:
            erros.append(f"{t.get('id')}: {dur} s passa do máximo de {mid} ({maximo} s)")
        if minimo is not None and minimo > 0 and dur < minimo:
            erros.append(f"{t.get('id')}: {dur} s abaixo do mínimo de {mid} ({minimo} s)")
        if (t.get("som") or t.get("falas")) and not (m.get("audio") or m.get("audio_nas_tags")):
            avisos.append(f"{t.get('id')}: {mid} não mostra áudio nativo no retrato; som vai para a pós-produção")
    if len(p.get("tomadas") or []) > 1 and "multi_shots" not in m.get("parametros", []):
        avisos.append(f"{mid} não tem multi-shot no retrato: cada tomada é uma geração separada")
    if data:
        idade = (_dt.date.today() - _dt.date.fromisoformat(data)).days
        if idade > 30:
            avisos.append(f"retrato dos modelos tem {idade} dias; atualize (references/modelos.md)")
    return erros, avisos, m


# --------------------------------------------------------------------------- validação

def _entidades(t):
    e = t.get("entidades") or []
    return e if isinstance(e, list) else []


def _lista_de(v, tipo):
    return isinstance(v, list) and all(isinstance(x, tipo) for x in v)


def _ponto(v):
    return isinstance(v, list) and len(v) == 2 and all(numero(x) for x in v)


def forma(p):
    """Erros de tipo. O resto da validação supõe estes formatos; se algum falhar, ela para aqui."""
    erros = []
    biblias = p.get("biblias")
    if biblias is not None:
        if not isinstance(biblias, dict):
            erros.append("'biblias' deve ser um objeto {id: ficha}")
        else:
            for k, b in biblias.items():
                if not isinstance(b, dict):
                    erros.append(f"ficha '{k}' deve ser um objeto")
                elif b.get("fixo") is not None and not isinstance(b["fixo"], dict):
                    erros.append(f"ficha '{k}': 'fixo' deve ser um objeto {{atributo: valor}}")
    for campo in ("restricoes", "preservar"):
        if p.get(campo) is not None and not _lista_de(p[campo], str):
            erros.append(f"'{campo}' deve ser uma lista de textos")
    if p.get("eixo") is not None and not (isinstance(p["eixo"], list) and len(p["eixo"]) == 2
                                          and all(_ponto(x) for x in p["eixo"])):
        erros.append("'eixo' deve ser [[x1, y1], [x2, y2]] com números")
    for n, t in enumerate(p["tomadas"], 1):
        if not isinstance(t, dict):
            erros.append(f"tomada {n}: deve ser um objeto")
            continue
        tid = t.get("id") if texto(t.get("id")) else f"tomada {n}"
        for campo in ("entidades", "mudancas_aprovadas", "restricoes", "preservar"):
            if t.get(campo) is not None and not _lista_de(t[campo], str):
                erros.append(f"{tid}: '{campo}' deve ser uma lista de textos")
        for campo in ("falas", "linha_do_tempo"):
            if t.get(campo) is not None and not _lista_de(t[campo], dict):
                erros.append(f"{tid}: '{campo}' deve ser uma lista de objetos")
        for campo in ("inicio", "fim"):
            v = t.get(campo)
            if v is not None and not (isinstance(v, dict) and all(isinstance(a, dict) for a in v.values())):
                erros.append(f"{tid}: '{campo}' deve ser um objeto {{entidade: {{atributo: valor}}}}")
        if t.get("camera_xy") is not None and not _ponto(t["camera_xy"]):
            erros.append(f"{tid}: 'camera_xy' deve ser [x, y] com números")
    return erros


def continuidade(p):
    erros, avisos = [], []
    biblias = p.get("biblias") or {}
    ultimo = {}  # entidade -> (tomada, estado)
    tomadas = [t for t in p.get("tomadas") or [] if isinstance(t, dict)]
    for i, t in enumerate(tomadas):
        tid = t.get("id")
        for ent in _entidades(t) + list((t.get("inicio") or {}).keys()) + list((t.get("fim") or {}).keys()):
            if ent not in biblias:
                erros.append(f"{tid}: entidade '{ent}' não tem ficha em 'biblias'")
        for fase in ("inicio", "fim"):
            for ent, attrs in (t.get(fase) or {}).items():
                fixo = (biblias.get(ent) or {}).get("fixo") or {}
                for k, v in (attrs or {}).items():
                    if k in fixo and fixo[k] != v:
                        erros.append(f"{tid} {fase}: {ent}.{k} = {v!r}, mas a ficha fixa {fixo[k]!r}")
        aprovadas = set(t.get("mudancas_aprovadas") or [])
        for ent, attrs in (t.get("inicio") or {}).items():
            if ent in ultimo:
                de_quem, antes = ultimo[ent]
                for k, v in (attrs or {}).items():
                    if k in antes and antes[k] != v and f"{ent}.{k}" not in aprovadas:
                        erros.append(f"{tid}: {ent}.{k} começa {v!r}, mas terminou {antes[k]!r} em {de_quem} "
                                     f"(se é de propósito, ponha \"{ent}.{k}\" em mudancas_aprovadas)")
        for ent, attrs in (t.get("inicio") or {}).items():
            base = dict(ultimo.get(ent, (None, {}))[1])
            base.update(attrs or {})
            ultimo[ent] = (tid, base)
        if t.get("fim"):
            for ent, attrs in t["fim"].items():
                base = dict(ultimo.get(ent, (None, {}))[1])
                base.update(attrs or {})
                ultimo[ent] = (tid, base)
        elif t.get("inicio") and i + 1 < len(tomadas):
            avisos.append(f"{tid}: sem 'fim'; a próxima tomada será conferida contra o 'inicio' desta")
    return erros, avisos


def eixo(p):
    """Regra dos 180°: avisa quando a câmera troca de lado do eixo sem motivo declarado."""
    avisos = []
    ax = p.get("eixo")
    if not ax:
        return avisos
    (x1, y1), (x2, y2) = ax  # formato já conferido em forma()
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ["'eixo' degenerado (dois pontos iguais)"]
    lado = None
    for t in p.get("tomadas") or []:
        xy = t.get("camera_xy") if isinstance(t, dict) else None
        if not xy:
            continue
        x, y = xy
        cruz = dx * (y - y1) - dy * (x - x1)
        s = (cruz > 0) - (cruz < 0)
        if s and lado and s != lado and not t.get("cruzamento_motivado"):
            avisos.append(f"{t.get('id')}: câmera cruzou o eixo de ação (regra dos 180°); "
                          "marque cruzamento_motivado se for intencional")
        if s:
            lado = s
    return avisos


def validar(p, catalogo=None):
    catalogo = catalogo if catalogo is not None else carregar_modelos()
    erros, avisos = [], []
    if not isinstance(p, dict):
        return {"erros": ["o projeto deve ser um objeto JSON"], "avisos": []}
    modo = p.get("modo", "t2v")
    if modo not in MODOS:
        erros.append(f"modo '{modo}' inválido (use {', '.join(MODOS)})")
    tomadas = p.get("tomadas")
    if not isinstance(tomadas, list) or not tomadas:
        return {"erros": erros + ["'tomadas' é obrigatório: uma lista não vazia de tomadas"], "avisos": avisos}
    erros_de_forma = forma(p)
    if erros_de_forma:
        return {"erros": erros + erros_de_forma, "avisos": avisos}
    ids = set()
    for t in tomadas:
        tid = t.get("id")
        if not texto(tid) or tid in ids:
            erros.append(f"tomada sem id ou com id repetido: {tid!r}")
        else:
            ids.add(tid)
        sujeito = texto(t.get("sujeito")) or texto(p.get("sujeito")) or _entidades(t)
        if not sujeito:
            erros.append(f"{tid}: falta sujeito (campo 'sujeito' ou 'entidades' com ficha)")
        if modo != "imagem":
            if not numero(t.get("duracao")) or t["duracao"] <= 0:
                erros.append(f"{tid}: 'duracao' em segundos é obrigatória")
            if not texto(t.get("acao")):
                erros.append(f"{tid}: falta 'acao' (uma ação dominante)")
        else:
            for k in ("camera", "som", "falas", "linha_do_tempo"):
                if t.get(k):
                    avisos.append(f"{tid}: '{k}' não se aplica a imagem parada; será ignorado")
        av, _ = avaliar_camera(t.get("camera", ""))
        avisos += [f"{tid}: {a}" for a in av]
        falas = t.get("falas") or []
        palavras = sum(len(str(f.get("texto", "")).split()) for f in falas if isinstance(f, dict))
        if falas and numero(t.get("duracao")) and palavras > PALAVRAS_POR_SEGUNDO * t["duracao"]:
            avisos.append(f"{tid}: {palavras} palavras de fala não cabem em {t['duracao']} s "
                          f"(~{int(PALAVRAS_POR_SEGUNDO * t['duracao'])} no máximo); encurte ou aumente a tomada")
        for f in falas:
            if not texto(f.get("quem")):
                erros.append(f"{tid}: toda fala precisa de 'quem' (rótulo do personagem)")
        trilhas = {}
        for ev in t.get("linha_do_tempo") or []:
            a, b, tr = ev.get("de"), ev.get("ate"), ev.get("trilha")
            if not texto(tr) or not numero(a) or not numero(b) or not (0 <= a < b) or \
                    (numero(t.get("duracao")) and b > t["duracao"]):
                erros.append(f"{tid}: evento inválido na linha do tempo: {ev}")
                continue
            for c, z in trilhas.get(tr, []):
                if a < z and c < b:
                    erros.append(f"{tid}: eventos sobrepostos na trilha '{tr}' ({c}-{z} e {a}-{b})")
            trilhas.setdefault(tr, []).append((a, b))
        if modo in ("i2v", "edit", "extend") and not (t.get("referencias") or p.get("referencias")):
            avisos.append(f"{tid}: modo {modo} precisa de referência (imagem/vídeo) antes de gerar")
    e, a = continuidade(p)
    erros += e
    avisos += a
    avisos += eixo(p)
    e, a, _ = checar_modelo(p, catalogo)
    erros += e
    avisos += a
    return {"erros": erros, "avisos": avisos}


# --------------------------------------------------------------------------- compilação

def _descricao_entidades(p, t):
    biblias = p.get("biblias") or {}
    out = []
    for ent in _entidades(t):
        b = biblias.get(ent) or {}
        if texto(b.get("descricao")):
            out.append(b["descricao"])
    return out


def compilar_tomada(p, t, modelo=None):
    modo = p.get("modo", "t2v")
    partes = []
    if modo == "i2v":
        inv = list(dict.fromkeys((p.get("preservar") or []) + (t.get("preservar") or [])))
        partes.append("The reference image is the opening frame" +
                      (f"; preserve {', '.join(inv)}" if inv else "") + ".")
    elif modo == "edit":
        partes.append(f"Change only {t.get('alvo') or p.get('alvo') or 'the specified target'}; "
                      "preserve everything else exactly as it is.")
    elif modo == "extend":
        partes.append("Continue seamlessly from the final frame of the previous clip.")
    if modo == "i2v":
        # na imagem para vídeo a imagem já traz sujeito e cena: o texto foca em movimento e câmera
        campos_cena = []
    else:
        campos_cena = _descricao_entidades(p, t) + [t.get("sujeito") or ("" if _entidades(t) else p.get("sujeito", "")),
                                                   t.get("ambiente") or p.get("ambiente", "")]
    temporais = ["acao", "microacao"] if modo != "imagem" else []
    ordem = campos_cena + [t.get(k, "") for k in temporais] + [t.get("enquadramento", "")]
    if modo != "imagem":
        ordem.append(t.get("camera", ""))
    ordem += [t.get("otica", ""), t.get("luz", "") or p.get("luz", ""), t.get("estetica", "") or p.get("estetica", ""),
              t.get("atmosfera", "")]
    if modo != "imagem":
        ordem += [t.get("secundario", ""), t.get("final", "")]
    partes += [frase(x) for x in ordem if texto(x)]
    partes += [frase(x) for x in (p.get("restricoes") or []) + (t.get("restricoes") or []) if texto(x)]
    audio = []
    if modo != "imagem":
        if texto(t.get("som")):
            audio.append(frase(t["som"]))
        for f in t.get("falas") or []:
            if isinstance(f, dict) and texto(f.get("texto")):
                idioma = f" in {f['idioma']}" if texto(f.get("idioma")) else ""
                audio.append(f'{f.get("quem", "A character")} says{idioma}: "{f["texto"].strip()}"')
    prompt = " ".join(partes)
    if audio:
        prompt += "\n\nAudio: " + " ".join(audio)
    params = {}
    if modelo:
        params["model"] = modelo["id"]
        if modo != "imagem" and numero(t.get("duracao")):
            params["duration"] = t["duracao"]
        if p.get("proporcao"):
            params["aspect_ratio"] = p["proporcao"]
        if p.get("resolucao") and modelo.get("resolucao"):
            params[modelo["resolucao"]["parametro"]] = p["resolucao"]
        quer_audio = bool(t.get("som") or t.get("falas"))
        if modelo.get("audio") and modo != "imagem":
            a = modelo["audio"]
            params[a["parametro"]] = (("on" if quer_audio else "off") if a.get("opcoes") == ["on", "off"]
                                      else quer_audio)
        if modo in ("i2v", "edit", "extend") and modelo.get("modos"):
            # o nome do modo muda de modelo para modelo; o primeiro que existir vale
            nomes = {"i2v": ("omni_reference", "image-to-video", "i2v"),
                     "edit": ("video_edit", "video-edit", "edit"),
                     "extend": ("video_extension", "extend")}[modo]
            alvo = next((n for n in nomes if n in modelo["modos"]), None)
            if alvo:
                params["mode"] = alvo
    elif p.get("modelo"):
        params = {"model": p["modelo"], "duration": t.get("duracao"), "aspect_ratio": p.get("proporcao")}
    return {"id": t.get("id"), "prompt": prompt, "parametros": {k: v for k, v in params.items() if v is not None},
            "referencias": t.get("referencias") or p.get("referencias") or []}


def compilar(p, catalogo=None):
    catalogo = catalogo if catalogo is not None else carregar_modelos()
    rel = validar(p, catalogo)
    if rel["erros"]:
        return rel
    _, _, modelo = checar_modelo(p, catalogo)
    return {**rel, "modelo": p.get("modelo"), "retrato_dos_modelos": catalogo.get("gerado_em"),
            "tomadas": [compilar_tomada(p, t, modelo) for t in p["tomadas"]]}


# --------------------------------------------------------------------------- orçamento, óptica, nota

def orcamento(tomadas, reserva=20.0, tentativas=None):
    """Total em créditos. `tentativas` (da linha de comando) vale para as tomadas que não trazem o próprio número."""
    if not numero(reserva) or reserva < 0:
        raise Erro("reserva inválida")
    if not isinstance(tomadas, list) or not tomadas or not all(isinstance(t, dict) for t in tomadas):
        raise Erro("'tomadas' deve ser uma lista não vazia de objetos")
    padrao = tentativas if tentativas is not None else 2
    linhas, avisos, base = [], [], 0.0
    for t in tomadas:
        ct, cf = t.get("custo_teste"), t.get("custo_final")
        n = t.get("tentativas", padrao)
        if not numero(ct) or not numero(cf) or ct < 0 or cf < 0:
            raise Erro(f"{t.get('id')}: sem custo_teste/custo_final. Rode a estimativa do conector "
                       "(estimate_video_cost / estimate_image_cost) e preencha; não invente preço")
        if type(n) is not int or not 0 <= n <= 10**9:
            raise Erro(f"{t.get('id')}: tentativas deve ser inteiro entre 0 e 1000000000")
        if tentativas is not None and "tentativas" in t and n != tentativas:
            avisos.append(f"{t.get('id')}: vale tentativas={n} da própria tomada, não --tentativas {tentativas}")
        sub = round(n * ct + cf, 2)
        linhas.append({"id": t.get("id"), "tentativas": n, "custo_teste": ct, "custo_final": cf, "subtotal": sub})
        base += sub
    base = round(base, 2)
    return {"tomadas": linhas, "base": base, "reserva_pct": reserva, "reserva": round(base * reserva / 100, 2),
            "total": round(base * (1 + reserva / 100), 2), "avisos": avisos,
            "lembrete": "custo é estimativa do conector; gerar só depois do ok do operador com este total"}


def otica(f, d, n=2.8, sensor=36.0, coc=0.03):
    if not all(numero(x) and x > 0 for x in (f, d, n, sensor, coc)):
        raise Erro("use números positivos: distância focal (mm), distância (m), abertura")
    s = d * 1000
    if s <= f:
        raise Erro("a distância precisa ser maior que a distância focal")
    h = f * f / (n * coc)
    perto = s * h / (h + (s - f))
    longe = s * h / (h - (s - f)) if h > (s - f) else None
    return {"campo_de_visao_horizontal_graus": round(math.degrees(2 * math.atan(sensor / (2 * f))), 2),
            "largura_do_quadro_m": round(d * sensor / f, 3),
            "foco_de_m": round(perto / 1000, 3),
            "foco_ate_m": round(longe / 1000, 3) if longe else "infinito",
            "hiperfocal_m": round((h + f) / 1000, 2),
            "nota": "lente fina, sensor full-frame 36 mm; descreve o visual, não é parâmetro do modelo"}


def pontuar(x):
    pesos = ler_json(DATA / "pesos.json")
    if not isinstance(x, dict):
        raise Erro("a avaliação deve ser um objeto JSON (veja templates/avaliacao.json)")
    if x.get("tipo") not in ("prompt", "resultado"):
        raise Erro("tipo deve ser 'prompt' ou 'resultado'")
    if x["tipo"] == "resultado" and not texto(x.get("arquivo")):
        raise Erro("nota de resultado exige 'arquivo' (o que foi visto)")
    crit = x.get("criterios") or {}
    if not isinstance(crit, dict):
        raise Erro("'criterios' deve ser um objeto {criterio: {nota, evidencia}}")
    total = den = 0.0
    faltando = []
    for k, w in pesos.items():
        c = crit.get(k)
        if c is None:
            faltando.append(k)
            continue
        if not isinstance(c, dict):
            raise Erro(f"{k}: deve ser um objeto com 'nota' e 'evidencia'")
        if not texto(c.get("evidencia")):
            raise Erro(f"{k}: evidência obrigatória (o que se viu, em que segundo)")
        v = c.get("nota")
        if v is None:
            if not texto(c.get("nao_se_aplica")):
                raise Erro(f"{k}: sem nota exige 'nao_se_aplica' com o motivo")
            continue
        if not numero(v) or not 0 <= v <= 10:
            raise Erro(f"{k}: nota de 0 a 10")
        total += w * v / 10
        den += w
    if faltando:
        raise Erro("critérios ausentes: " + ", ".join(faltando))
    if not den:
        raise Erro("nenhum critério aplicável")
    nota = round(total / den * 100, 1)
    if x.get("falha_critica"):
        sit = "bloqueado (falha crítica)"
    else:
        sit = ("excelente" if nota >= 90 else "aprovado com ajustes" if nota >= 80
               else "revisar" if nota >= 65 else "reprovado")
    return {"tipo": x["tipo"], "nota": nota, "situacao": sit}


# --------------------------------------------------------------------------- exportação

def _csv_seguro(v):
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


def _carimbo(seg):
    ms = int(round(seg * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def exportar(p, pasta, catalogo=None):
    c = compilar(p, catalogo)
    if c.get("erros"):
        return c
    out = Path(pasta)
    out.mkdir(parents=True, exist_ok=True)
    por_id = {t["id"]: t for t in p["tomadas"]}
    inicio = 0.0
    linhas_md = [f"# {p.get('titulo', 'Roteiro')}", "",
                 f"Modelo: `{p.get('modelo', '?')}` · modo {p.get('modo', 't2v')} · "
                 f"proporção {p.get('proporcao', '?')} · retrato dos modelos de {c.get('retrato_dos_modelos')}", "",
                 "| Tomada | De | Até | Ação | Câmera |", "|---|---|---|---|---|"]
    srt, n = [], 0
    with (out / "tomadas.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "inicio_s", "fim_s", "duracao_s", "prompt", "parametros"])
        for tc in c["tomadas"]:
            t = por_id[tc["id"]]
            dur = float(t.get("duracao") or 0)
            fim = inicio + dur
            w.writerow([_csv_seguro(tc["id"]), inicio, fim, dur, _csv_seguro(tc["prompt"]),
                        _csv_seguro(json.dumps(tc["parametros"], ensure_ascii=False))])
            cel = lambda s: str(s or "").replace("|", "/").replace("\n", " ")
            linhas_md.append(f"| {tc['id']} | {inicio:g} | {fim:g} | {cel(t.get('acao'))} | {cel(t.get('camera'))} |")
            # várias falas dividem a tomada em trechos seguidos, proporcionais ao número de palavras
            falas = [fl for fl in t.get("falas") or [] if isinstance(fl, dict) and texto(fl.get("texto"))]
            pesos = [len(fl["texto"].split()) for fl in falas]
            de = inicio
            for i, fl in enumerate(falas if dur > 0 else []):
                ate = fim if i == len(falas) - 1 else de + dur * pesos[i] / sum(pesos)
                n += 1
                srt.append(f"{n}\n{_carimbo(de)} --> {_carimbo(ate)}\n{fl.get('quem')}: {fl['texto'].strip()}\n")
                de = ate
            inicio = fim
    linhas_md += ["", "## Prompts", ""]
    for tc in c["tomadas"]:
        linhas_md += [f"### {tc['id']}", "", "```text", tc["prompt"], "```", "",
                      "Parâmetros: `" + json.dumps(tc["parametros"], ensure_ascii=False) + "`", ""]
    if c["avisos"]:
        linhas_md += ["## Avisos", ""] + [f"- {a}" for a in c["avisos"]] + [""]
    (out / "roteiro.md").write_text("\n".join(linhas_md), encoding="utf-8")
    arquivos = ["roteiro.md", "tomadas.csv"]
    if srt:
        (out / "legendas.srt").write_text("\n".join(srt), encoding="utf-8")
        arquivos.append("legendas.srt")
    return {"pasta": str(out), "arquivos": arquivos, "duracao_total_s": inicio, "avisos": c["avisos"]}


# --------------------------------------------------------------------------- CLI

def _modelos_cli(a):
    if a.importar:
        return importar_modelos(a.importar, a.saida, a.retrato)
    if a.saida:
        raise Erro("--saida só vale com --importar")
    cat = carregar_modelos(a.retrato)
    ms = list(cat.get("modelos", {}).values())
    if a.id:
        m = cat.get("modelos", {}).get(a.id)
        if not m:
            raise Erro(f"'{a.id}' não está no retrato de {cat.get('gerado_em')}; confira ao vivo")
        return m
    if a.tipo:
        ms = [m for m in ms if m["tipo"] == a.tipo]
    if a.buscar:
        termos = a.buscar.casefold().split()
        ms = [m for m in ms if all(t in json.dumps(m, ensure_ascii=False).casefold() for t in termos)]
    resumo = []
    for m in sorted(ms, key=lambda m: (m["tipo"] or "", m["id"])):
        d = m.get("duracao") or {}
        minimo, maximo = _limites_duracao(d)
        dur = (f"{minimo}-{maximo} s" if maximo is not None else
               f"{d['opcoes']} s" if d.get("opcoes") else "?")
        resumo.append({"id": m["id"], "nome": m["nome"], "tipo": m["tipo"], "duracao": dur,
                       "audio": bool(m.get("audio") or m.get("audio_nas_tags")),
                       "imagem_inicial": "start_image" in m["midias"],
                       "quadro_final": "end_image" in m["midias"],
                       "modos": m.get("modos")})
    return {"gerado_em": cat.get("gerado_em"), "quantidade": len(resumo), "modelos": resumo}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="hfd", description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    comum = argparse.ArgumentParser(add_help=False)
    comum.add_argument("--retrato", help="retrato dos modelos a usar no lugar de data/modelos.json")
    for nome in ("validar", "compilar", "pontuar"):
        s = sub.add_parser(nome, parents=[comum] if nome != "pontuar" else [])
        s.add_argument("arquivo")
        if nome == "compilar":
            s.add_argument("--texto", action="store_true", help="só os prompts, prontos para copiar")
    s = sub.add_parser("orcamento")
    s.add_argument("arquivo", nargs="?")
    s.add_argument("--tomadas", type=int)
    s.add_argument("--custo-teste", type=float)
    s.add_argument("--custo-final", type=float)
    s.add_argument("--tentativas", type=int)
    s.add_argument("--reserva", type=float, default=20.0)
    s = sub.add_parser("otica")
    s.add_argument("valores", nargs="+", type=float)
    s = sub.add_parser("exportar", parents=[comum])
    s.add_argument("arquivo")
    s.add_argument("pasta")
    s = sub.add_parser("modelos", parents=[comum])
    s.add_argument("--tipo", choices=["video", "image", "audio", "3d"])
    s.add_argument("--buscar")
    s.add_argument("--id")
    s.add_argument("--importar", nargs="+", metavar="LISTA", help="respostas do models_explore list (JSON)")
    s.add_argument("--saida", help="onde gravar o retrato novo (obrigatório com --importar)")
    a = ap.parse_args(argv)
    try:
        return _executar(a)
    except Erro as e:
        print(json.dumps({"erro": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 2
    except Exception as e:  # nunca um traceback com código 1, que o agente leria como "erro de conteúdo"
        if os.environ.get("HFD_DEBUG"):
            raise
        print(json.dumps({"erro": f"entrada fora do formato esperado ou falha interna ({type(e).__name__}: {e}); "
                                  "rode de novo com HFD_DEBUG=1 para ver o traceback"}, ensure_ascii=False),
              file=sys.stderr)
        return 2


def _executar(a):
    if a.cmd == "validar":
        r = validar(ler_json(a.arquivo), carregar_modelos(a.retrato))
        code = 1 if r["erros"] else 0
    elif a.cmd == "compilar":
        r = compilar(ler_json(a.arquivo), carregar_modelos(a.retrato))
        code = 1 if r.get("erros") else 0
        if a.texto and not code:
            for t in r["tomadas"]:
                print(f"## {t['id']}\n{t['prompt']}\n\nparametros: {json.dumps(t['parametros'], ensure_ascii=False)}\n")
            for av in r["avisos"]:
                print(f"AVISO: {av}")
            return 0
    elif a.cmd == "orcamento":
        if a.arquivo:
            p = ler_json(a.arquivo)
            if not isinstance(p, dict):
                raise Erro("o projeto deve ser um objeto JSON")
            r = orcamento(p.get("tomadas"), a.reserva, a.tentativas)
        else:
            if a.tomadas is None or a.custo_teste is None or a.custo_final is None:
                raise Erro("use um projeto.json ou --tomadas, --custo-teste e --custo-final")
            if not 1 <= a.tomadas <= 10000:
                raise Erro("--tomadas deve estar entre 1 e 10000")
            n = a.tentativas if a.tentativas is not None else 2
            r = orcamento([{"id": f"T{i + 1:02}", "custo_teste": a.custo_teste, "custo_final": a.custo_final,
                            "tentativas": n} for i in range(a.tomadas)], a.reserva)
        code = 0
    elif a.cmd == "otica":
        if len(a.valores) not in (2, 3):
            raise Erro("uso: otica <mm> <distancia_m> [abertura]")
        r = otica(*a.valores)
        code = 0
    elif a.cmd == "exportar":
        try:
            r = exportar(ler_json(a.arquivo), a.pasta, carregar_modelos(a.retrato))
        except OSError as e:
            raise Erro(f"não consegui gravar em {a.pasta}: {e}")
        code = 1 if r.get("erros") else 0
    elif a.cmd == "pontuar":
        r = pontuar(ler_json(a.arquivo))
        code = 0
    else:
        r = _modelos_cli(a)
        code = 0
    print(json.dumps(r, ensure_ascii=False, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
