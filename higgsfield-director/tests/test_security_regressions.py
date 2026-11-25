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
        self.assertFalse(hfd.numero(10 ** 1000))
        self.assertFalse(hfd.numero(True))
        self.assertTrue(hfd.numero(1e9))

    def test_nonfinite_json_constants(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.json"
            for value in ("NaN", "Infinity", "-Infinity"):
                with self.subTest(value=value):
                    path.write_text(value, encoding="utf-8")
                    with self.assertRaises(hfd.Erro):
                        hfd.ler_json(path)

    def test_oversized_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.json"
            with path.open("wb") as stream:
                stream.truncate(16 * 1024 * 1024 + 1)
            with self.assertRaises(hfd.Erro):
                hfd.ler_json(path)

    def test_budget_rejects_huge_attempt_count(self):
        with self.assertRaises(hfd.Erro):
            hfd.orcamento([{"id": "T1", "custo_teste": 1,
                            "custo_final": 1, "tentativas": 10 ** 1000}])

    def test_cli_rejects_huge_shot_count_before_allocation(self):
        with patch.object(hfd, "orcamento") as budget:
            self.assertEqual(hfd.main(["orcamento", "--tomadas", "10001",
                                      "--custo-teste", "1", "--custo-final", "1"]), 2)
            budget.assert_not_called()

    def test_i2v_preserves_both_scopes(self):
        project = {"modo": "i2v", "preservar": ["identity", "label"]}
        shot = {"id": "T1", "preservar": ["label", "shape"]}
        prompt = hfd.compilar_tomada(project, shot)["prompt"]
        self.assertIn("preserve identity, label, shape", prompt)
