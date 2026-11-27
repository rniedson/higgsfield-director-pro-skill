#!/usr/bin/env python3
"""Keeps the weekly price record (price-history/YYYY-MM-DD.json) and its page, price-history/README.md.

Usage: python3 tools/aggregate_prices.py --add <prices.json>   # adds that day's table and updates the page
       python3 tools/aggregate_prices.py --write               # updates price-history/README.md between the markers
       python3 tools/aggregate_prices.py --check               # exits with 1 if a record is invalid or the page is stale
       python3 tools/aggregate_prices.py                       # prints the page's generated part

A record is the day's price table that `connector.py prices` writes in a project (`.higgsfield-director/prices.json`),
added here once a week. It records what the connector quoted that day; it is never today's price, and the skill does
not read this folder. Standard library only: it reads and writes files of the repository and never touches the network.
"""
import datetime as _dt
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = "price-history"
START, END = "<!-- prices:start -->", "<!-- prices:end -->"
NAME = re.compile(r"^(\d{4}-\d{2}-\d{2})\.json$")
KEY = ("type", "model", "tier_parameter", "tier", "duration", "audio")
WEEKS_SHOWN = 8
SOUND = {True: "on", "on": "on", False: "off", "off": "off"}


def _number(v):
    return type(v) in (int, float) and math.isfinite(v)


def _date(text):
    try:
        return _dt.date.fromisoformat(text) if isinstance(text, str) and len(text) == 10 else None
    except ValueError:
        return None


def validate(table, where):
    """The problems of one table, each naming where it is; [] when it can be recorded."""
    if not isinstance(table, dict) or table.get("format") != 1:
        return [f"{where}: not a price table (format 1, as connector.py prices writes it)"]
    problems = []
    if _date(table.get("date")) is None:
        problems.append(f"{where}: 'date' must be YYYY-MM-DD")
    rows = table.get("rows")
    if not isinstance(rows, list) or not rows:
        return problems + [f"{where}: 'rows' must be a list with at least one row"]
    seen = set()
    for i, r in enumerate(rows, 1):
        at = f"{where}: row {i}"
        if not isinstance(r, dict):
            problems.append(f"{at}: not an object")
            continue
        if not isinstance(r.get("model"), str) or not r["model"]:
            problems.append(f"{at}: 'model' must be a name")
        if r.get("type") not in ("video", "image"):
            problems.append(f"{at}: 'type' must be video or image")
        if not _number(r.get("credits")) or r["credits"] < 0:
            problems.append(f"{at}: 'credits' must be a number of 0 or more")
        if r.get("credits_per_second") is not None and not _number(r["credits_per_second"]):
            problems.append(f"{at}: 'credits_per_second' must be a number or null")
        if r.get("duration") is not None and (not _number(r["duration"]) or r["duration"] <= 0):
            problems.append(f"{at}: 'duration' must be a positive number or null")
        key = tuple(json.dumps(r.get(k), sort_keys=True) for k in KEY)
        if key in seen:
            problems.append(f"{at}: the same model, tier, duration and sound appear twice")
        seen.add(key)
    return problems


def _key(row):
    return tuple(json.dumps(row.get(k), sort_keys=True) for k in KEY)


def _normal(table):
    rows = [{k: r.get(k) for k in KEY + ("credits", "credits_per_second")} for r in table["rows"]]
    rows.sort(key=lambda r: (r["type"], r["model"], str(r["tier"]), str(r["duration"]), str(r["audio"])))
    return {"format": 1, "date": table["date"], "rows": rows}


