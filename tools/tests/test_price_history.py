"""Tests of tools/aggregate_prices.py, with no network. Run from the repository root:
python3 -m unittest discover -s tools/tests -v

The prices here are made up, 0 or at least 1000 credits, as in the skill's tests.
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import aggregate_prices as ap  # noqa: E402

PAGE = "# Price history\n\n" + ap.START + "\n" + ap.END + "\n"


def _row(model, tier, credits, audio=True):
    return {"model": model, "type": "video", "tier_parameter": "resolution", "tier": tier, "credits": credits,
            "duration": 5, "audio": audio, "credits_per_second": credits / 5}


def _table(date, *rows):
    return {"format": 1, "date": date, "rows": list(rows)}


class PriceHistory(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / ap.FOLDER).mkdir()
        (self.root / ap.FOLDER / "README.md").write_text(PAGE, encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def _add(self, table):
        src = self.root / "day.json"
        src.write_text(json.dumps(table), encoding="utf-8")
        return ap.add(src, self.root)

    def test_a_table_that_is_not_the_connectors_is_refused(self):
        good = _table("2026-11-23", _row("cs4", "480p", 1000))
        self.assertEqual(ap.validate(good, "t"), [])
        bad = {
            "format": {**good, "format": 2},
            "date": {**good, "date": "23/11/2026"},
            "no rows": {**good, "rows": []},
            "negative": _table("2026-11-23", _row("cs4", "480p", -1000)),
            "bool": _table("2026-11-23", _row("cs4", "480p", True)),
            "infinite": _table("2026-11-23", _row("cs4", "480p", float("inf"))),
            "twice": _table("2026-11-23", _row("cs4", "480p", 1000), _row("cs4", "480p", 2000)),
            "type": _table("2026-11-23", {**_row("cs4", "480p", 1000), "type": "audio"}),
        }
        for name, table in bad.items():
            with self.subTest(name=name):
                self.assertTrue(ap.validate(table, "t"))
                with self.assertRaises(ValueError):
                    self._add(table)
        self.assertEqual(sorted(p.name for p in (self.root / ap.FOLDER).iterdir()), ["README.md"])

    def test_one_record_per_week(self):
        self._add(_table("2026-11-23", _row("cs4", "480p", 1000)))  # a Monday
        for same_week in ("2026-11-23", "2026-11-29"):  # the same Monday, and that week's Sunday
            with self.subTest(date=same_week), self.assertRaises(ValueError):
                self._add(_table(same_week, _row("cs4", "480p", 2000)))
        self.assertEqual(sorted(p.name for p in (self.root / ap.FOLDER).glob("*.json")), ["2026-11-23.json"])
        out = self._add(_table("2026-11-30", _row("cs4", "480p", 2000)))  # the next Monday
        self.assertEqual((out["records"], out["changed_since"]), (2, "2026-11-23"))
        self.assertEqual(out["changes"], ["cs4 480p 5 s: 1000 -> 2000"])

    def test_the_index_and_the_table_follow_the_records(self):
        self._add(_table("2026-11-23", _row("cs4", "480p", 1000), _row("cs4", "720p", 2000)))
        self._add(_table("2026-11-30", _row("cs4", "480p", 1100), _row("cs4", "720p", 2000),
                         _row("kling", "std", 1000, audio=None)))
        page = (self.root / ap.FOLDER / "README.md").read_text(encoding="utf-8")
        self.assertIn('x-axis ["2026-11-23", "2026-11-30"]', page)
        self.assertIn("line [100, 105]", page)  # (1.1 + 1.0) / 2: the new row is not in the index
        self.assertIn("| `cs4` | 480p | 5 s | on | 1000 | 1100 | +10.0% |", page)
        self.assertIn("| `cs4` | 720p | 5 s | on | 2000 | 2000 | = |", page)
        self.assertIn("| `kling` | std | 5 s | — | — | 1000 | new |", page)
        self.assertIn("Since 2026-11-23: 1 of 3 rows changed price, 1 new.", page)

    def test_a_stale_page_or_a_misnamed_record_fails_the_check(self):
        self._add(_table("2026-11-23", _row("cs4", "480p", 1000)))
        problems = []
        ap.check(problems, self.root)
        self.assertEqual(problems, [])
        (self.root / ap.FOLDER / "README.md").write_text(PAGE, encoding="utf-8")
        ap.check(problems, self.root)
        self.assertTrue(any("out of date" in p for p in problems))
        (self.root / ap.FOLDER / "prices.json").write_text(json.dumps(_table("2026-11-30", _row("cs4", "480p", 0))),
                                                           encoding="utf-8")
        problems = []
        ap.check(problems, self.root)
        self.assertTrue(any("YYYY-MM-DD.json" in p for p in problems))

    def test_a_record_put_in_by_hand_is_checked_too(self):
        folder = self.root / ap.FOLDER
        for name, table in (("2026-11-23.json", _table("2026-11-23", _row("cs4", "480p", 1000))),
                            ("2026-11-25.json", _table("2026-11-25", _row("cs4", "480p", 2000)))):
            (folder / name).write_text(json.dumps(table), encoding="utf-8")
        problems = []
        ap.check(problems, self.root)
        self.assertTrue(any("one record per week" in p for p in problems))
        (folder / "2026-11-25.json").unlink()
        (folder / "2026-11-30.json").write_text(json.dumps(_table("2026-12-01", _row("cs4", "480p", 2000))),
                                                encoding="utf-8")
        problems = []
        ap.check(problems, self.root)
        self.assertTrue(any("the date in the name" in p for p in problems))

    def test_the_skill_never_reads_the_record(self):
        """The record is history: the skill plans from the day's table in the project and quotes before spending."""
        for f in (ROOT / "higgsfield-director").rglob("*"):
            if f.is_file() and f.suffix in {".py", ".md", ".json", ".sh", ".yaml"}:
                with self.subTest(file=str(f.relative_to(ROOT))):
                    self.assertNotIn(ap.FOLDER, f.read_text(encoding="utf-8", errors="replace"))


if __name__ == "__main__":
    unittest.main()
