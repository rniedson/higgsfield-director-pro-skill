import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from public_boundary import check_local_references, check_public_boundary, check_public_path


class PublicBoundaryTests(unittest.TestCase):
    def test_shared_source_and_manual_visuals_pass(self):
        self.assertEqual([], check_public_path("higgsfield-director/references/preproduction.md"))
        self.assertEqual([], check_public_path("docs/manual/visual/assets/CAM001.png"))
        self.assertEqual([], check_public_path("lessons-learned/README.md"))
        self.assertEqual([], check_public_path("tools/tests/test_public_boundary.py"))

    def test_frame_sheets_of_skill_tests_pass_but_not_video(self):
        self.assertEqual([], check_public_path("lessons-learned/tests/2026-11-25-timed-beats/A1-sheet.jpg"))
        for path in (
            "lessons-learned/tests/2026-11-25-timed-beats/A1.mp4",
            "lessons-learned/A1-sheet.jpg",
            "lessons-learned/tests/2026-11-25-timed-beats/review.html",
        ):
            with self.subTest(path=path):
                self.assertTrue(check_public_path(path))

    def test_agent_instruction_files_pass(self):
        for path in ("AGENTS.md", "CLAUDE.md"):
            with self.subTest(path=path):
                self.assertEqual([], check_public_path(path))

    def test_personal_files_and_media_are_rejected(self):
        for path in (
            "artifacts/sketch-test/review.html",
            "higgsfield-director/projects/example/brief.md",
            "docs/review.html",
            "docs/generated-shot.mp4",
            "assets/client-photo.png",
        ):
            with self.subTest(path=path):
                self.assertTrue(check_public_path(path))

    def test_machine_paths_are_rejected_without_blocking_web_links(self):
        self.assertTrue(check_local_references("README.md", "file:///Users/alice/project/shot.png"))
        self.assertTrue(check_local_references("README.md", "/Users/alice/project/shot.png"))
        self.assertTrue(check_local_references("README.md", "C:\\Users\\Alice\\project\\shot.png"))
        self.assertFalse(check_local_references("README.md", "https://example.com/guide"))

    def test_checkout_scan_catches_project_document(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "README.md").write_text("Shared guide\n", encoding="utf-8")
            project = root / "projects" / "example"
            project.mkdir(parents=True)
            (project / "script.md").write_text("Private draft\n", encoding="utf-8")
            problems = check_public_boundary(root)
            self.assertTrue(any("projects/example/script.md" in problem for problem in problems))


if __name__ == "__main__":
    unittest.main()