def load(root=ROOT):
    """Returns (records sorted by date, problems). One record per week (ISO weeks, Monday to Sunday)."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from public_boundary import published_files
    records, problems, weeks = [], [], {}
    for p in sorted(x for x in published_files(root) if x.startswith(FOLDER + "/")):
        name = p[len(FOLDER) + 1:]
        if name == "README.md":
            continue
        m = NAME.match(name)
        if not m or "/" in name:
            problems.append(f"{p}: a record is {FOLDER}/YYYY-MM-DD.json, directly in the folder")
            continue
        try:
            table = json.loads((Path(root) / p).read_text(encoding="utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            problems.append(f"{p}: invalid JSON: {e}")
            continue
        errors = validate(table, p)
        if not errors and table["date"] != m.group(1):
            errors = [f"{p}: the date in the name must be the table's date"]
        problems += errors
        if errors:
            continue
        week = _dt.date.fromisoformat(table["date"]).isocalendar()[:2]
        if week in weeks:
            problems.append(f"{p}: week {week[0]}-W{week[1]:02d} already has {weeks[week]}: one record per week")
            continue
        weeks[week] = p
        records.append(table)
    return records, problems


def _fmt(v):
    return "—" if v is None else f"{v:g}"


def _index(records):
    """Per record: the mean of (credits / credits in the first record) x 100 over the rows priced in both."""
    first = {_key(r): r["credits"] for r in records[0]["rows"] if r["credits"]}
    out = []
    for rec in records:
        ratios = [r["credits"] / first[_key(r)] for r in rec["rows"] if _key(r) in first]
        out.append(round(100 * sum(ratios) / len(ratios), 1) if ratios else None)
    return out


def page(records):
    """The generated part of price-history/README.md."""
    if not records:
        return "No records yet."
    shown = records[-WEEKS_SHOWN:]
    first, last = records[0], records[-1]
    index = _index(records)
    points = [(r["date"], v) for r, v in zip(records, index) if v is not None]
    low = math.floor(min(v for _, v in points) - 5)
    high = math.ceil(max(v for _, v in points) + 5)
    # One point draws no line: GitHub showed an empty chart for the first record, so the chart waits for the second.
    lines = [
        "```mermaid",
        "xychart-beta",
        f'    title "Price index, 100 = {first["date"]}"',
        "    x-axis [" + ", ".join(f'"{d}"' for d, _ in points) + "]",
        f'    y-axis "index" {low} --> {high}',
        "    line [" + ", ".join(f"{v:g}" for _, v in points) + "]",
        "```",
    ] if len(points) > 1 else [f"The chart starts with the second weekly record: one week ({first['date']}) has "
                               "no line yet."]
    lines += [
        "",
        f"The index is the mean, over the rows quoted in both, of each row's credits against its credits on "
        f"{first['date']}: 100 means no change, 110 means 10% more on average.",
        "",
    ]
    if len(records) > 1:
        prev = {_key(r): r["credits"] for r in records[-2]["rows"]}
        changed = sum(1 for r in last["rows"] if _key(r) in prev and prev[_key(r)] != r["credits"])
        new = sum(1 for r in last["rows"] if _key(r) not in prev)
        lines += [f"Since {records[-2]['date']}: {changed} of {len(last['rows'])} rows changed price"
                  + (f", {new} new" if new else "") + ".", ""]
    head = "| Model | Tier | Duration | Sound | " + " | ".join(r["date"] for r in shown) + f" | Since {first['date']} |"
    lines += [head, "|---|---|---|---|" + "---:|" * len(shown) + "---:|"]
    base = {_key(r): r["credits"] for r in first["rows"]}
    rows = {}
    for rec in shown:
        for r in rec["rows"]:
            rows.setdefault(_key(r), r)
    latest = {}
    for rec in shown:
        latest.update({_key(r): r["credits"] for r in rec["rows"]})
    for k in sorted(rows, key=lambda k: (rows[k]["type"], rows[k]["model"], latest[k], str(rows[k]["tier"]))):
        r = rows[k]
        cells = []
        for rec in shown:
            match = [x["credits"] for x in rec["rows"] if _key(x) == k]
            cells.append(_fmt(match[0]) if match else "—")
        now = [x["credits"] for x in last["rows"] if _key(x) == k]
        if k not in base or not now:
            change = "new" if now else "gone"
        elif not base[k]:
            change = "="
        else:
            pct = 100 * (now[0] - base[k]) / base[k]
            change = "=" if abs(pct) < 0.05 else f"{pct:+.1f}%"
        sound = "—" if r["audio"] is None else SOUND.get(r["audio"], str(r["audio"]))
        duration = "—" if r["duration"] is None else f"{r['duration']:g} s"
        lines.append(f"| `{r['model']}` | {r['tier'] or '—'} | {duration} | {sound} | " + " | ".join(cells)
                     + f" | {change} |")
    lines += ["", "Credits per generation, each model from its cheapest tier. Sound: the setting the quote sent; — means "
                  "the model takes no sound setting in the catalog, not that it has no sound.", "",
              f"Generated by `tools/aggregate_prices.py` from {len(records)} record(s) in `{FOLDER}/`, the last "
              f"{len(shown)} shown."]
    return "\n".join(lines)


def updated_readme(records, root=ROOT):
    f = Path(root) / FOLDER / "README.md"
    text = f.read_text(encoding="utf-8") if f.exists() else ""
    if text.count(START) != 1 or text.count(END) != 1 or text.index(START) > text.index(END):
        return None, text
    before, rest = text.split(START)
    _, after = rest.split(END)
    return before + START + "\n" + page(records) + "\n" + END + after, text


def check(problems, root=ROOT):
    """Also used by tools/check_repo.py."""
    records, errors = load(root)
    problems += errors
    new, current = updated_readme(records, root)
    if new is None:
        problems.append(f"{FOLDER}/README.md: the markers {START} and {END} are missing, in this order")
    elif new != current:
        problems.append(f"{FOLDER}/README.md: the price page is out of date; run tools/aggregate_prices.py --write")
    return records


def write(root=ROOT):
    records, problems = load(root)
    if problems:
        raise ValueError("\n".join(problems))
    new, current = updated_readme(records, root)
    if new is None:
        raise ValueError(f"{FOLDER}/README.md: the markers {START} and {END} are missing")
    if new != current:
        (Path(root) / FOLDER / "README.md").write_text(new, encoding="utf-8")
    return records


def add(source, root=ROOT):
    """Copies a day's table into the folder, refusing a second record in the same week, and updates the page."""
    try:
        table = json.loads(Path(source).read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError) as e:
        raise ValueError(f"{source}: cannot read it as JSON: {e}")
    problems = validate(table, str(source))
    if problems:
        raise ValueError("\n".join(problems))
    records, problems = load(root)
    if problems:
        raise ValueError("\n".join(problems))
    week = _dt.date.fromisoformat(table["date"]).isocalendar()[:2]
    for rec in records:
        if _dt.date.fromisoformat(rec["date"]).isocalendar()[:2] == week:
            raise ValueError(f"week {week[0]}-W{week[1]:02d} already has the record of {rec['date']}: one per week")
    target = Path(root) / FOLDER / f"{table['date']}.json"
    target.write_text(json.dumps(_normal(table), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    records = write(root)
    prev = records[-2] if len(records) > 1 and records[-1]["date"] == table["date"] else None
    out = {"file": f"{FOLDER}/{target.name}", "rows": len(table["rows"]), "records": len(records)}
    if prev:
        before = {_key(r): r["credits"] for r in prev["rows"]}
        out["changed_since"] = prev["date"]
        out["changes"] = [f"{r['model']} {r['tier'] or ''} {_fmt(r['duration'])} s: {_fmt(before[_key(r)])} -> "
                          f"{_fmt(r['credits'])}".replace("  ", " ")
                          for r in table["rows"] if _key(r) in before and before[_key(r)] != r["credits"]]
    return out


def main(argv):
    try:
        if "--add" in argv:
            i = argv.index("--add")
            if i + 1 >= len(argv):
                raise ValueError("--add needs the path of a day's table")
            print(json.dumps(add(argv[i + 1]), ensure_ascii=False, indent=2))
            return 0
        if "--check" in argv:
            problems = []
            check(problems)
            for p in problems:
                print(p)
            print(f"{len(problems)} problem(s)" if problems else "ok: price records and page")
            return 1 if problems else 0
        if "--write" in argv:
            write()
            return 0
        records, problems = load()
        if problems:
            raise ValueError("\n".join(problems))
        print(page(records))
        return 0
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
