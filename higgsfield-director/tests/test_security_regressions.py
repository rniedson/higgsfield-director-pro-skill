"""Regression tests for bounded offline planning inputs."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "hfd_security", Path(__file__).resolve().parents[1] / "scripts" / "hfd.py"
)
hfd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hfd)


class SecurityRegressions(unittest.TestCase):
    def test_huge_integer_is_not_a_number(self):
        self.assertFalse(hfd.is_number(10 ** 1000))
        self.assertFalse(hfd.is_number(True))
        self.assertTrue(hfd.is_number(1e9))

    def test_nonfinite_json_constants(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.json"
            for value in ("NaN", "Infinity", "-Infinity"):
                with self.subTest(value=value):
                    path.write_text(value, encoding="utf-8")
                    with self.assertRaises(hfd.Error):
                        hfd.read_json(path)

    def test_oversized_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.json"
            with path.open("wb") as stream:
                stream.truncate(16 * 1024 * 1024 + 1)
            with self.assertRaises(hfd.Error):
                hfd.read_json(path)

    def test_budget_rejects_huge_attempt_count(self):
        with self.assertRaises(hfd.Error):
            hfd.budget([{"id": "T1", "test_cost": 1,
                        "final_cost": 1, "attempts": 10 ** 1000}])

    def test_cli_rejects_huge_shot_count_before_allocation(self):
        with patch.object(hfd, "budget") as budget:
            self.assertEqual(hfd.main(["budget", "--shots", "10001",
                                      "--test-cost", "1", "--final-cost", "1"]), 2)
            budget.assert_not_called()

    def test_i2v_preserves_both_scopes(self):
        project = {"mode": "i2v", "preserve": ["identity", "label"]}
        shot = {"id": "T1", "preserve": ["label", "shape"]}
        prompt = hfd.compile_shot(project, shot)["prompt"]
        self.assertIn("preserve identity, label, shape", prompt)
