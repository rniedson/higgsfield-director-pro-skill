#!/usr/bin/env python3
"""hfd — local tools of the higgsfield-director skill.

Independent, unofficial project, not affiliated with or endorsed by Higgsfield.

Standard library only (Python 3.9+). It does not touch the network, generate anything or spend credits.
What generates and charges is the Higgsfield connector, called by the agent, after the operator's "ok".

Subcommands:
  validate  <project.json>            rules, camera, continuity, axis, dialogue and model
  compile   <project.json> [--text]   one prompt per shot + parameters ready for the connector
  budget    <project.json> | --shots N --test-cost X --final-cost Y
  optics    <mm> <distance_m> [aperture]
  export    <project.json> <folder>   script.md, shots.csv and (with dialogue) subtitles.srt
  score     <evaluation.json>         score 0-100 with mandatory evidence
  models    [--type video|image] [--search term] [--id ID]
  models    --import list.json [more.json ...] --out snapshot.json
  preferences [--mode follow|price|ceiling] [--calibrate yes|no|later] [--file path]
  blind     --with with.json --without without.json --out <folder>   draws X and Y and writes the key unseen
  result    --key blind-key.json --vote X|Y|tie ... --out calibration/<file>.json
  crop      <sheet.png> <folder> name:x0,y0,x1,y1 [...]   ffmpeg commands that crop the sketch sheet

--snapshot file.json (in validate, compile, export and models) uses another models snapshot instead of
data/models.json. No command writes inside the skill folder unless the path is given. `preferences` uses
.higgsfield-director/preferences.json in the current folder, unless --file.

Old names (6.x only): the Portuguese subcommands, options, fields and values of 5.x still work, translated with a
warning that names the new one. They will be removed in 7.0.

Output: JSON on stdout. Exit code: 0 ok; 1 the project has errors (listed in "errors"); 2 usage, file or input
out of format (message in "error", on stderr). Warnings that are not part of the output go to stderr, one JSON
object per line ({"warning": ...}). Never a traceback: HFD_DEBUG=1 shows the traceback.
"""
import argparse
import csv
import datetime as _dt
import json
import math
import os
import re
import secrets
import shlex
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MODELS = DATA / "models.json"

MODES = ("t2v", "i2v", "edit", "extend", "image")
WORDS_PER_SECOND = 2.5  # natural speech; above this the dialogue does not fit in the shot


class Error(Exception):
    """Usage or file error (exits with code 2)."""


# --------------------------------------------------------------------------- utilities

def _invalid_constant(value):
    raise Error(f"non-finite JSON constant: {value}")


def read_json(path):
    try:
        with Path(path).open("rb") as f:
            raw = f.read(16 * 1024 * 1024 + 1)
        if len(raw) > 16 * 1024 * 1024:
            raise Error("JSON exceeds the 16 MiB limit")
        return json.loads(raw.decode("utf-8"), parse_constant=_invalid_constant)
    except FileNotFoundError:
        raise Error(f"file not found: {path}")
    except json.JSONDecodeError as e:
        raise Error(f"invalid JSON in {path}: {e}")
    except (OSError, UnicodeDecodeError) as e:
        raise Error(f"could not read {path}: {e}")


def is_number(v):
    return type(v) in (int, float) and abs(v) <= 1e9 and math.isfinite(v)


def is_text(v):
    return isinstance(v, str) and v.strip() != ""


def sentence(s):
    """A whole sentence: a capital first letter (unless the first word has its own capitals) and a final period."""
    s = " ".join(str(s).split())
    if not s:
        return ""
    first = s.split(" ", 1)[0]
    if first.islower() and first.isalpha():  # "a glass bottle" -> "A glass bottle"; "iPhone" and "eBay" stay
        s = s[0].upper() + s[1:]
    return s if s[-1] in ".!?\"'”" else s + "."


def _warn(message):
    """A warning that is not part of the JSON output: one JSON object per line on stderr."""
    print(json.dumps({"warning": message}, ensure_ascii=False), file=sys.stderr)


# --------------------------------------------------------------------------- old names (6.x only)
# language-check: off  (the Portuguese names accepted until 7.0)
# 5.x used Portuguese names. 6.x still accepts them, translates them and warns; 7.0 removes them.

_REMOVAL = "the old name will be removed in 7.0"

OLD_COMMANDS = {"validar": "validate", "compilar": "compile", "orcamento": "budget", "exportar": "export",
                "otica": "optics", "pontuar": "score", "modelos": "models", "preferencias": "preferences",
                "cego": "blind", "resultado": "result", "recortar": "crop"}
OLD_OPTIONS = {"--retrato": "--snapshot", "--texto": "--text", "--tomadas": "--shots",
               "--custo-teste": "--test-cost", "--custo-final": "--final-cost", "--tentativas": "--attempts",
               "--reserva": "--reserve", "--tipo": "--type", "--buscar": "--search", "--importar": "--import",
               "--saida": "--out", "--modo": "--mode", "--calibrar": "--calibrate", "--arquivo": "--file",
               "--margem": "--margin", "--com": "--with", "--sem": "--without", "--chave": "--key",
               "--voto": "--vote", "--categoria": "--category", "--modelo": "--model", "--custo": "--cost",
               "--versao": "--version", "--referencia": "--reference", "--motivo": "--reason",
               "--avaliacao-x": "--evaluation-x", "--avaliacao-y": "--evaluation-y", "--avaliador": "--rater",
               "--primeiro": "--first", "--data": "--date"}
OLD_CATEGORIES = {"anuncio-produto": "product-ad", "cena-com-personagem": "character-scene",
                  "institucional": "corporate", "clipe": "music-video", "imagem": "image", "outro": "other"}
OLD_WORK_MODES = {"acompanhar": "follow", "preco": "price", "teto": "ceiling"}
OLD_CALIBRATE = {"sim": "yes", "nao": "no", "depois": "later"}
OLD_RATERS = {"cego-automatico": "blind-auto", "pessoa": "person", "nenhum": "none"}
OLD_OPTION_VALUES = {"--vote": {"empate": "tie"}, "--first": {"juntos": "together"}, "--rater": OLD_RATERS,
                     "--category": OLD_CATEGORIES, "--mode": OLD_WORK_MODES, "--calibrate": OLD_CALIBRATE}

_OLD_PROJECT = {"titulo": "title", "modelo": "model", "modo": "mode", "proporcao": "aspect_ratio",
                "resolucao": "resolution", "biblias": "bibles", "restricoes": "constraints",
                "referencias": "references", "preservar": "preserve", "alvo": "target", "eixo": "axis",
                "tomadas": "shots", "sujeito": "subject", "ambiente": "setting", "luz": "lighting",
                "estetica": "aesthetic"}
_OLD_PROJECT_MODES = {"imagem": "image"}
_OLD_BIBLE = {"tipo": "type", "descricao": "description", "fixo": "fixed", "variavel": "variable"}
_OLD_BIBLE_TYPES = {"produto": "product", "personagem": "character", "lugar": "place", "marca": "brand",
                    "objeto": "object"}
_OLD_SHOT = {"duracao": "duration", "entidades": "entities", "sujeito": "subject", "ambiente": "setting",
             "acao": "action", "microacao": "micro_action", "enquadramento": "framing", "otica": "optics",
             "luz": "lighting", "estetica": "aesthetic", "atmosfera": "atmosphere", "secundario": "secondary",
             "som": "sound", "falas": "dialogue", "inicio": "start", "fim": "end",
             "mudancas_aprovadas": "approved_changes", "cruzamento_motivado": "motivated_crossing",
             "linha_do_tempo": "timeline", "custo_teste": "test_cost", "custo_final": "final_cost",
             "tentativas": "attempts", "referencias": "references", "preservar": "preserve",
             "restricoes": "constraints", "alvo": "target"}
_OLD_DIALOGUE = {"quem": "speaker", "idioma": "language", "texto": "text"}
_OLD_TIMELINE = {"trilha": "track", "de": "from", "ate": "to"}
_OLD_EVALUATION = {"tipo": "type", "arquivo": "file", "criterios": "criteria", "falha_critica": "critical_failure"}
_OLD_EVALUATION_TYPES = {"resultado": "result"}
_OLD_CRITERIA = {"identidade": "identity", "movimento": "motion", "luz": "lighting", "materiais": "materials",
                 "continuidade": "continuity"}
_OLD_CRITERION = {"nota": "score", "evidencia": "evidence", "nao_se_aplica": "not_applicable"}
_OLD_PREFERENCES = {"modo": "mode", "calibrar": "calibrate", "atualizado_em": "updated_at"}
_OLD_SNAPSHOT = {"fonte": "source", "gerado_em": "generated_at", "modelos": "models"}
_OLD_MODEL = {"nome": "name", "fornecedor": "provider", "tipo": "type", "descricao": "description",
              "midias": "media", "modos": "modes", "parametros": "parameters", "proporcoes": "aspect_ratios",
              "resolucao": "resolution", "duracao": "duration", "audio_nas_tags": "audio_in_tags",
              "gerado_em": "generated_at"}
