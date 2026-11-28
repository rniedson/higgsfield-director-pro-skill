import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from public_boundary import (check_local_references, check_media_content, check_public_boundary,
                             check_public_path, media_format, published_files)

MP4_HEAD = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00"
# A macOS home folder, written in two pieces so that no full machine path sits in this file.
MAC_HOME = "/" + "Users" + "/"
JPG_HEAD = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01"


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

    def test_skill_example_images_pass_but_not_video(self):
        self.assertEqual([], check_public_path("examples/references/character-sheet.jpg"))
        for path in (
            "examples/references/take.mp4",
            "higgsfield-director/examples/references/character-sheet.jpg",
            "higgsfield-director/references/character-sheet.jpg",
        ):
            with self.subTest(path=path):
                self.assertTrue(check_public_path(path))

    def test_the_skill_root_takes_only_the_skill_and_its_guide(self):
        for path in ("higgsfield-director/SKILL.md", "higgsfield-director/README.md"):
            with self.subTest(path=path):
                self.assertEqual([], check_public_path(path))
        for path in ("higgsfield-director/notes.md", "higgsfield-director/brief.json"):
            with self.subTest(path=path):
                self.assertTrue(check_public_path(path))

    def test_the_readme_demo_passes_and_nothing_beside_it(self):
        for path in ("docs/demo/kung-fu-vs-robot-clone.mp4", "docs/demo/kung-fu-vs-robot-clone.jpg",
                     "docs/demo/how-it-was-made.jpg"):
            with self.subTest(path=path):
                self.assertEqual([], check_public_path(path))
        for path in ("docs/demo/another-take.mp4", "docs/demo/kung-fu-vs-robot-clone.mov", "docs/kung-fu.mp4"):
            with self.subTest(path=path):
                self.assertTrue(check_public_path(path))

    def test_blocking_studio_sheets_and_guide_images_pass_but_not_video(self):
        for path in (
            "blocking-studio/assets/characters/mannequin/mannequin.glb",
            "blocking-studio/assets/characters/mannequin/sheets/turnaround.webp",
            "blocking-studio/docs/mannequin-approved.png",
            "blocking-studio/assets/characters/mannequin-female/sheets/turnaround.webp",
            "blocking-studio/docs/mannequin-female-approved.png",
            "blocking-studio/tools/blender/convert_meshy_mannequin.py",
        ):
            with self.subTest(path=path):
                self.assertEqual([], check_public_path(path))
        for path in (
            "blocking-studio/assets/characters/mannequin/sheets/take.mp4",
            "blocking-studio/assets/characters/mannequin/photo.png",
            "blocking-studio/renders/shot-01.png",
            "blocking-studio/projects/client/sheets/turnaround.webp",
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


class BoundaryHoles(unittest.TestCase):
    """Each test closes a hole a review found: the rule held for one form, and its siblings passed."""

    def test_every_local_path_form_is_rejected(self):
        for text in ("/home/alice/project/shot.png", "file:///tmp/shot.png", MAC_HOME + "alice", "/root/notes.txt",
                     "/Volumes/Studio/take.mov", "/private/var/folders/x/T/shot.png", "C:\\\\Users\\\\bob\\\\x",
                     "C:\\" + "Users\\bob\\x", "c:/" + "Users/bob/x"):
            with self.subTest(text=text):
                self.assertTrue(check_local_references("README.md", text))

    def test_urls_and_placeholders_are_not_local_paths(self):
        for text in ("[guide](https://docs.example.com/home/getting-started/)", "https://github.com" + MAC_HOME + "x",
                     "`" + MAC_HOME + "<you>/.claude/skills/`", "~/.claude/skills/higgsfield-director"):
            with self.subTest(text=text):
                self.assertEqual([], check_local_references("README.md", text))

    def test_project_folders_are_rejected_at_any_depth_case_and_language(self):
        for path in ("docs/project/brief.md", "docs/projects/brief.md", "docs/Projects/brief.md",
                     "docs/client-work/brief.md", "docs/my projects/brief.md", "examples/clientes/a/brief.md",
                     "lessons-learned/producoes/r6/shots.csv", "docs/entregas/a.md", "docs/saidas/a.md"):
            with self.subTest(path=path):
                self.assertTrue(check_public_path(path))

    def test_media_extension_check_ignores_case_and_knows_more_formats(self):
        for path in ("docs/generated-shot.MP4", "docs/shot.m4v", "lessons-learned/take.mkv", "docs/a.heic",
                     "docs/a.m4a", "docs/a.flac", "tools/a.7z", "docs/a.tar.gz"):
            with self.subTest(path=path):
                self.assertTrue(check_public_path(path))

    def test_manual_visual_folders_take_no_video(self):
        self.assertTrue(check_public_path("docs/manual/visual/assets/take.mp4"))

    def test_media_is_known_by_its_bytes_not_its_name(self):
        self.assertEqual(".mp4", media_format(MP4_HEAD))
        self.assertEqual(".jpg", media_format(JPG_HEAD))
        self.assertIsNone(media_format(b"# A heading\n"))
        for path in ("docs/take", "lessons-learned/tests/A9-sheet.jpg", "examples/references/client.png"):
            with self.subTest(path=path):
                self.assertTrue(check_media_content(path, MP4_HEAD))
        self.assertEqual([], check_media_content("examples/references/character-sheet.jpg", JPG_HEAD))
        self.assertEqual([], check_media_content("docs/demo/kung-fu-vs-robot-clone.mp4", MP4_HEAD))

    def test_checkout_scan_reads_text_content_and_binary_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp) / "README.md").write_text("See " + MAC_HOME + "alice/shot.png\n", encoding="utf-8")
            (Path(temp) / "docs").mkdir()
            (Path(temp) / "docs" / "shots.csv").write_text("id;file\nT01;/home/alice/a.mp4\n", encoding="utf-8")
            (Path(temp) / "docs" / "sheet.png").write_bytes(b"\x89PNG\r\n\x1a\n\x00tEXtSource\x00" + MAC_HOME.encode() + b"alice/x.png")
            problems = check_public_boundary(temp)
        for path in ("README.md", "docs/shots.csv", "docs/sheet.png"):
            with self.subTest(path=path):
                self.assertTrue(any(p.startswith(path) and "machine-specific" in p for p in problems))

    def test_a_symbolic_link_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp) / "docs").mkdir()
            os.symlink(MAC_HOME + "alice/private/brief.md", Path(temp) / "docs" / "brief.md")
            problems = check_public_boundary(temp)
        self.assertTrue(any("symbolic link" in p for p in problems))

    def test_cache_folders_below_the_top_are_scanned(self):
        with tempfile.TemporaryDirectory() as temp:
            subprocess.run(["git", "init", "-q", temp], check=True)
            (Path(temp) / "docs" / "node_modules").mkdir(parents=True)
            (Path(temp) / "docs" / "node_modules" / "shot.mp4").write_bytes(MP4_HEAD)
            problems = check_public_boundary(temp)
        self.assertTrue(any(p.startswith("docs/node_modules/shot.mp4") for p in problems))

    def test_published_files_follow_git_and_leave_ignored_files_out(self):
        with tempfile.TemporaryDirectory() as temp:
            subprocess.run(["git", "init", "-q", temp], check=True)
            (Path(temp) / ".gitignore").write_text(".DS_Store\n", encoding="utf-8")
            (Path(temp) / ".DS_Store").write_bytes(b"\x00")
            (Path(temp) / "README.md").write_text("# x\n", encoding="utf-8")
            self.assertEqual([".gitignore", "README.md"], published_files(temp))


if __name__ == "__main__":
    unittest.main()
