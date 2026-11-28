import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_repo import READMES, readme_language_problems

PT = READMES["README.pt-BR.md"]   # the Portuguese name, kept out of this file's text for check_language
GOOD = {"README.md": f"# Title\n\n**English** · [{PT}](README.pt-BR.md)\n\nText.\n",
        "README.pt-BR.md": f"# Title\n\n[English](README.md) · **{PT}**\n\nText.\n"}


def problems_with(**files):
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        for name, text in {**GOOD, **{k.replace("_", "."): v for k, v in files.items()}}.items():
            if text is not None:
                (root / name).write_text(text, encoding="utf-8")
        return readme_language_problems(root)


class ReadmeLanguages(unittest.TestCase):
    def test_both_readmes_as_they_are_pass(self):
        self.assertEqual(readme_language_problems(Path(__file__).resolve().parents[2]), [])

    def test_good_pair_passes(self):
        self.assertEqual(problems_with(), [])

    def test_missing_line(self):
        p = problems_with(README_md="# Title\n\nText.\n")
        self.assertTrue(any(x.startswith("README.md: no language line") for x in p), p)

    def test_line_below_the_header(self):
        p = problems_with(README_md="# Title\n" + "text\n" * 45 + GOOD["README.md"])
        self.assertTrue(any("no language line" in x for x in p), p)

    def test_current_language_linked(self):
        p = problems_with(README_md=f"[English](README.md) · [{PT}](README.pt-BR.md)\n")
        self.assertTrue(any("in bold and without a link" in x for x in p), p)

    def test_broken_link(self):
        p = problems_with(README_md=f"**English** · [{PT}](README.pt.md)\n")
        self.assertTrue(any("not to README.pt-BR.md" in x for x in p), p)

    def test_missing_file(self):
        p = problems_with(**{"README_pt-BR_md": None})
        self.assertIn("README.pt-BR.md: missing", p)
        self.assertTrue(any("links" in x and "not to README.pt-BR.md" in x for x in p), p)


if __name__ == "__main__":
    unittest.main()