_OLD_MODEL_OPTION = {"parametro": "parameter", "opcoes": "options", "padrao": "default", "faixa": "range"}
_OLD_RECORD = {"formato": "format", "data": "date", "versao_skill": "skill_version", "categoria": "category",
               "modelo": "model", "tomadas": "shots", "custo_creditos": "cost_credits",
               "referencia_de_imagem": "image_reference", "voto": "vote", "avaliador": "rater",
               "motivo": "reason", "notas": "scores", "visto_primeiro": "seen_first"}
_OLD_VOTES = {"com": "with", "sem": "without", "empate": "tie"}
_OLD_SEEN_FIRST = {"com": "with", "sem": "without", "juntos": "together"}
_OLD_CONDITIONS = {"com": "with", "sem": "without"}
_OLD_SCORES = {"criterios": "criteria"}


# language-check: on
def _deprecated(old, new):
    _warn(f"deprecated: '{old}' is now '{new}'; {_REMOVAL}")


def translate_argv(argv):
    """The old subcommand, options and option values become the new ones, with one warning for each use."""
    out, command_seen, values, rest = [], False, None, False
    for tok in argv:
        if rest:
            out.append(tok)
            continue
        if tok == "--":
            rest = True
        elif values is not None:
            if tok in values:
                _deprecated(tok, values[tok])
                tok = values[tok]
            values = None
        elif tok.startswith("--"):
            name, eq, value = tok.partition("=")
            if name in OLD_OPTIONS:
                _deprecated(name, OLD_OPTIONS[name])
                name = OLD_OPTIONS[name]
            table = OLD_OPTION_VALUES.get(name)
            if table and eq and value in table:
                _deprecated(value, table[value])
                value = table[value]
            elif table and not eq:
                values = table
            tok = name + eq + value
        elif not command_seen and not tok.startswith("-"):
            command_seen = True
            if tok in OLD_COMMANDS:
                _deprecated(tok, OLD_COMMANDS[tok])
                tok = OLD_COMMANDS[tok]
        out.append(tok)
    return out


def _renamed(obj, table, where, found):
    """Copy of `obj` with the old keys of `table` renamed. The old and the new name of one field together is an
    error: there is no way to tell which one the author meant."""
    if not isinstance(obj, dict):
        return obj
    out = {}
    for k, v in obj.items():
        new = table.get(k)
        if new is None:
            out[k] = v
            continue
        if new in obj:
            raise Error(f"{where}: '{k}' is the old name of '{new}' and both are present; keep only '{new}'")
        found.add(k)
        out[new] = v
    return out


def _old_value(obj, field, table, found):
    if isinstance(obj, dict) and isinstance(obj.get(field), str) and obj[field] in table:
        found.add(obj[field])
        obj[field] = table[obj[field]]


def translate_project(p, where="project"):
    """(project with the new names, old names found). Attribute names inside start/end/fixed are the author's."""
    found = set()
    p = _renamed(p, _OLD_PROJECT, where, found)
    if not isinstance(p, dict):
        return p, found
    _old_value(p, "mode", _OLD_PROJECT_MODES, found)
    if isinstance(p.get("bibles"), dict):
        bibles = {}
        for k, b in p["bibles"].items():
            b = _renamed(b, _OLD_BIBLE, f"{where}: bible '{k}'", found)
            _old_value(b, "type", _OLD_BIBLE_TYPES, found)
            bibles[k] = b
        p["bibles"] = bibles
    if isinstance(p.get("shots"), list):
        shots = []
        for n, t in enumerate(p["shots"], 1):
            w = f"{where}: shot {n}"
            t = _renamed(t, _OLD_SHOT, w, found)
            if isinstance(t, dict):
                for field, table in (("dialogue", _OLD_DIALOGUE), ("timeline", _OLD_TIMELINE)):
                    if isinstance(t.get(field), list):
                        t[field] = [_renamed(x, table, f"{w}: {field}", found) for x in t[field]]
            shots.append(t)
        p["shots"] = shots
    return p, found


def translate_evaluation(x, where="evaluation"):
    found = set()
    x = _renamed(x, _OLD_EVALUATION, where, found)
    if not isinstance(x, dict):
        return x, found
    _old_value(x, "type", _OLD_EVALUATION_TYPES, found)
    if isinstance(x.get("criteria"), dict):
        criteria = _renamed(x["criteria"], _OLD_CRITERIA, f"{where}: criteria", found)
        x["criteria"] = {k: _renamed(c, _OLD_CRITERION, f"{where}: criterion '{k}'", found)
                         for k, c in criteria.items()}
    return x, found


def translate_preferences(d, where="preferences"):
    found = set()
    d = _renamed(d, _OLD_PREFERENCES, where, found)
    _old_value(d, "mode", OLD_WORK_MODES, found)
    _old_value(d, "calibrate", OLD_CALIBRATE, found)
    return d, found


def translate_snapshot(cat, where="snapshot"):
    found = set()
    cat = _renamed(cat, _OLD_SNAPSHOT, where, found)
    if isinstance(cat, dict) and isinstance(cat.get("models"), dict):
        models = {}
        for k, m in cat["models"].items():
            w = f"{where}: model '{k}'"
            m = _renamed(m, _OLD_MODEL, w, found)
            if isinstance(m, dict):
                for field in ("audio", "resolution", "duration"):
                    if isinstance(m.get(field), dict):
                        m[field] = _renamed(m[field], _OLD_MODEL_OPTION, f"{w}: {field}", found)
            models[k] = m
        cat["models"] = models
    return cat, found


def translate_key(k, where="key"):
    found = set()
    return _renamed(k, _OLD_CONDITIONS, where, found), found


def translate_record(d, where="record"):
    found = set()
    d = _renamed(d, _OLD_RECORD, where, found)
    if not isinstance(d, dict):
        return d, found
    _old_value(d, "category", OLD_CATEGORIES, found)
    _old_value(d, "vote", _OLD_VOTES, found)
    _old_value(d, "rater", OLD_RATERS, found)
    _old_value(d, "seen_first", _OLD_SEEN_FIRST, found)
    if isinstance(d.get("scores"), dict):
        scores = {}
        for cond, v in _renamed(d["scores"], _OLD_CONDITIONS, f"{where}: scores", found).items():
            v = _renamed(v, _OLD_SCORES, f"{where}: scores.{cond}", found)
            if isinstance(v, dict) and isinstance(v.get("criteria"), dict):
                v["criteria"] = _renamed(v["criteria"], _OLD_CRITERIA, f"{where}: scores.{cond}.criteria", found)
            scores[cond] = v
        d["scores"] = scores
    return d, found


def old_names_warning(where, found):
    return (f"{where}: read with old 5.x names ({', '.join(sorted(found))}); use the English names, "
            "the old names will be removed in 7.0")


def _translated(data, translator, where, warnings):
    """Translates on load. One warning per file: into `warnings` when the output has them, else on stderr."""
    data, found = translator(data, str(where))
    if found:
        msg = old_names_warning(where, found)
        if warnings is None:
            _warn(msg)
        else:
            warnings.append(msg)
    return data


def load_project(path, warnings=None):
    return _translated(read_json(path), translate_project, path, warnings)


def load_evaluation(path, warnings=None):
    return _translated(read_json(path), translate_evaluation, path, warnings)


def load_key(path, warnings=None):
    return _translated(read_json(path), translate_key, path, warnings)


# --------------------------------------------------------------------------- camera

