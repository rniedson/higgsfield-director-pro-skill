import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "install.sh"
SKILL = ROOT / "higgsfield-director"
BASH = shutil.which("bash") or "/bin/bash"


class Install(unittest.TestCase):
    """install.sh in a throwaway home and project, with stand-ins for the agents on the PATH."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.home, self.project, self.bin = self.tmp / "home", self.tmp / "project", self.tmp / "bin"
        for d in (self.home, self.project, self.bin):
            d.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def agents(self, *names):
        for name in names:
            stub = self.bin / name
            stub.write_text("#!/bin/sh\nexit 0\n")
            stub.chmod(0o755)

    def run_install(self, *args):
        env = {"HOME": str(self.home), "PATH": f"{self.bin}:/usr/bin:/bin"}
        return subprocess.run([BASH, str(SCRIPT), "--yes", *args], cwd=self.project, env=env, capture_output=True,
                              text=True, stdin=subprocess.DEVNULL, timeout=30)

    def assertLinked(self, link):
        self.assertTrue(link.is_symlink(), link)
        self.assertEqual(Path(os.readlink(link)), SKILL)

    def test_executable(self):
        self.assertTrue(os.access(SCRIPT, os.X_OK))

    def test_claude_project_when_it_has_a_claude_folder(self):
        self.agents("claude"); (self.project / ".claude").mkdir()
        r = self.run_install()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertLinked(self.project / ".claude/skills/higgsfield-director")
        self.assertFalse((self.home / ".claude").exists())
        self.assertIn("To remove:", r.stdout)

    def test_claude_user_when_the_project_has_no_claude_folder(self):
        self.agents("claude")
        r = self.run_install()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertLinked(self.home / ".claude/skills/higgsfield-director")

    def test_claude_scope_user_by_flag(self):
        self.agents("claude"); (self.project / ".claude").mkdir()
        self.assertEqual(self.run_install("--scope", "user").returncode, 0)
        self.assertLinked(self.home / ".claude/skills/higgsfield-director")
        self.assertFalse((self.project / ".claude/skills").exists())

    def test_codex(self):
        self.agents("codex")
        r = self.run_install()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertLinked(self.home / ".agents/skills/higgsfield-director")
        self.assertIn("codex mcp add higgsfield", r.stdout)

    def test_codex_has_no_project_scope(self):
        self.agents("codex")
        r = self.run_install("--scope", "project")
        self.assertEqual(r.returncode, 1)
        self.assertIn("--scope user", r.stderr)

    def test_both_agents_need_a_choice(self):
        self.agents("claude", "codex")
        r = self.run_install()
        self.assertEqual(r.returncode, 1)
        self.assertIn("--agent", r.stderr)
        self.assertEqual(self.run_install("--agent", "codex").returncode, 0)
        self.assertLinked(self.home / ".agents/skills/higgsfield-director")

    def test_no_agent(self):
        r = self.run_install()
        self.assertEqual(r.returncode, 1)
        self.assertIn("neither claude nor codex", r.stderr)

    def test_second_run_is_already_linked(self):
        self.agents("claude")
        self.assertEqual(self.run_install().returncode, 0)
        r = self.run_install()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("already linked", r.stdout)

    def test_another_link_is_not_overwritten(self):
        self.agents("claude")
        link = self.home / ".claude/skills/higgsfield-director"
        link.parent.mkdir(parents=True); link.symlink_to(self.tmp)
        r = self.run_install()
        self.assertEqual(r.returncode, 1)
        self.assertIn("not overwritten", r.stderr)
        self.assertEqual(Path(os.readlink(link)), self.tmp)

    def test_a_folder_is_not_overwritten(self):
        self.agents("claude")
        folder = self.home / ".claude/skills/higgsfield-director"
        folder.mkdir(parents=True)
        r = self.run_install()
        self.assertEqual(r.returncode, 1)
        self.assertIn("not a link", r.stderr)
        self.assertTrue(folder.is_dir() and not folder.is_symlink())

    def test_dry_run_changes_nothing(self):
        self.agents("claude")
        r = self.run_install("--dry-run")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("would link", r.stdout)
        self.assertFalse((self.home / ".claude").exists())

    def test_unknown_option(self):
        r = self.run_install("--force")
        self.assertEqual(r.returncode, 1)
        self.assertIn("unknown option", r.stderr)


if __name__ == "__main__":
    unittest.main()