_STATIC = re.compile(
    r"\b(static|locked[- ]?off|stationary|fixed|tripod|still)\s+(camera|shot|frame|framing)\b"
    r"|\b(locked[- ]?off|static shot|fixed camera|camera (?:is |stays |remains )?(?:static|still|fixed|locked))\b"
    r"|^\s*(static|locked[- ]?off|fixed)\s*$",
    re.I,
)
_MOVES = {
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
_MOVE_RE = {k: re.compile(r"\b(?:" + v + r")\b", re.I) for k, v in _MOVES.items()}
_NEGATION = re.compile(r"\b(no|not|without|never|avoid|zero|nor)\b|\bdon'?t\b", re.I)
_PHASE = re.compile(r"\bthen\b|\bafter that\b|\bfollowed by\b|\bfinally\b|\bbefore\b|->|→|;", re.I)
_SIMULTANEOUS = re.compile(r"\bwhile\b|\bas it\b|\bat the same time\b|\bsimultaneously\b|\band\b", re.I)


def _clause_moves(c):
    """Movements stated in a clause; what comes after a negation does not count."""
    m = _NEGATION.search(c)
    stated = c[: m.start()] if m else c
    return [k for k, r in _MOVE_RE.items() if r.search(stated)]


def check_camera(txt):
    """Returns (warnings, movements). Never refuses: a camera conflict is a warning with the phrase that caused it."""
    warnings, all_moves = [], []
    if not is_text(txt):
        return warnings, all_moves
    phases = [f for f in _PHASE.split(txt) if f.strip()]
    for phase in phases:
        clauses = [c for c in re.split(r",|\bbut\b|\.", phase) if c.strip()]
        static = any(_STATIC.search(c) for c in clauses)
        moves = []
        for c in clauses:
            moves += _clause_moves(c)
        moves = list(dict.fromkeys(moves))
        if static and moves:
            warnings.append(f'camera static and moving in the same phase: "{phase.strip()}" '
                            f"({', '.join(moves)}); split it into phases (\"static, then ...\") or pick one")
        if len([m for m in moves if m != "handheld"]) > 1 and (_SIMULTANEOUS.search(phase) or len(phases) == 1):
            warnings.append(f'more than one movement at the same time: "{phase.strip()}" ({", ".join(moves)}); '
                            "rule: one main movement per shot")
        all_moves += moves
    return warnings, list(dict.fromkeys(all_moves))


# --------------------------------------------------------------------------- models

def load_models(path=None, warnings=None):
    """The given snapshot (must exist) or the one shipped with the skill (if missing, an empty catalog)."""
    if path:
        cat = read_json(path)
    elif MODELS.exists():
        cat = read_json(MODELS)
    else:
        return {"generated_at": None, "models": {}}
    cat = _translated(cat, translate_snapshot, path or MODELS, warnings)
    if not isinstance(cat, dict) or not isinstance(cat.get("models"), dict):
        raise Error(f"{path or MODELS} is not a models snapshot (the 'models' object is missing)")
    return cat


def _normalize_model(m):
    ps = {p.get("name"): p for p in m.get("parameters") or [] if isinstance(p, dict)}
    dur = ps.get("duration") or {}
    duration = None
    if dur.get("options"):
        duration = {"options": dur["options"], "default": dur.get("default")}
    elif dur.get("min") is not None or dur.get("max") is not None:
        duration = {"min": dur.get("min"), "max": dur.get("max"), "default": dur.get("default")}
    elif m.get("duration_range"):
        duration = {"range": m["duration_range"]}
    audio = None
    for name in ("generate_audio", "sound"):
        if name in ps:
            audio = {"parameter": name, "default": ps[name].get("default"), "options": ps[name].get("options")}
            break
    res = ps.get("resolution") or ps.get("quality") or {}
    roles = sorted({r for md in m.get("medias") or [] if isinstance(md, dict)
                    for r in (md.get("roles") or []) if isinstance(r, str)})
    return {
        "id": m.get("id"),
        "name": m.get("name"),
        "provider": m.get("provider_name"),
        "type": m.get("output_type"),
        "description": m.get("description"),
        "aspect_ratios": m.get("aspect_ratios") or [],
        "duration": duration,
        "resolution": {"parameter": "resolution" if "resolution" in ps else "quality",
                       "options": res.get("options"), "default": res.get("default")} if res else None,
        "audio": audio,
        "audio_in_tags": any(t in ("audio", "sound") for t in m.get("tags") or []),
        "modes": (ps.get("mode") or {}).get("options"),
        "media": roles,
        "parameters": sorted(k for k in ps if k),
        "tags": m.get("tags") or [],
    }


def _duration_limits(d):
    """Reads direct limits or the range returned by some models of the catalog."""
    rng = d.get("range") if isinstance(d.get("range"), dict) else {}
    minimum = d.get("min") if d.get("min") is not None else rng.get("min")
    maximum = d.get("max") if d.get("max") is not None else rng.get("max")
    return minimum, maximum


def import_models(files, out, base=None):
    """Builds a new snapshot from the models_explore lists and writes it to `out`.

    Starts from the `base` snapshot (or the one shipped with the skill). Takes two models_explore formats:
    - `list` (a list of models): for each type present (video, image...), what is not in the list leaves the
      snapshot, because the connector's list is the truth for that type. All pages of a type go in the same command.
    - `get` (a single model): it is added or updated, without removing any other. This is how to validate the
      project against the live limits of the chosen model.
    """
    if not out:
        raise Error("use --out <file>: the new snapshot goes to a given path, never into the skill folder "
                    "unless asked")
    new, from_list = {}, {}
    for f in files:
        raw = read_json(f)
        single = isinstance(raw, dict) and is_text(raw.get("id")) and "items" not in raw
        items = [raw] if single else (raw.get("items") if isinstance(raw, dict) else raw)
        if not isinstance(items, list) or not items or not all(isinstance(m, dict) for m in items):
            raise Error(f"{f}: not a models_explore response (list with 'items', or get of one model)")
        for m in items:
            n = _normalize_model(m)
            if is_text(n["id"]):
                new[n["id"]] = n
                if not single:
                    from_list[n["id"]] = n
    if not new:
        raise Error("no model with an id in the imported lists")
    current = load_models(base)
    previous_date = current.get("generated_at")
    models = {}
    for k, m in current["models"].items():
        models[k] = dict(m) if isinstance(m, dict) else m
        if isinstance(models[k], dict) and previous_date and not models[k].get("generated_at"):
            models[k]["generated_at"] = previous_date
    imported_types = {n["type"] for n in from_list.values()}
    removed = sorted(k for k, m in models.items() if isinstance(m, dict) and m.get("type") in imported_types
                     and k not in new)
    for k in removed:
        del models[k]
    today = _dt.date.today().isoformat()
    for n in new.values():
        n["generated_at"] = today
    models.update(new)
    dates = [m.get("generated_at") for m in models.values() if isinstance(m, dict) and m.get("generated_at")]
    snapshot = {"generated_at": min(dates) if dates else today, "models": models,
                "source": "Higgsfield connector, models_explore list/get (imported by hfd.py models --import)"}
    dest = Path(out)
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    except OSError as e:
        raise Error(f"could not write {dest}: {e}")
    types = {}
    for n in new.values():
        types[n["type"]] = types.get(n["type"], 0) + 1
    return {"out": str(dest), "imported": len(new), "by_type": types, "removed": removed,
            "total_in_snapshot": len(models), "generated_at": snapshot["generated_at"]}


def check_model(p, catalog):
    """Errors and warnings of the project against the catalog snapshot."""
    errors, warnings = [], []
    mid = p.get("model")
    date = catalog.get("generated_at")
    if not is_text(mid):
        warnings.append("no 'model': pick one in the live catalog (models_explore) before estimating the cost")
        return errors, warnings, None
    m = catalog.get("models", {}).get(mid)
    if not m:
        warnings.append(f"model '{mid}' is not in the snapshot of {date}; check the id live (models_explore get). "
                        "Until it is imported, only model, duration and aspect ratio are sent: no resolution, no "
                        "audio, no mode")
        return errors, warnings, None
    date = m.get("generated_at") or date
    if p.get("mode") == "image" and m["type"] != "image":
        errors.append(f"image mode with a {m['type']} model ({mid})")
    if p.get("mode") in ("t2v", "i2v", "edit", "extend") and m["type"] != "video":
        errors.append(f"{p.get('mode')} mode with a {m['type']} model ({mid})")
    ratio = p.get("aspect_ratio")
    if ratio and m["aspect_ratios"] and ratio not in m["aspect_ratios"]:
        errors.append(f"aspect ratio {ratio} not accepted by {mid} (accepts: {', '.join(m['aspect_ratios'])})")
    res = p.get("resolution")
    if res and m.get("resolution") and m["resolution"].get("options") and res not in m["resolution"]["options"]:
        errors.append(f"resolution {res} not accepted by {mid} "
                      f"(accepts: {', '.join(map(str, m['resolution']['options']))})")
    if res and not m.get("resolution"):
        warnings.append(f"{mid} has no resolution parameter in the snapshot, so resolution {res} is not sent; its "
                        f"quality may be another parameter ({', '.join(m.get('parameters') or []) or 'none listed'}): "
                        "check models_explore get")
    if p.get("mode") == "i2v" and m["media"] and not ({"start_image", "image", "image_references"} & set(m["media"])):
        errors.append(f"{mid} does not take a start image; i2v needs another model")
    if p.get("mode") in ("edit", "extend") and not _mode_name(p["mode"], m):
        errors.append(f"{mid} has no {p['mode']} mode in the snapshot (modes: "
                      f"{', '.join(m.get('modes') or []) or 'none listed'}); {p['mode']} needs another model")
    d = m.get("duration") or {}
    minimum, maximum = _duration_limits(d)
    for t in p.get("shots") or []:
        if not isinstance(t, dict) or not is_number(t.get("duration")):
            continue
        dur = t["duration"]
        if d.get("options") and dur not in d["options"]:
            errors.append(f"{t.get('id')}: {dur} s is not an option of {mid} (options: {d['options']})")
        if maximum is not None and dur > maximum:
            errors.append(f"{t.get('id')}: {dur} s is above the maximum of {mid} ({maximum} s)")
        if minimum is not None and minimum > 0 and dur < minimum:
            errors.append(f"{t.get('id')}: {dur} s is below the minimum of {mid} ({minimum} s)")
        if _wants_audio(t) and not (m.get("audio") or m.get("audio_in_tags")):
            warnings.append(f"{t.get('id')}: {mid} shows no native audio in the snapshot; sound goes to "
                            "post-production")
    if len(p.get("shots") or []) > 1 and "multi_shots" not in m.get("parameters", []):
        warnings.append(f"{mid} has no multi-shot in the snapshot: each shot is a separate generation")
    if date:
        age = (_dt.date.today() - _dt.date.fromisoformat(date)).days
        if age > 30:
            warnings.append(f"models snapshot is {age} days old; update it (references/models.md)")
    return errors, warnings, m


# --------------------------------------------------------------------------- validation

def _entities(t):
    e = t.get("entities") or []
    return e if isinstance(e, list) else []


def _list_of(v, kind):
    return isinstance(v, list) and all(isinstance(x, kind) for x in v)


def _point(v):
    return isinstance(v, list) and len(v) == 2 and all(is_number(x) for x in v)


def shape(p):
    """Type errors. The rest of the validation assumes these formats; if any fails, it stops here."""
    errors = []
    bibles = p.get("bibles")
    if bibles is not None:
        if not isinstance(bibles, dict):
            errors.append("'bibles' must be an object {id: entry}")
        else:
            for k, b in bibles.items():
                if not isinstance(b, dict):
                    errors.append(f"bible entry '{k}' must be an object")
                elif b.get("fixed") is not None and not isinstance(b["fixed"], dict):
                    errors.append(f"bible entry '{k}': 'fixed' must be an object {{attribute: value}}")
    for field in ("constraints", "preserve"):
        if p.get(field) is not None and not _list_of(p[field], str):
            errors.append(f"'{field}' must be a list of strings")
    if p.get("axis") is not None and not (isinstance(p["axis"], list) and len(p["axis"]) == 2
                                          and all(_point(x) for x in p["axis"])):
        errors.append("'axis' must be [[x1, y1], [x2, y2]] with numbers")
    for n, t in enumerate(p["shots"], 1):
        if not isinstance(t, dict):
            errors.append(f"shot {n}: must be an object")
            continue
        tid = t.get("id") if is_text(t.get("id")) else f"shot {n}"
        for field in ("entities", "approved_changes", "constraints", "preserve"):
            if t.get(field) is not None and not _list_of(t[field], str):
                errors.append(f"{tid}: '{field}' must be a list of strings")
        for field in ("dialogue", "timeline"):
            if t.get(field) is not None and not _list_of(t[field], dict):
                errors.append(f"{tid}: '{field}' must be a list of objects")
        for field in ("start", "end"):
            v = t.get(field)
            if v is not None and not (isinstance(v, dict) and all(isinstance(a, dict) for a in v.values())):
                errors.append(f"{tid}: '{field}' must be an object {{entity: {{attribute: value}}}}")
        if t.get("camera_xy") is not None and not _point(t["camera_xy"]):
            errors.append(f"{tid}: 'camera_xy' must be [x, y] with numbers")
    return errors


def continuity(p):
    errors, warnings = [], []
    bibles = p.get("bibles") or {}
    last = {}  # entity -> (shot, state)
    shots = [t for t in p.get("shots") or [] if isinstance(t, dict)]
    for i, t in enumerate(shots):
        tid = t.get("id")
        for ent in _entities(t) + list((t.get("start") or {}).keys()) + list((t.get("end") or {}).keys()):
            if ent not in bibles:
                errors.append(f"{tid}: entity '{ent}' has no entry in 'bibles'")
        for phase in ("start", "end"):
            for ent, attrs in (t.get(phase) or {}).items():
                fixed = (bibles.get(ent) or {}).get("fixed") or {}
                for k, v in (attrs or {}).items():
                    if k in fixed and fixed[k] != v:
                        errors.append(f"{tid} {phase}: {ent}.{k} = {v!r}, but the bible fixes {fixed[k]!r}")
        approved = set(t.get("approved_changes") or [])
        for ent, attrs in (t.get("start") or {}).items():
            if ent in last:
                who, before = last[ent]
                for k, v in (attrs or {}).items():
                    if k in before and before[k] != v and f"{ent}.{k}" not in approved:
                        errors.append(f"{tid}: {ent}.{k} starts {v!r}, but ended {before[k]!r} in {who} "
                                      f"(if it is on purpose, put \"{ent}.{k}\" in approved_changes)")
        for ent, attrs in (t.get("start") or {}).items():
            base = dict(last.get(ent, (None, {}))[1])
            base.update(attrs or {})
            last[ent] = (tid, base)
        if t.get("end"):
            for ent, attrs in t["end"].items():
                base = dict(last.get(ent, (None, {}))[1])
                base.update(attrs or {})
                last[ent] = (tid, base)
        elif t.get("start") and i + 1 < len(shots):
            warnings.append(f"{tid}: no 'end'; the next shot will be checked against this one's 'start'")
    return errors, warnings


def axis(p):
    """180° rule: warns when the camera changes sides of the axis without a stated reason."""
    warnings = []
    ax = p.get("axis")
    if not ax:
        return warnings
    (x1, y1), (x2, y2) = ax  # format already checked in shape()
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return ["'axis' is degenerate (two equal points)"]
    side = None
    for t in p.get("shots") or []:
        xy = t.get("camera_xy") if isinstance(t, dict) else None
        if not xy:
            continue
        x, y = xy
        cross = dx * (y - y1) - dy * (x - x1)
        s = (cross > 0) - (cross < 0)
        if s and side and s != side and not t.get("motivated_crossing"):
            warnings.append(f"{t.get('id')}: camera crossed the axis of action (180° rule); "
                            "set motivated_crossing if it is intentional")
        if s:
            side = s
    return warnings


def validate(p, catalog=None):
    catalog = catalog if catalog is not None else load_models()
    errors, warnings = [], []
    if not isinstance(p, dict):
        return {"errors": ["the project must be a JSON object"], "warnings": []}
    mode = p.get("mode", "t2v")
    if mode not in MODES:
        errors.append(f"mode '{mode}' is invalid (use {', '.join(MODES)})")
    shots = p.get("shots")
    if not isinstance(shots, list) or not shots:
        return {"errors": errors + ["'shots' is required: a non-empty list of shots"], "warnings": warnings}
    shape_errors = shape(p)
    if shape_errors:
        return {"errors": errors + shape_errors, "warnings": warnings}
    ids = set()
    for t in shots:
        tid = t.get("id")
        if not is_text(tid) or tid in ids:
            errors.append(f"shot without an id or with a repeated id: {tid!r}")
        else:
            ids.add(tid)
        subject = is_text(t.get("subject")) or is_text(p.get("subject")) or _entity_descriptions(p, t) or \
            (mode == "i2v" and _entities(t))
        if not subject:
            errors.append(f"{tid}: missing subject ('subject' field, or 'entities' whose bible entry has a "
                          "'description')")
        if mode == "edit" and not (is_text(t.get("target")) or is_text(p.get("target"))):
            errors.append(f"{tid}: edit mode needs a 'target': what changes in the clip")
        if mode != "image":
            if not is_number(t.get("duration")) or t["duration"] <= 0:
                errors.append(f"{tid}: 'duration' in seconds is required")
            if not is_text(t.get("action")):
                errors.append(f"{tid}: missing 'action' (one dominant action)")
        else:
            for k in ("duration", "camera", "sound", "dialogue", "timeline"):
                if t.get(k):
                    warnings.append(f"{tid}: '{k}' does not apply to a still image; it will be ignored")
            for k in ("action", "micro_action", "secondary", "final"):
                if is_text(t.get(k)):
                    warnings.append(f"{tid}: '{k}' is not used for a still image; write what the image shows in "
                                    "'subject' or 'setting'")
        cw, _ = check_camera(t.get("camera", ""))
        warnings += [f"{tid}: {w}" for w in cw]
        dialogue = t.get("dialogue") or []
        words = sum(len(str(d.get("text", "")).split()) for d in dialogue if isinstance(d, dict))
        if dialogue and is_number(t.get("duration")) and words > WORDS_PER_SECOND * t["duration"]:
            warnings.append(f"{tid}: {words} words of dialogue do not fit in {t['duration']} s "
                            f"(~{int(WORDS_PER_SECOND * t['duration'])} at most); shorten it or lengthen the shot")
        for d in dialogue:
            if not is_text(d.get("speaker")):
                errors.append(f"{tid}: every dialogue line needs a 'speaker' (the character's label)")
        tracks = {}
        for ev in t.get("timeline") or []:
            a, b, tr = ev.get("from"), ev.get("to"), ev.get("track")
            if not is_text(tr) or not is_number(a) or not is_number(b) or not (0 <= a < b) or \
                    (is_number(t.get("duration")) and b > t["duration"]):
                errors.append(f"{tid}: invalid timeline event: {ev}")
                continue
            for c, z in tracks.get(tr, []):
                if a < z and c < b:
                    errors.append(f"{tid}: overlapping events on track '{tr}' ({c}-{z} and {a}-{b})")
            tracks.setdefault(tr, []).append((a, b))
        if mode in ("i2v", "edit", "extend") and not (t.get("references") or p.get("references")):
            warnings.append(f"{tid}: {mode} mode needs a reference (image/video) before generating")
    e, w = continuity(p)
    errors += e
    warnings += w
    warnings += axis(p)
    e, w, _ = check_model(p, catalog)
    errors += e
    warnings += w
    return {"errors": errors, "warnings": warnings}


# --------------------------------------------------------------------------- compilation

def _entity_descriptions(p, t):
    bibles = p.get("bibles") or {}
    out = []
    for ent in _entities(t):
        b = bibles.get(ent) or {}
        if is_text(b.get("description")):
            out.append(b["description"])
    return out


MODE_NAMES = {"i2v": ("omni_reference", "image-to-video", "i2v"), "edit": ("video_edit", "video-edit", "edit"),
              "extend": ("video_extension", "extend")}


def _mode_name(mode, model):
    """The model's own name for a mode (it changes from model to model); the first one that exists wins."""
    return next((n for n in MODE_NAMES[mode] if n in (model.get("modes") or [])), None)


def _wants_audio(t):
    """Sound or a dialogue line with real text: a blank field turns no audio on."""
    return is_text(t.get("sound")) or any(isinstance(d, dict) and is_text(d.get("text"))
                                          for d in (t.get("dialogue") or []))


def compile_shot(p, t, model=None):
    mode = p.get("mode", "t2v")
    parts = []
    if mode == "i2v":
        keep = list(dict.fromkeys((p.get("preserve") or []) + (t.get("preserve") or [])))
        parts.append("The reference image is the opening frame" +
                     (f"; preserve {', '.join(keep)}" if keep else "") + ".")
    elif mode == "edit":
        parts.append(f"Change only {t.get('target') or p.get('target') or 'the specified target'}; "
                     "preserve everything else exactly as it is.")
    elif mode == "extend":
        parts.append("Continue seamlessly from the final frame of the previous clip.")
    if mode == "i2v":
        # in image to video the image already brings subject and scene: the text focuses on motion and camera
        scene_fields = []
    else:
        described = _entity_descriptions(p, t)
        scene_fields = described + [t.get("subject") or ("" if described else p.get("subject", "")),
                                    t.get("setting") or p.get("setting", "")]
    temporal = ["action", "micro_action"] if mode != "image" else []
    order = scene_fields + [t.get(k, "") for k in temporal] + [t.get("framing", "")]
    if mode != "image":
        order.append(t.get("camera", ""))
    order += [t.get("optics", ""), t.get("lighting", "") or p.get("lighting", ""),
              t.get("aesthetic", "") or p.get("aesthetic", ""), t.get("atmosphere", "")]
    if mode != "image":
        order += [t.get("secondary", ""), t.get("final", "")]
    parts += [sentence(x) for x in order if is_text(x)]
    parts += [sentence(x) for x in (p.get("constraints") or []) + (t.get("constraints") or []) if is_text(x)]
    audio = []
    if mode != "image":
        if is_text(t.get("sound")):
            audio.append(sentence(t["sound"]))
        for d in t.get("dialogue") or []:
            if isinstance(d, dict) and is_text(d.get("text")):
                language = f" in {d['language']}" if is_text(d.get("language")) else ""
                audio.append(f'{d.get("speaker", "A character")} says{language}: "{d["text"].strip()}"')
    prompt = " ".join(parts)
    if audio:
        prompt += "\n\nAudio: " + " ".join(audio)
    params = {}
    if model:
        params["model"] = model["id"]
        if mode != "image" and is_number(t.get("duration")):
            params["duration"] = t["duration"]
        if p.get("aspect_ratio"):
            params["aspect_ratio"] = p["aspect_ratio"]
        if p.get("resolution") and model.get("resolution"):
            params[model["resolution"]["parameter"]] = p["resolution"]
        wants_audio = _wants_audio(t)
        if model.get("audio") and mode != "image":
            a = model["audio"]
            params[a["parameter"]] = (("on" if wants_audio else "off") if a.get("options") == ["on", "off"]
                                      else wants_audio)
        if mode in ("i2v", "edit", "extend") and _mode_name(mode, model):
            params["mode"] = _mode_name(mode, model)
    elif p.get("model"):
        params = {"model": p["model"], "aspect_ratio": p.get("aspect_ratio")}
        if mode != "image":
            params["duration"] = t.get("duration")
    return {"id": t.get("id"), "prompt": prompt, "parameters": {k: v for k, v in params.items() if v is not None},
            "references": t.get("references") or p.get("references") or []}


def compile_project(p, catalog=None):
    catalog = catalog if catalog is not None else load_models()
    report = validate(p, catalog)
    if report["errors"]:
        return report
    _, _, model = check_model(p, catalog)
    model_date = (model or {}).get("generated_at") or catalog.get("generated_at")
    return {**report, "model": p.get("model"), "models_snapshot": model_date,
            "shots": [compile_shot(p, t, model) for t in p["shots"]]}


# --------------------------------------------------------------------------- budget, optics, score

def budget(shots, reserve=20.0, attempts=None):
    """Total in credits. `attempts` (from the command line) applies to the shots that do not bring their own."""
    if not is_number(reserve) or reserve < 0:
        raise Error("invalid reserve")
    if not isinstance(shots, list) or not shots or not all(isinstance(t, dict) for t in shots):
        raise Error("'shots' must be a non-empty list of objects")
    default = attempts if attempts is not None else 2
    lines, warnings, base = [], [], 0.0
    for t in shots:
        tc, fc = t.get("test_cost"), t.get("final_cost")
        n = t.get("attempts", default)
        if not is_number(tc) or not is_number(fc) or tc < 0 or fc < 0:
            raise Error(f"{t.get('id')}: no test_cost/final_cost. Run the connector's estimate "
                        "(estimate_video_cost / estimate_image_cost) and fill them in; do not invent a price")
        if type(n) is not int or not 0 <= n <= 10**9:
            raise Error(f"{t.get('id')}: attempts must be an integer between 0 and 1000000000")
        if attempts is not None and "attempts" in t and n != attempts:
            warnings.append(f"{t.get('id')}: the shot's own attempts={n} applies, not --attempts {attempts}")
        sub = round(n * tc + fc, 2)
        lines.append({"id": t.get("id"), "attempts": n, "test_cost": tc, "final_cost": fc, "subtotal": sub})
        base += sub
    base = round(base, 2)
    kept = round(base * reserve / 100, 2)
    return {"shots": lines, "base": base, "reserve_pct": reserve, "reserve": kept,
            "total": round(base + kept, 2), "warnings": warnings,
            "reminder": "the cost is the connector's estimate; generate only after the operator's ok with this total"}


def optics(f, d, n=2.8, sensor=36.0, coc=0.03):
    if not all(is_number(x) and x > 0 for x in (f, d, n, sensor, coc)):
        raise Error("use positive numbers: focal length (mm), distance (m), aperture")
    s = d * 1000
    if s <= f:
        raise Error("the distance must be greater than the focal length")
    h = f * f / (n * coc)
    near = s * h / (h + (s - f))
    far = s * h / (h - (s - f)) if h > (s - f) else None
    return {"horizontal_fov_degrees": round(math.degrees(2 * math.atan(sensor / (2 * f))), 2),
            "frame_width_m": round((s - f) * sensor / f / 1000, 3),
            "focus_from_m": round(near / 1000, 3),
            "focus_to_m": round(far / 1000, 3) if far else "infinity",
            "hyperfocal_m": round((h + f) / 1000, 2),
            "note": "thin lens, full-frame 36 mm sensor; describes the look, it is not a model parameter"}


def score(x):
    weights = read_json(DATA / "weights.json")
    if not isinstance(x, dict):
        raise Error("the evaluation must be a JSON object (see templates/evaluation.json)")
    if x.get("type") not in ("prompt", "result"):
        raise Error("type must be 'prompt' or 'result'")
    if x["type"] == "result" and not is_text(x.get("file")):
        raise Error("a result score requires 'file' (what was watched)")
    crit = x.get("criteria") or {}
    if not isinstance(crit, dict):
        raise Error("'criteria' must be an object {criterion: {score, evidence}}")
    unknown = sorted(set(crit) - set(weights))
    if unknown:
        raise Error(f"unknown criteria {unknown} (criteria: {', '.join(weights)})")
    total = den = 0.0
    missing = []
    for k, w in weights.items():
        c = crit.get(k)
        if c is None:
            missing.append(k)
            continue
        if not isinstance(c, dict):
            raise Error(f"{k}: must be an object with 'score' and 'evidence'")
        if not is_text(c.get("evidence")):
            raise Error(f"{k}: evidence is required (what was seen, at which second)")
        v = c.get("score")
        if v is None:
            if not is_text(c.get("not_applicable")):
                raise Error(f"{k}: no score requires 'not_applicable' with the reason")
            continue
        if not is_number(v) or not 0 <= v <= 10:
            raise Error(f"{k}: score from 0 to 10")
        total += w * v / 10
        den += w
    if missing:
        raise Error("missing criteria: " + ", ".join(missing))
    if not den:
        raise Error("no applicable criterion")
    value = round(total / den * 100, 1)
    if x.get("critical_failure"):
        verdict = "blocked (critical failure)"
    else:
        verdict = ("excellent" if value >= 90 else "approved with adjustments" if value >= 80
                   else "revise" if value >= 65 else "rejected")
    return {"type": x["type"], "score": value, "verdict": verdict}


# --------------------------------------------------------------------------- working mode and calibration

WORK_MODES = ("follow", "price", "ceiling")
CALIBRATE = ("yes", "no", "later")
PREFERENCES = Path(".higgsfield-director") / "preferences.json"
OLD_PREFERENCES = Path(".higgsfield-director") / "preferencias.json"
CATEGORIES = ("product-ad", "character-scene", "trailer", "corporate", "music-video", "loop", "image", "other")
FORMAT_FIELDS = ("model", "duration", "aspect_ratio", "resolution", "quality", "mode", "generate_audio", "sound")
QUESTION = ("Before we start: how do you prefer to work? (a) follow and approve each step, seeing every preview, "
            "image and video; (b) see only the total price and give one ok; (c) give me a credit ceiling per session "
            "and not be asked. In every mode I show what each step costs and the total spent so far.")
REMINDER = ("the file stores how to work, never how much to spend: authorization to spend only comes from the "
            "conversation (references/modes.md)")
RECORD_FIELDS = {"format", "date", "skill_version", "category", "model", "shots", "cost_credits",
                 "image_reference", "vote", "rater", "reason", "scores", "seen_first"}
OPTIONAL_RECORD_FIELDS = {"reason", "scores", "seen_first"}


def _real_date(s):
    try:
        _dt.date.fromisoformat(s)
        return True
    except ValueError:
        return False


def preferences(file=None, mode=None, calibrate=None):
    path = Path(file) if file else PREFERENCES
    source = path
    if not file and not path.exists() and OLD_PREFERENCES.exists():
        source = OLD_PREFERENCES
        _warn(f"read {OLD_PREFERENCES}, the old name of {PREFERENCES}; the next write goes to {PREFERENCES} "
              f"({_REMOVAL})")
    current = {}
    if source.exists():
        current = read_json(source)
        if not isinstance(current, dict):
            raise Error(f"{source}: must be a JSON object")
        current = _translated(current, translate_preferences, source, None)
        extras = sorted(set(current) - {"mode", "calibrate", "updated_at"})
        if extras:
            raise Error(f"{source}: unknown fields {extras}; the file stores only how to work, "
                        "never how much to spend")
        if "calibrate" in current and current["calibrate"] not in CALIBRATE:
            raise Error(f"{source}: 'calibrate' must be one of {', '.join(CALIBRATE)}")
        if "updated_at" in current and not (isinstance(current["updated_at"], str)
                                            and re.fullmatch(r"\d{4}-\d{2}-\d{2}", current["updated_at"])):
            raise Error(f"{source}: 'updated_at' must be a date, YYYY-MM-DD")
    if mode is None and calibrate is None:
        defined = current.get("mode") in WORK_MODES
        r = {"defined": defined, "file": str(source)}
        r.update({k: current[k] for k in ("mode", "calibrate", "updated_at") if k in current})
        if not defined:
            r["question"] = QUESTION
        r["reminder"] = REMINDER
        return r
    if mode is not None and mode not in WORK_MODES:
        raise Error(f"--mode must be one of: {', '.join(WORK_MODES)}")
    if calibrate is not None and calibrate not in CALIBRATE:
        raise Error(f"--calibrate must be one of: {', '.join(CALIBRATE)}")
    new = dict(current)
    if mode:
        new["mode"] = mode
    if calibrate:
        new["calibrate"] = calibrate
    if new.get("mode") not in WORK_MODES:
        raise Error("set --mode too (follow, price or ceiling)")
    new["updated_at"] = _dt.date.today().isoformat()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(new, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    except OSError as e:
        raise Error(f"could not write {path}: {e}")
    return {"defined": True, "file": str(path), **new, "reminder": REMINDER}


def _requests(x, name):
    items = x.get("requests") if isinstance(x, dict) else x
    if not isinstance(items, list) or not items:
        raise Error(f"{name}: must be a list of requests or {{\"requests\": [...]}}")
    out = []
    for i, r in enumerate(items, 1):
        p = r.get("params", r) if isinstance(r, dict) else None
        if not isinstance(p, dict) or not is_text(p.get("model")):
            raise Error(f"{name}: request {i} has no 'model'")
        out.append({k: v for k, v in p.items() if k != "count"})
    return out


def blind(with_requests, without_requests, folder, draw=None, order=None):
    """Checks that both conditions ask for the same format, draws who is X and who is Y and, separately, who is
    shown first (whoever is seen first tends to be chosen; the separate draw spreads that effect)."""
    a, b = _requests(with_requests, "--with"), _requests(without_requests, "--without")
    errors = []
    if len(a) != len(b):
        errors.append(f"--with has {len(a)} requests and --without has {len(b)}: both conditions generate the same "
                      "number of shots")
    for i, (x, y) in enumerate(zip(a, b), 1):
        for k in FORMAT_FIELDS:
            if x.get(k) != y.get(k):
                errors.append(f"shot {i}: '{k}' differs ({x.get(k)!r} with the skill, {y.get(k)!r} without); format "
                              "and price must be the same in both conditions")
    if errors:
        return {"errors": errors}
    folder = Path(folder)
    key_file = folder / "blind-key.json"
    # language-check: off  (the key's name before 6.0)
    if (folder / "chave-cega.json").exists():
        raise Error(f"{folder / 'chave-cega.json'} already exists (the key's name before 6.0): one draw per round")
    # language-check: on
    if key_file.exists():
        raise Error(f"{key_file} already exists: one draw per round; use another folder")
    with_is_x = (secrets.randbelow(2) if draw is None else draw) == 0
    first = "XY"[secrets.randbelow(2) if order is None else order]
    key = {"with": "X" if with_is_x else "Y", "without": "Y" if with_is_x else "X"}
    requests = []
    for cond, items in (("with", a), ("without", b)):
        base = 10 if key[cond] == "X" else 20
        requests += [{"index": base + i, "params": p} for i, p in enumerate(items, 1)]
    requests.sort(key=lambda r: r["index"])
    try:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "blind-requests.json").write_text(json.dumps(requests, ensure_ascii=False, indent=1) + "\n",
                                                    encoding="utf-8")
        fd = os.open(key_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(key, f)
    except OSError as e:
        raise Error(f"could not write to {folder}: {e}")
    return {"errors": [], "requests": len(requests), "requests_file": str(folder / "blind-requests.json"),
            "key": f"{key_file} (do not open it before the vote)",
            "indices": "10+n are the shots of X; 20+n, those of Y",
            "show_first": first,
            "how_to_show": f"{first} first (on the left, or played first); then both together, side by side"}


def check_record(d):
    """Allowlist of the calibration record: what is not here does not go into the repository."""
    if not isinstance(d, dict):
        return ["the record must be a JSON object"]
    e = []
    extras = sorted(set(d) - RECORD_FIELDS)
    if extras:
        e.append(f"fields outside the allowlist: {extras} (prompts, media, names and clients never go in)")
    missing = sorted(RECORD_FIELDS - OPTIONAL_RECORD_FIELDS - set(d))
    if missing:
        e.append(f"required fields missing: {missing}")
    if d.get("format") != 1:
        e.append("'format' must be 1")
    if not (isinstance(d.get("date"), str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", d["date"]) and _real_date(d["date"])):
        e.append("'date' in the format YYYY-MM-DD, a real date")
    if not (isinstance(d.get("skill_version"), str)
            and re.fullmatch(r"\d+\.\d+\.\d+(\+[0-9a-f]{7,12})?", d["skill_version"])):
        e.append("'skill_version' like 5.1.0 or 5.1.0+<commit>")
    if d.get("category") not in CATEGORIES:
        e.append(f"'category' must be one of: {', '.join(CATEGORIES)}")
    if not (isinstance(d.get("model"), str) and re.fullmatch(r"[a-z0-9][a-z0-9_.-]{1,63}", d["model"])):
        e.append("'model' is the catalog id (lowercase, digits, _ . -)")
    t = d.get("shots")
    if not (type(t) is int and 1 <= t <= 30):
        e.append("'shots' an integer from 1 to 30 (per condition)")
    c = d.get("cost_credits")
    if not (is_number(c) and 0 <= c <= 100000):
        e.append("'cost_credits' a number from 0 to 100000")
    if not isinstance(d.get("image_reference"), bool):
        e.append("'image_reference' true or false")
    if d.get("vote") not in ("with", "without", "tie"):
        e.append("'vote' must be with, without or tie")
    if d.get("rater") not in ("blind-auto", "person", "none"):
        e.append("'rater' must be blind-auto, person or none")
    if "seen_first" in d and d["seen_first"] not in ("with", "without", "together"):
        e.append("'seen_first' must be with, without or together")
    if "reason" in d:
        m = d["reason"]
        if not (isinstance(m, str) and 1 <= len(m.strip()) <= 160):
            e.append("'reason' with 1 to 160 characters")
        elif re.search(r"https?:|www\.|@|\d{5,}", m, re.I):
            e.append("'reason' cannot have a link, an email, an @ or a long number")
    if "scores" in d:
        n = d["scores"]
        weights = read_json(DATA / "weights.json")
        if not (isinstance(n, dict) and n and set(n) <= {"with", "without"}):
            e.append("'scores' must have 'with' and/or 'without'")
        else:
            for cond, v in n.items():
                if not (isinstance(v, dict) and set(v) <= {"total", "criteria"} and is_number(v.get("total"))
                        and 0 <= v["total"] <= 100):
                    e.append(f"'scores.{cond}' needs a 'total' from 0 to 100 (and, optionally, 'criteria')")
                    continue
                cr = v.get("criteria", {})
                if not (isinstance(cr, dict) and set(cr) <= set(weights)
                        and all(is_number(x) and 0 <= x <= 10 for x in cr.values())):
                    e.append(f"'scores.{cond}.criteria' only with {', '.join(weights)}, from 0 to 10")
    return e


def result(key, vote, category, model, shots, cost, version, reference=False, reason=None,
           evaluation_x=None, evaluation_y=None, rater=None, date=None, first=None):
    if not (isinstance(key, dict) and set(key) == {"with", "without"} and sorted(key.values()) == ["X", "Y"]):
        raise Error("invalid key: expected {\"with\": \"X\" or \"Y\", \"without\": the other}")
    if vote not in ("X", "Y", "tie"):
        raise Error("--vote must be X, Y or tie")
    cond = {v: k for k, v in key.items()}
    rec = {"format": 1, "date": date or _dt.date.today().isoformat(), "skill_version": version,
           "category": category, "model": model, "shots": shots, "cost_credits": cost,
           "image_reference": bool(reference), "vote": "tie" if vote == "tie" else cond[vote],
           "rater": rater or ("blind-auto" if evaluation_x else "none")}
    if first:
        if first not in ("X", "Y", "together"):
            raise Error("--first must be X, Y or together")
        rec["seen_first"] = "together" if first == "together" else cond[first]
    if reason:
        rec["reason"] = reason.strip()
    if evaluation_x or evaluation_y:
        if not (evaluation_x and evaluation_y):
            raise Error("use --evaluation-x and --evaluation-y together")
        rec["scores"] = {}
        for letter, ev in (("X", evaluation_x), ("Y", evaluation_y)):
            total = score(ev)["score"]
            crit = {k: round(c["score"], 1) for k, c in (ev.get("criteria") or {}).items()
                    if isinstance(c, dict) and is_number(c.get("score"))}
            rec["scores"][cond[letter]] = {"total": total, "criteria": crit}
    return rec, check_record(rec)


# --------------------------------------------------------------------------- export

def _csv_safe(v):
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


def _timestamp(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def export(p, folder, catalog=None):
    c = compile_project(p, catalog)
    if c.get("errors"):
        return c
    out = Path(folder)
    out.mkdir(parents=True, exist_ok=True)
    by_id = {t["id"]: t for t in p["shots"]}
    start = 0.0
    md = [f"# {p.get('title', 'Script')}", "",
          f"Model: `{p.get('model', '?')}` · mode {p.get('mode', 't2v')} · "
          f"aspect ratio {p.get('aspect_ratio', '?')} · models snapshot of {c.get('models_snapshot')}", "",
          "| Shot | From | To | Action | Camera |", "|---|---|---|---|---|"]
    srt, n = [], 0
    with (out / "shots.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "start_s", "end_s", "duration_s", "prompt", "parameters"])
        for tc in c["shots"]:
            t = by_id[tc["id"]]
            dur = float(t["duration"]) if is_number(t.get("duration")) else 0.0
            end = start + dur
            w.writerow([_csv_safe(tc["id"]), start, end, dur, _csv_safe(tc["prompt"]),
                        _csv_safe(json.dumps(tc["parameters"], ensure_ascii=False))])
            cell = lambda s: str(s or "").replace("|", "/").replace("\n", " ")
            md.append(f"| {tc['id']} | {start:g} | {end:g} | {cell(t.get('action'))} | {cell(t.get('camera'))} |")
            # several dialogue lines split the shot into consecutive segments, proportional to their word count
            lines = [d for d in t.get("dialogue") or [] if isinstance(d, dict) and is_text(d.get("text"))]
            weights = [len(d["text"].split()) for d in lines]
            frm = start
            for i, d in enumerate(lines if dur > 0 else []):
                to = end if i == len(lines) - 1 else frm + dur * weights[i] / sum(weights)
                n += 1
                srt.append(f"{n}\n{_timestamp(frm)} --> {_timestamp(to)}\n{d.get('speaker')}: {d['text'].strip()}\n")
                frm = to
            start = end
    md += ["", "## Prompts", ""]
    for tc in c["shots"]:
        md += [f"### {tc['id']}", "", "```text", tc["prompt"], "```", "",
               "Parameters: `" + json.dumps(tc["parameters"], ensure_ascii=False) + "`", ""]
    if c["warnings"]:
        md += ["## Warnings", ""] + [f"- {w}" for w in c["warnings"]] + [""]
    (out / "script.md").write_text("\n".join(md), encoding="utf-8")
    files = ["script.md", "shots.csv"]
    if srt:
        (out / "subtitles.srt").write_text("\n".join(srt), encoding="utf-8")
        files.append("subtitles.srt")
    else:
        (out / "subtitles.srt").unlink(missing_ok=True)
    return {"folder": str(out), "files": files, "total_duration_s": start, "warnings": c["warnings"]}


# --------------------------------------------------------------------------- CLI

def _models_cli(a):
    if a.import_files:
        return import_models(a.import_files, a.out, a.snapshot)
    if a.out:
        raise Error("--out only works with --import")
    cat = load_models(a.snapshot)
    ms = list(cat.get("models", {}).values())
    if a.id:
        m = cat.get("models", {}).get(a.id)
        if not m:
            raise Error(f"'{a.id}' is not in the snapshot of {cat.get('generated_at')}; check it live")
        return m
    if a.type:
        ms = [m for m in ms if m["type"] == a.type]
    if a.search:
        terms = a.search.casefold().split()
        ms = [m for m in ms if all(t in json.dumps(m, ensure_ascii=False).casefold() for t in terms)]
    summary = []
    for m in sorted(ms, key=lambda m: (m["type"] or "", m["id"])):
        d = m.get("duration") or {}
        minimum, maximum = _duration_limits(d)
        dur = (f"{minimum}-{maximum} s" if maximum is not None else
               f"{d['options']} s" if d.get("options") else "?")
        summary.append({"id": m["id"], "name": m["name"], "type": m["type"], "duration": dur,
                        "generated_at": m.get("generated_at") or cat.get("generated_at"),
                        "audio": bool(m.get("audio") or m.get("audio_in_tags")),
                        "start_image": "start_image" in m["media"],
                        "end_image": "end_image" in m["media"],
                        "modes": m.get("modes")})
    return {"generated_at": cat.get("generated_at"), "count": len(summary), "models": summary}


BOX = re.compile(r"([A-Za-z0-9_-]{1,40}):([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)")


def crop(sheet, folder, boxes, margin=0.01):
    """ffmpeg commands that crop each frame of a sketch sheet (Phase A → Phase B, references/preproduction.md).

    Each box is name:x0,y0,x1,y1 in fractions of the width and the height (0 to 1), noted by looking at the sheet;
    the margin removes the drawn frame border. It runs nothing: it returns the commands, which do not overwrite an
    existing file (-n).
    """
    if not 0 <= margin < 0.2:
        raise Error("--margin must be between 0 and 0.2")
    errors, commands, names = [], [], set()
    for item in boxes:
        m = BOX.fullmatch(item)
        if not m:
            errors.append(f"{item!r}: use name:x0,y0,x1,y1, with fractions from 0 to 1 and a name with only letters, "
                          "digits, _ and -")
            continue
        name = m.group(1)
        try:
            x0, y0, x1, y1 = (float(v) for v in m.groups()[1:])
        except ValueError:
            errors.append(f"{item!r}: a coordinate that is not a number")
            continue
        if name in names:
            errors.append(f"{name}: repeated name")
            continue
        names.add(name)
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            errors.append(f"{name}: the box needs 0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1")
            continue
        w, h = x1 - x0 - 2 * margin, y1 - y0 - 2 * margin
        if w <= 0.02 or h <= 0.02:
            errors.append(f"{name}: box too small after removing the frame margin")
            continue
        filt = f"crop=w=iw*{w:.4f}:h=ih*{h:.4f}:x=iw*{x0 + margin:.4f}:y=ih*{y0 + margin:.4f}"
        cmd = ["ffmpeg", "-v", "error", "-n", "-i", str(sheet), "-vf", filt, "-frames:v", "1",
               str(Path(folder) / f"{name}.png")]
        commands.append({"frame": name, "command": cmd, "shell": shlex.join(cmd)})
    return {"errors": errors, "folder": str(folder), "commands": commands,
            "reminder": "create the folder first; check each crop before sending it as a reference"}


def main(argv=None):
    argv = translate_argv(list(sys.argv[1:] if argv is None else argv))
    ap = _Parser(prog="hfd", description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--snapshot", help="models snapshot to use instead of data/models.json")
    for name in ("validate", "compile", "score"):
        s = sub.add_parser(name, parents=[common] if name != "score" else [])
        s.add_argument("file")
        if name == "compile":
            s.add_argument("--text", action="store_true", help="only the prompts, ready to copy")
    s = sub.add_parser("budget")
    s.add_argument("file", nargs="?")
    s.add_argument("--shots", type=int)
    s.add_argument("--test-cost", type=float)
    s.add_argument("--final-cost", type=float)
    s.add_argument("--attempts", type=int)
    s.add_argument("--reserve", type=float, default=20.0)
    s = sub.add_parser("optics")
    s.add_argument("values", nargs="+", type=float)
    s = sub.add_parser("export", parents=[common])
    s.add_argument("file")
    s.add_argument("folder")
    s = sub.add_parser("models", parents=[common])
    s.add_argument("--type", choices=["video", "image", "audio", "3d"])
    s.add_argument("--search")
    s.add_argument("--id")
    s.add_argument("--import", dest="import_files", nargs="+", metavar="LIST",
                   help="models_explore list responses (JSON)")
    s.add_argument("--out", help="where to write the new snapshot (required with --import)")
    s = sub.add_parser("preferences")
    s.add_argument("--mode", choices=WORK_MODES)
    s.add_argument("--calibrate", choices=CALIBRATE)
    s.add_argument("--file", help="default: .higgsfield-director/preferences.json in the current folder")
    s = sub.add_parser("blind")
    s.add_argument("--with", dest="with_file", required=True, help="requests of the condition WITH the skill (JSON)")
    s.add_argument("--without", dest="without_file", required=True,
                   help="requests of the condition WITHOUT the skill (JSON)")
    s.add_argument("--out", required=True, help="new folder for blind-requests.json and blind-key.json")
    s = sub.add_parser("result")
    s.add_argument("--key", required=True)
    s.add_argument("--vote", required=True, choices=["X", "Y", "tie"])
    s.add_argument("--category", required=True, choices=CATEGORIES)
    s.add_argument("--model", required=True)
    s.add_argument("--shots", required=True, type=int, help="shots per condition")
    s.add_argument("--cost", required=True, type=float, help="credits spent on the whole calibration")
    s.add_argument("--version", required=True, help="skill version tested, like 5.1.0 or 5.1.0+<commit>")
    s.add_argument("--reference", action="store_true", help="the shots used a reference image")
    s.add_argument("--reason", help="the reason for the vote, in a few words, approved by the person")
    s.add_argument("--evaluation-x")
    s.add_argument("--evaluation-y")
    s.add_argument("--rater", choices=["blind-auto", "person", "none"], help="who gave the scores")
    s.add_argument("--first", choices=["X", "Y", "together"], help="which one the person saw first")
    s.add_argument("--date")
    s.add_argument("--out", required=True, help="new file in calibration/")
    s = sub.add_parser("crop", help="ffmpeg commands that crop a sketch sheet into frames")
    s.add_argument("sheet")
    s.add_argument("folder")
    s.add_argument("boxes", nargs="+", metavar="name:x0,y0,x1,y1")
    s.add_argument("--margin", type=float, default=0.01, help="fraction removed from each side (the frame border)")
    a = ap.parse_args(argv)
    try:
        return _run(a)
    except Error as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 2
    except Exception as e:  # never a traceback with code 1, which the agent would read as a "content error"
        if os.environ.get("HFD_DEBUG"):
            raise
        print(json.dumps({"error": f"input out of the expected format or internal failure ({type(e).__name__}: "
                                   f"{e}); run it again with HFD_DEBUG=1 to see the traceback"}, ensure_ascii=False),
              file=sys.stderr)
        return 2


class _Parser(argparse.ArgumentParser):
    """Usage errors come out as JSON on stderr with exit 2, like every other error."""

    def error(self, message):
        print(json.dumps({"error": f"{self.prog}: {message}"}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)


def _run(a):
    loaded = []  # warnings about the input files (old names), put before the command's own warnings
    if a.cmd == "validate":
        p = load_project(a.file, loaded)
        r = validate(p, load_models(a.snapshot, loaded))
        r["warnings"] = loaded + r["warnings"]
        code = 1 if r["errors"] else 0
    elif a.cmd == "compile":
        p = load_project(a.file, loaded)
        r = compile_project(p, load_models(a.snapshot, loaded))
        r["warnings"] = loaded + r["warnings"]
        code = 1 if r.get("errors") else 0
        if a.text and not code:
            for t in r["shots"]:
                print(f"## {t['id']}\n{t['prompt']}\n\nparameters: {json.dumps(t['parameters'], ensure_ascii=False)}\n")
            for w in r["warnings"]:
                print(f"WARNING: {w}")
            return 0
    elif a.cmd == "budget":
        if a.file:
            p = load_project(a.file, loaded)
            if not isinstance(p, dict):
                raise Error("the project must be a JSON object")
            r = budget(p.get("shots"), a.reserve, a.attempts)
            r["warnings"] = loaded + r["warnings"]
        else:
            if a.shots is None or a.test_cost is None or a.final_cost is None:
                raise Error("use a project.json or --shots, --test-cost and --final-cost")
            if not 1 <= a.shots <= 10000:
                raise Error("--shots must be between 1 and 10000")
            n = a.attempts if a.attempts is not None else 2
            r = budget([{"id": f"T{i + 1:02}", "test_cost": a.test_cost, "final_cost": a.final_cost,
                         "attempts": n} for i in range(a.shots)], a.reserve)
        code = 0
    elif a.cmd == "optics":
        if len(a.values) not in (2, 3):
            raise Error("usage: optics <mm> <distance_m> [aperture]")
        r = optics(*a.values)
        code = 0
    elif a.cmd == "export":
        p = load_project(a.file, loaded)
        catalog = load_models(a.snapshot, loaded)
        try:
            r = export(p, a.folder, catalog)
        except OSError as e:
            raise Error(f"could not write to {a.folder}: {e}")
        r["warnings"] = loaded + r["warnings"]
        code = 1 if r.get("errors") else 0
    elif a.cmd == "score":
        r = score(load_evaluation(a.file))
        code = 0
    elif a.cmd == "preferences":
        r = preferences(a.file, a.mode, a.calibrate)
        code = 0
    elif a.cmd == "blind":
        r = blind(read_json(a.with_file), read_json(a.without_file), a.out)
        code = 1 if r["errors"] else 0
    elif a.cmd == "result":
        cost = int(a.cost) if a.cost == int(a.cost) else a.cost
        rec, errors = result(load_key(a.key), a.vote, a.category, a.model, a.shots, cost, a.version,
                             a.reference, a.reason, load_evaluation(a.evaluation_x) if a.evaluation_x else None,
                             load_evaluation(a.evaluation_y) if a.evaluation_y else None, a.rater, a.date,
                             a.first)
        if not errors:
            dest = Path(a.out)
            if dest.exists():
                raise Error(f"{dest} already exists; choose another name")
            try:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(json.dumps(rec, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            except OSError as e:
                raise Error(f"could not write {dest}: {e}")
        r = {"errors": errors, "record": rec, "file": None if errors else str(a.out),
             "reminder": "the person reads the whole record before any PR"}
        code = 1 if errors else 0
    elif a.cmd == "crop":
        r = crop(a.sheet, a.folder, a.boxes, a.margin)
        code = 1 if r["errors"] else 0
    else:
        r = _models_cli(a)
        code = 0
    print(json.dumps(r, ensure_ascii=False, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
