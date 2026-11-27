"""Tests of hfd.py. Run from the skill root:  python3 -m unittest discover -s tests -v

Each test marked "RC3" reproduces a defect measured in the ChatGPT version (docs/RC3-EVALUATION.md).
"""
import copy
import csv
import io
import json
import os
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import hfd  # noqa: E402

CATALOG = {
    "generated_at": "2099-01-01",
    "models": {
        "cs4": hfd._normalize_model({
            "id": "cs4", "name": "Cinema Studio 4.0", "output_type": "video",
            "aspect_ratios": ["auto", "16:9", "9:16"],
            "parameters": [
                {"name": "mode", "options": ["t2v", "omni_reference", "video_edit", "video_extension"]},
                {"name": "duration", "min": 4, "max": 30, "default": 5},
                {"name": "resolution", "options": ["480p", "720p", "1080p"]},
                {"name": "generate_audio", "type": "bool", "default": True}],
            "medias": [{"roles": ["start_image", "end_image", "image_references"]}]}),
        "veo": hfd._normalize_model({
            "id": "veo", "name": "Veo", "output_type": "video", "aspect_ratios": ["16:9", "9:16"],
            "parameters": [{"name": "duration", "options": [4, 6, 8]}], "tags": ["audio"],
            "medias": [{"roles": ["start_image"]}]}),
        "silent": hfd._normalize_model({
            "id": "silent", "name": "No sound", "output_type": "video", "aspect_ratios": [],
            "parameters": [{"name": "duration", "min": 3, "max": 10}],
            "medias": [{"roles": ["video_references"]}]}),
        "kling": hfd._normalize_model({
            "id": "kling", "name": "Kling", "output_type": "video", "aspect_ratios": ["16:9", "9:16", "1:1"],
            "parameters": [{"name": "duration", "min": 3, "max": 15},
                           {"name": "sound", "options": ["on", "off"], "default": "on"}],
            "medias": [{"roles": ["start_image", "end_image"]}]}),
        "photo": hfd._normalize_model({
            "id": "photo", "name": "Image", "output_type": "image", "aspect_ratios": ["1:1"],
            "parameters": [], "medias": []}),
    },
}


def project(**kw):
    p = {"model": "cs4", "mode": "t2v", "aspect_ratio": "9:16",
         "shots": [{"id": "T01", "duration": 5, "subject": "A glass bottle", "action": "It rests on a plinth",
                    "camera": "slow orbit"}]}
    p.update(kw)
    return p


def shot(p, **kw):
    p["shots"][0].update(kw)
    return p


class Camera(unittest.TestCase):
    def warnings(self, txt):
        return hfd.check_camera(txt)[0]

    def test_rc3_negation_is_not_a_conflict(self):
        for txt in ("static camera, no orbit", "locked-off shot, no pan or dolly",
                    "Locked-off shot without any zoom", "fixed camera, never pans"):
            self.assertEqual(self.warnings(txt), [], txt)

    def test_rc3_static_subject_is_not_a_static_camera(self):
        self.assertEqual(self.warnings("slow orbit around a static subject"), [])

    def test_phases_are_allowed(self):
        self.assertEqual(self.warnings("static camera, then a slow dolly in"), [])
        self.assertEqual(self.warnings("Locked-off for two seconds; then slow push-in"), [])

    def test_real_conflict_becomes_a_warning(self):
        w = self.warnings("static camera with a slow orbit")
        self.assertTrue(w and "static and moving" in w[0])

    def test_two_simultaneous_movements(self):
        w = self.warnings("dolly in while panning left")
        self.assertTrue(any("more than one movement" in x for x in w))

    def test_rc3_camera_never_blocks_compilation(self):
        p = shot(project(), camera="static camera with a slow orbit")
        r = hfd.compile_project(p, CATALOG)
        self.assertEqual(r["errors"], [])
        self.assertTrue(r["warnings"])


class ModelAndAudio(unittest.TestCase):
    def test_rc3_cinema_studio_audio_stays_in_the_prompt(self):
        p = shot(project(), sound="soft glass chime")
        r = hfd.compile_project(p, CATALOG)
        t = r["shots"][0]
        self.assertIn("Audio: Soft glass chime.", t["prompt"])
        self.assertIs(t["parameters"]["generate_audio"], True)
        self.assertFalse(any("post-production" in w for w in r["warnings"]))

    def test_kling_uses_on_off(self):
        t = hfd.compile_project(shot(project(model="kling"), sound="rain"), CATALOG)["shots"][0]
        self.assertEqual(t["parameters"]["sound"], "on")
        t = hfd.compile_project(project(model="kling"), CATALOG)["shots"][0]
        self.assertEqual(t["parameters"]["sound"], "off")

    def test_model_without_audio_warns(self):
        r = hfd.validate(shot(project(model="silent"), sound="rain"), CATALOG)
        self.assertTrue(any("post-production" in w for w in r["warnings"]))

    def test_rc3_unknown_model_warns(self):
        r = hfd.validate(project(model="kling-3.0"), CATALOG)
        self.assertTrue(any("is not in the snapshot" in w for w in r["warnings"]))

    def test_duration_outside_the_model(self):
        self.assertTrue(hfd.validate(shot(project(), duration=31), CATALOG)["errors"])
        self.assertTrue(hfd.validate(shot(project(model="veo", aspect_ratio="16:9"), duration=5), CATALOG)["errors"])
        self.assertEqual(hfd.validate(shot(project(model="veo", aspect_ratio="16:9"), duration=6),
                                      CATALOG)["errors"], [])

    def test_aspect_ratio_and_resolution(self):
        self.assertTrue(hfd.validate(project(aspect_ratio="4:3"), CATALOG)["errors"])
        self.assertTrue(hfd.validate(project(resolution="4k"), CATALOG)["errors"])

    def test_i2v_picks_the_omni_reference_mode(self):
        p = project(mode="i2v", references=["start_image"], preserve=["face"])
        t = hfd.compile_project(p, CATALOG)["shots"][0]
        self.assertEqual(t["parameters"]["mode"], "omni_reference")
        self.assertTrue(t["prompt"].startswith("The reference image is the opening frame; preserve face."))
        self.assertNotIn("A glass bottle", t["prompt"])  # in i2v the image already brings the subject

    def test_i2v_without_start_image(self):
        p = project(model="silent", mode="i2v", aspect_ratio=None)
        self.assertTrue(any("start image" in e for e in hfd.validate(p, CATALOG)["errors"]))

    def test_mode_and_model_type(self):
        self.assertTrue(hfd.validate(project(model="photo", aspect_ratio="1:1"), CATALOG)["errors"])

    def test_image_ignores_time_and_sound(self):
        p = project(model="photo", mode="image", aspect_ratio="1:1")
        shot(p, sound="rain", camera="dolly in")
        r = hfd.compile_project(p, CATALOG)
        self.assertEqual(r["errors"], [])
        self.assertNotIn("Audio", r["shots"][0]["prompt"])
        self.assertNotIn("orbit", r["shots"][0]["prompt"].lower())

    def test_image_with_unknown_model_sends_no_duration(self):
        p = shot(project(model="new_model", mode="image"), duration=7)
        r = hfd.compile_project(p, CATALOG)
        self.assertEqual(r["errors"], [])
        self.assertNotIn("duration", r["shots"][0]["parameters"])


class Continuity(unittest.TestCase):
    def base(self):
        p = project(bibles={"P01": {"description": "A black bottle with a gold cap", "fixed": {"color": "black"}}})
        t1 = {"id": "T01", "duration": 5, "entities": ["P01"], "action": "rests", "start": {"P01": {"place": "table"}}}
        t2 = {"id": "T02", "duration": 5, "entities": ["P01"], "action": "rests", "start": {"P01": {"place": "floor"}}}
        p["shots"] = [t1, t2]
        return p

    def test_rc3_shot_without_end_still_checks_the_boundary(self):
        r = hfd.validate(self.base(), CATALOG)
        self.assertTrue(any("T02: P01.place starts" in e for e in r["errors"]), r)
        self.assertTrue(any("T01: no 'end'" in w for w in r["warnings"]))

    def test_approved_change(self):
        p = self.base()
        p["shots"][1]["approved_changes"] = ["P01.place"]
        self.assertEqual(hfd.validate(p, CATALOG)["errors"], [])

    def test_fixed_attribute(self):
        p = self.base()
        p["shots"][0]["end"] = {"P01": {"color": "red", "place": "table"}}
        self.assertTrue(any("the bible fixes" in e for e in hfd.validate(p, CATALOG)["errors"]))

    def test_entity_without_bible_entry(self):
        p = self.base()
        p["shots"][0]["entities"] = ["X9"]
        self.assertTrue(any("X9" in e for e in hfd.validate(p, CATALOG)["errors"]))

    def test_bible_description_repeats_in_every_shot(self):
        p = self.base()
        p["shots"][1]["approved_changes"] = ["P01.place"]
        r = hfd.compile_project(p, CATALOG)
        for t in r["shots"]:
            self.assertTrue(t["prompt"].startswith("A black bottle with a gold cap."))

    def test_axis_180(self):
        p = self.base()
        p["shots"][1]["approved_changes"] = ["P01.place"]
        p["axis"] = [[0, 0], [4, 0]]
        p["shots"][0]["camera_xy"] = [1, -2]
        p["shots"][1]["camera_xy"] = [1, 2]
        self.assertTrue(any("180" in w for w in hfd.validate(p, CATALOG)["warnings"]))
        p["shots"][1]["motivated_crossing"] = True
        self.assertFalse(any("180" in w for w in hfd.validate(p, CATALOG)["warnings"]))


class Rules(unittest.TestCase):
    def test_dialogue_too_long(self):
        p = shot(project(), dialogue=[{"speaker": "A", "text": " ".join(["word"] * 20)}])
        self.assertTrue(any("do not fit" in w for w in hfd.validate(p, CATALOG)["warnings"]))

    def test_dialogue_without_label(self):
        p = shot(project(), dialogue=[{"text": "Hi"}])
        self.assertTrue(hfd.validate(p, CATALOG)["errors"])

    def test_labeled_dialogue_in_the_prompt(self):
        p = shot(project(), dialogue=[{"speaker": "Ana", "language": "Brazilian Portuguese", "text": "Bom dia."}])
        self.assertIn('Ana says in Brazilian Portuguese: "Bom dia."',
                      hfd.compile_project(p, CATALOG)["shots"][0]["prompt"])

    def test_overlapping_timeline(self):
        p = shot(project(), timeline=[{"track": "camera", "from": 0, "to": 3},
                                      {"track": "camera", "from": 2, "to": 5}])
        self.assertTrue(any("overlapping" in e for e in hfd.validate(p, CATALOG)["errors"]))

    def test_rc3_empty_fields_make_no_empty_line(self):
        prompt = hfd.compile_project(project(), CATALOG)["shots"][0]["prompt"]
        self.assertNotIn("LOCKS", prompt)
        self.assertNotIn("..", prompt)
        self.assertNotIn("  ", prompt)

    def test_rc3_whole_sentences(self):
        prompt = hfd.compile_project(project(), CATALOG)["shots"][0]["prompt"]
        self.assertIn("Slow orbit.", prompt)

    def test_no_shots(self):
        self.assertTrue(hfd.validate({"model": "cs4"}, CATALOG)["errors"])


class Calculations(unittest.TestCase):
    def test_budget(self):
        r = hfd.budget([{"id": "T01", "test_cost": 10, "final_cost": 35}], reserve=20)
        self.assertEqual(r["base"], 55)
        self.assertEqual(r["total"], 66)

    def test_budget_without_price_refuses(self):
        with self.assertRaises(hfd.Error):
            hfd.budget([{"id": "T01"}])

    def test_optics_exact_formula(self):
        r = hfd.optics(50, 4, 2.8)
        self.assertAlmostEqual(r["horizontal_fov_degrees"], 39.6, places=1)
        self.assertAlmostEqual(r["focus_from_m"], 3.531, places=3)
        self.assertAlmostEqual(r["focus_to_m"], 4.612, places=3)
        with self.assertRaises(hfd.Error):
            hfd.optics(50, 0.01)

    def test_score_requires_evidence(self):
        x = json.loads((ROOT / "templates/evaluation.json").read_text())
        self.assertEqual(hfd.score(x)["verdict"], "approved with adjustments")
        y = copy.deepcopy(x)
        y["criteria"]["camera"]["evidence"] = ""
        with self.assertRaises(hfd.Error):
            hfd.score(y)
        y = copy.deepcopy(x)
        y["critical_failure"] = True
        self.assertTrue(hfd.score(y)["verdict"].startswith("blocked"))
        y = copy.deepcopy(x)
        del y["file"]
        with self.assertRaises(hfd.Error):
            hfd.score(y)


class Files(unittest.TestCase):
    def test_export(self):
        p = shot(project(), subject="=HYPERLINK(1)", dialogue=[{"speaker": "A", "text": "Hi."}])
        with tempfile.TemporaryDirectory() as d:
            r = hfd.export(p, d, CATALOG)
            self.assertEqual(sorted(r["files"]), ["script.md", "shots.csv", "subtitles.srt"])
            with open(Path(d) / "shots.csv", encoding="utf-8") as fh:
                rows = list(csv.reader(fh))
            self.assertFalse(rows[1][4].startswith("="))
            self.assertIn("00:00:00,000 --> 00:00:05,000", (Path(d) / "subtitles.srt").read_text())

    def test_export_removes_old_subtitles_without_dialogue(self):
        p = shot(project(), dialogue=[{"speaker": "A", "text": "Hello."}])
        with tempfile.TemporaryDirectory() as d:
            hfd.export(p, d, CATALOG)
            self.assertTrue((Path(d) / "subtitles.srt").exists())
            del p["shots"][0]["dialogue"]
            r = hfd.export(p, d, CATALOG)
            self.assertNotIn("subtitles.srt", r["files"])
            self.assertFalse((Path(d) / "subtitles.srt").exists())

    def test_models_import_normalizes(self):
        raw = {"items": [{"id": "x1", "name": "X", "output_type": "video", "aspect_ratios": ["16:9"],
                          "parameters": [{"name": "duration", "options": [5, 10]},
                                         {"name": "sound", "options": ["on", "off"]}],
                          "medias": [{"roles": ["start_image"]}]}]}
        n = hfd._normalize_model(raw["items"][0])
        self.assertEqual(n["duration"]["options"], [5, 10])
        self.assertEqual(n["audio"]["parameter"], "sound")
        self.assertEqual(n["media"], ["start_image"])

    def test_models_snapshot_present(self):
        cat = json.loads((ROOT / "data/models.json").read_text())
        self.assertGreaterEqual(len(cat["models"]), 100)
        self.assertRegex(cat["generated_at"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertIn("cinematic_studio_video_4_0", cat["models"])

    def test_example_templates_validate_on_the_real_snapshot(self):
        for name in ("project.json", "i2v.json"):
            p = json.loads((ROOT / "templates" / name).read_text())
            self.assertEqual(hfd.validate(p)["errors"], [], name)

    def test_duration_range_of_the_real_snapshot(self):
        p = project(model="cinematic_studio_3_0")
        for duration in (3, 16):
            with self.subTest(duration=duration):
                shot(p, duration=duration)
                self.assertTrue(hfd.validate(p)["errors"])
        shot(p, duration=4)
        self.assertEqual(hfd.validate(p)["errors"], [])
        code, out, _ = _cli("models", "--search", "cinematic_studio_3_0")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["models"][0]["duration"], "4-15 s")

    def test_cli_exit_codes(self):
        with tempfile.TemporaryDirectory() as d:
            bad = Path(d) / "p.json"
            bad.write_text(json.dumps({"shots": []}))
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self.assertEqual(hfd.main(["validate", str(bad)]), 1)
                self.assertEqual(hfd.main(["validate", str(bad) + "x"]), 2)
                self.assertEqual(hfd.main(["optics", "50", "4"]), 0)


def _cli(*args):
    """(exit code, stdout, stderr) of hfd.main."""
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = hfd.main([str(a) for a in args])
    return code, out.getvalue(), err.getvalue()


class Robustness(unittest.TestCase):
    """Review of 2026-11-24: input out of format cannot become a traceback with code 1."""

    CASES = {
        "timeline item is not an object": lambda p: shot(p, timeline=["x"]),
        "short camera_xy": lambda p: shot(p, camera_xy=[1]),
        "start as a list": lambda p: shot(p, start=[1]),
        "start attributes are not an object": lambda p: shot(p, start={"P01": "red"}),
        "bibles as a list": lambda p: p.update(bibles=[1]) or p,
        "bible entry is not an object": lambda p: p.update(bibles={"P01": "bottle"}) or p,
        "fixed is not an object": lambda p: p.update(bibles={"P01": {"fixed": ["black"]}}) or p,
        "entity is not a string": lambda p: shot(p, entities=[{"id": "P01"}]),
        "approved change is not a string": lambda p: shot(p, approved_changes=[["P01.color"]]),
        "dialogue line is not an object": lambda p: shot(p, dialogue=["Hi."]),
        "constraints as a string": lambda p: p.update(constraints="keep the label") or p,
        "malformed axis": lambda p: p.update(axis=[[0, 0], ["a", 1]]) or p,
        "shot id is a list": lambda p: shot(p, id=["T01"]),
    }

    def test_wrong_shape_becomes_a_listed_error(self):
        for name, spoil in self.CASES.items():
            with self.subTest(name):
                r = hfd.validate(spoil(project()), CATALOG)
                self.assertTrue(r["errors"], name)

    def test_cli_wrong_shape_exits_1_with_json(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "p.json"
            for name, spoil in self.CASES.items():
                with self.subTest(name):
                    f.write_text(json.dumps(spoil(project())))
                    for cmd in ("validate", "compile"):
                        code, out, err = _cli(cmd, f)
                        self.assertEqual(code, 1)
                        self.assertTrue(json.loads(out)["errors"])
                        self.assertNotIn("Traceback", err)

    def test_score_and_budget_out_of_format_exit_2(self):
        template = json.loads((ROOT / "templates/evaluation.json").read_text())
        bad = {"score": [[1, 2], {**template, "criteria": []},
                         {**template, "criteria": {**template["criteria"], "camera": "good"}}],
               "budget": [[1], {"shots": ["T01"]}, {"shots": {}}]}
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "x.json"
            for cmd, inputs in bad.items():
                for x in inputs:
                    with self.subTest(cmd=cmd, input=x):
                        f.write_text(json.dumps(x))
                        code, _, err = _cli(cmd, f)
                        self.assertEqual(code, 2)
                        self.assertIn("error", json.loads(err))

    def test_unexpected_failure_exits_2_without_traceback(self):
        from unittest import mock
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "p.json"
            f.write_text(json.dumps(project()))
            with mock.patch.object(hfd, "validate", side_effect=TypeError("boom")):
                code, _, err = _cli("validate", f)
        self.assertEqual(code, 2)
        self.assertIn("TypeError", json.loads(err)["error"])


class Review(unittest.TestCase):
    def test_budget_rounds(self):
        ts = [{"id": f"T0{i}", "test_cost": 7.5, "final_cost": 0.1} for i in range(3)]
        r = hfd.budget(ts, reserve=20, attempts=3)
        self.assertEqual(r["base"], 67.8)
        self.assertEqual(r["total"], 81.36)

    def test_attempts_of_the_shot_warn(self):
        ts = [{"id": "T01", "test_cost": 1, "final_cost": 1, "attempts": 5},
              {"id": "T02", "test_cost": 1, "final_cost": 1}]
        r = hfd.budget(ts, attempts=1)
        self.assertEqual([t["attempts"] for t in r["shots"]], [5, 1])
        self.assertEqual(len(r["warnings"]), 1)
        self.assertIn("T01", r["warnings"][0])
        self.assertEqual(hfd.budget(ts)["warnings"], [])

    def test_subtitles_split_the_shot(self):
        p = shot(project(), dialogue=[{"speaker": "A", "text": "Noir."},
                                      {"speaker": "A", "text": "For the night."}])
        with tempfile.TemporaryDirectory() as d:
            hfd.export(p, d, CATALOG)
            srt = (Path(d) / "subtitles.srt").read_text()
        self.assertIn("00:00:00,000 --> 00:00:01,250", srt)
        self.assertIn("00:00:01,250 --> 00:00:05,000", srt)

    def test_import_requires_out_and_does_not_touch_the_skill(self):
        snapshot = ROOT / "data/models.json"
        before = snapshot.read_bytes()
        base = {"generated_at": "2099-01-01", "models": {
            "old": {"id": "old", "type": "video"}, "img": {"id": "img", "type": "image"}}}
        listing = {"items": [{"id": "new", "name": "New", "output_type": "video",
                              "parameters": [{"name": "duration", "options": [5]}]}]}
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "base.json").write_text(json.dumps(base))
            (Path(d) / "list.json").write_text(json.dumps(listing))
            code, _, err = _cli("models", "--import", Path(d) / "list.json")
            self.assertEqual(code, 2)
            self.assertIn("--out", json.loads(err)["error"])
            code, out, _ = _cli("models", "--import", Path(d) / "list.json", "--snapshot", Path(d) / "base.json",
                                "--out", Path(d) / "new.json")
            self.assertEqual(code, 0)
            r = json.loads(out)
            self.assertEqual(r["removed"], ["old"])
            new = json.loads((Path(d) / "new.json").read_text())
            self.assertEqual(sorted(new["models"]), ["img", "new"])
            code, out, _ = _cli("models", "--id", "new", "--snapshot", Path(d) / "new.json")
            self.assertEqual(code, 0)
        self.assertEqual(snapshot.read_bytes(), before)

    def test_import_get_of_one_model_does_not_delete_the_others(self):
        base = {"generated_at": "2099-01-01", "models": {
            "other": {"id": "other", "type": "video"}, "cs4": {"id": "cs4", "type": "video", "duration": {"max": 5}}}}
        get = {"id": "cs4", "name": "Cinema Studio 4.0", "output_type": "video", "aspect_ratios": ["9:16"],
               "parameters": [{"name": "duration", "min": 4, "max": 30}],
               "medias": [{"name": "medias", "roles": ["start_image"]}]}
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "base.json").write_text(json.dumps(base))
            (Path(d) / "get.json").write_text(json.dumps(get))
            code, out, _ = _cli("models", "--import", Path(d) / "get.json", "--snapshot", Path(d) / "base.json",
                                "--out", Path(d) / "r.json")
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(out)["removed"], [])
            r = json.loads((Path(d) / "r.json").read_text())
            self.assertEqual(sorted(r["models"]), ["cs4", "other"])
            self.assertEqual(r["models"]["cs4"]["duration"]["max"], 30)
            p = shot(project(), duration=12)
            (Path(d) / "p.json").write_text(json.dumps(p))
            code, out, _ = _cli("validate", Path(d) / "p.json", "--snapshot", Path(d) / "r.json")
            self.assertEqual(code, 0, out)

    def test_import_get_keeps_the_age_of_the_other_models(self):
        base = copy.deepcopy(CATALOG)
        base["generated_at"] = "2020-01-01"
        get = {"id": "cs4", "name": "Cinema Studio 4.0", "output_type": "video",
               "parameters": [{"name": "duration", "min": 4, "max": 30}]}
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "base.json").write_text(json.dumps(base))
            (Path(d) / "get.json").write_text(json.dumps(get))
            hfd.import_models([Path(d) / "get.json"], Path(d) / "new.json", Path(d) / "base.json")
            snapshot = hfd.load_models(Path(d) / "new.json")
            self.assertEqual(snapshot["models"]["silent"]["generated_at"], "2020-01-01")
            self.assertEqual(snapshot["models"]["cs4"]["generated_at"], snapshot["generated_at"])
            old = hfd.validate(project(model="silent"), snapshot)
            self.assertTrue(any("models snapshot is" in w for w in old["warnings"]))
            self.assertEqual(hfd.compile_project(project(model="silent"), snapshot)["models_snapshot"], "2020-01-01")

    def test_given_snapshot_applies_in_validation(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "r.json").write_text(json.dumps(CATALOG))
            (Path(d) / "p.json").write_text(json.dumps(project()))
            code, out, _ = _cli("validate", Path(d) / "p.json", "--snapshot", Path(d) / "r.json")
            self.assertEqual(code, 0)
            self.assertNotIn("is not in the snapshot", out)
            code, _, err = _cli("validate", Path(d) / "p.json", "--snapshot", Path(d) / "missing.json")
            self.assertEqual(code, 2)


class Skill(unittest.TestCase):
    def setUp(self):
        self.txt = (ROOT / "SKILL.md").read_text(encoding="utf-8")

    def test_frontmatter(self):
        m = re.match(r"^---\nname: ([a-z0-9-]+)\ndescription: (.+?)\n---\n", self.txt, re.S)
        self.assertTrue(m, "frontmatter with name and description")
        self.assertEqual(m.group(1), "higgsfield-director")
        self.assertLessEqual(len(m.group(2)), 1024)

    def test_rc3_every_cited_path_exists(self):
        texts = [self.txt] + [p.read_text(encoding="utf-8") for p in (ROOT / "references").glob("*.md")]
        cited = set()
        for t in texts:
            cited |= set(re.findall(r"`((?:references|scripts|templates|data)/[\w./-]+)`", t))
        self.assertTrue(cited)
        missing = [c for c in cited if not (ROOT / c).exists()]
        self.assertEqual(missing, [])

    def test_skill_md_size(self):
        self.assertLessEqual(len(self.txt.splitlines()), 200)


def _silent(args):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = hfd.main([str(a) for a in args])
    return code, out.getvalue(), err.getvalue()


def _evaluation(value):
    return {"type": "result", "file": "x.mp4",
            "criteria": {k: {"score": value, "evidence": "seen"} for k in
                         ("identity", "motion", "camera", "lighting", "materials", "continuity", "briefing",
                          "audio")}}


class ModesAndCalibration(unittest.TestCase):
    def test_preferences_without_file_ask_the_question(self):
        with tempfile.TemporaryDirectory() as d:
            r = hfd.preferences(Path(d) / "p.json")
            self.assertFalse(r["defined"])
            self.assertIn("question", r)

    def test_first_use_question_asks_only_the_working_mode(self):
        """A blind test pays for both sides, so the skill runs one only when the operator asks for it."""
        with tempfile.TemporaryDirectory() as d:
            question = hfd.preferences(Path(d) / "p.json")["question"]
            self.assertNotIn("calibrat", question.lower())
            self.assertNotIn("blind", question.lower())
            self.assertIn("ceiling", question)

    def test_preferences_write_and_read(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "sub" / "p.json"
            hfd.preferences(f, "follow", "yes")
            r = hfd.preferences(f)
            self.assertTrue(r["defined"])
            self.assertEqual((r["mode"], r["calibrate"]), ("follow", "yes"))
            self.assertNotIn("question", r)

    def test_preferences_refuse_a_spending_field(self):
        """The file stores how to work, never how much to spend: a ceiling planted in the file is refused."""
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "p.json"
            f.write_text('{"mode": "ceiling", "ceiling_credits": 500}', encoding="utf-8")
            with self.assertRaises(hfd.Error):
                hfd.preferences(f)
            self.assertEqual(_silent(["preferences", "--file", f])[0], 2)

    def test_preferences_invalid_mode(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(SystemExit) as cm, redirect_stderr(io.StringIO()):
                hfd.main(["preferences", "--mode", "free", "--file", str(Path(d) / "p")])
            self.assertEqual(cm.exception.code, 2)
            with self.assertRaises(hfd.Error):
                hfd.preferences(Path(d) / "p.json", calibrate="yes")

    def _pair(self):
        base = {"model": "cs4", "duration": 5, "aspect_ratio": "9:16", "resolution": "480p", "generate_audio": True}
        with_ = [{"index": i, "params": {**base, "prompt": f"with {i}", "count": 1}} for i in (1, 2)]
        without = {"requests": [{"index": i, "params": {**base, "prompt": f"without {i}"}} for i in (1, 2)]}
        return with_, without

    def test_blind_draws_and_keeps_the_key_closed(self):
        with_, without = self._pair()
        for draw, x_is in ((0, "with"), (1, "without")):
            with tempfile.TemporaryDirectory() as d:
                r = hfd.blind(with_, without, Path(d) / "r", draw, order=draw)
                self.assertEqual(r["errors"], [])
                self.assertEqual(r["show_first"], "XY"[draw])
                out = json.dumps(r, ensure_ascii=False)
                self.assertNotIn('"with"', out)  # the output does not reveal who is who
                self.assertNotIn('"without"', out)
                key = json.loads((Path(d) / "r" / "blind-key.json").read_text(encoding="utf-8"))
                self.assertEqual(key[x_is], "X")
                self.assertEqual((Path(d) / "r" / "blind-key.json").stat().st_mode & 0o777, 0o600)
                requests = json.loads((Path(d) / "r" / "blind-requests.json").read_text(encoding="utf-8"))
                self.assertEqual([p["index"] for p in requests], [11, 12, 21, 22])
                self.assertEqual(requests[0]["params"]["prompt"].split()[0], x_is)
                self.assertNotIn("count", json.dumps(requests))
                with self.assertRaises(hfd.Error):  # one draw per folder
                    hfd.blind(with_, without, Path(d) / "r")

    def test_blind_refuses_a_different_format(self):
        with_, without = self._pair()
        without["requests"][1]["params"]["resolution"] = "720p"
        with tempfile.TemporaryDirectory() as d:
            r = hfd.blind(with_, without, Path(d) / "r")
            self.assertTrue(any("resolution" in e for e in r["errors"]))
            self.assertFalse((Path(d) / "r").exists())
            self.assertTrue(hfd.blind(with_, without["requests"][:1], Path(d) / "s")["errors"][0]
                            .startswith("--with has"))

    def test_result_translates_the_vote_through_the_key(self):
        rec, errors = hfd.result({"with": "Y", "without": "X"}, "Y", "trailer", "cs4", 3, 90, "5.1.0+abcdef1",
                                 evaluation_x=_evaluation(6), evaluation_y=_evaluation(8), reason="more emotion",
                                 first="X")
        self.assertEqual(errors, [])
        self.assertEqual(rec["vote"], "with")
        self.assertEqual(rec["scores"]["with"]["total"], 80.0)
        self.assertEqual(rec["scores"]["without"]["total"], 60.0)
        self.assertEqual(rec["rater"], "blind-auto")
        self.assertEqual(rec["seen_first"], "without")

    def test_record_allowlist(self):
        rec, _ = hfd.result({"with": "X", "without": "Y"}, "tie", "loop", "cs4", 1, 10, "5.1.0")
        self.assertEqual(hfd.check_record(rec), [])
        for bad in ({**rec, "prompt": "a shoe"}, {**rec, "reason": "write to a@b.com"},
                    {**rec, "reason": "see https://x.y"}, {**rec, "category": "client-acme"},
                    {**rec, "shots": True}, {**rec, "scores": {"with": {"total": 120}}},
                    {**rec, "seen_first": "X"}):
            self.assertTrue(hfd.check_record(bad), bad)

    def test_result_cli_writes_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            key = Path(d) / "key.json"
            key.write_text('{"with": "X", "without": "Y"}', encoding="utf-8")
            out = Path(d) / "calibration" / "2026-01-01-trailer-a1.json"
            args = ["result", "--key", key, "--vote", "X", "--category", "trailer", "--model", "cs4",
                    "--shots", "3", "--cost", "90", "--version", "5.1.0", "--out", out]
            self.assertEqual(_silent(args)[0], 0)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["cost_credits"], 90)
            self.assertEqual(_silent(args)[0], 2)

    def test_repository_records_pass(self):
        folder = ROOT.parent / "calibration"
        files = sorted(folder.glob("*.json")) if folder.exists() else []
        for f in files:
            self.assertEqual(hfd.check_record(json.loads(f.read_text(encoding="utf-8"))), [], f.name)


# --------------------------------------------------------------------------- 6.x compatibility with the 5.x names
# The Portuguese names below are the old 5.x names on purpose: 6.x must still read them.

def _warnings(err):
    """The stderr warnings, one JSON object per line."""
    return [json.loads(line)["warning"] for line in err.splitlines() if line.strip()]


def _to_old_snapshot(cat):
    """The catalog written with the 5.x names, as an old data/modelos.json or --retrato file."""
    model = {"name": "nome", "provider": "fornecedor", "type": "tipo", "description": "descricao",
             "media": "midias", "modes": "modos", "parameters": "parametros", "aspect_ratios": "proporcoes",
             "resolution": "resolucao", "duration": "duracao", "audio_in_tags": "audio_nas_tags",
             "generated_at": "gerado_em"}
    inner = {"parameter": "parametro", "options": "opcoes", "default": "padrao", "range": "faixa"}
    models = {}
    for k, m in cat["models"].items():
        old = {}
        for field, v in m.items():
            if field in ("audio", "resolution", "duration") and isinstance(v, dict):
                v = {inner.get(a, a): b for a, b in v.items()}
            old[model.get(field, field)] = v
        models[k] = old
    models["ranged"] = {"id": "ranged", "tipo": "video", "proporcoes": [], "midias": [],
                        "duracao": {"faixa": {"min": 4, "max": 15}}}
    return {"fonte": "test", "gerado_em": cat["generated_at"], "modelos": models}


OLD_FULL_PROJECT = {
    "titulo": "Old", "modelo": "cs4", "modo": "t2v", "proporcao": "9:16", "resolucao": "720p",
    "biblias": {"P01": {"tipo": "produto", "descricao": "A black bottle", "fixo": {"color": "black"},
                        "variavel": {"position": "can change"}}},
    "restricoes": ["Keep the label readable."], "preservar": ["label"], "referencias": ["start_image"],
    "alvo": "the cap", "sujeito": "A bottle", "ambiente": "A studio", "luz": "Soft light", "estetica": "Noir",
    "eixo": [[0, 0], [4, 0]],
    "tomadas": [{"id": "T01", "duracao": 5, "entidades": ["P01"], "sujeito": "A glass bottle",
                 "ambiente": "A dark studio", "acao": "It rests", "microacao": "Mist drifts", "enquadramento": "Close-up",
                 "camera": "slow orbit", "otica": "85mm look", "luz": "Rim light", "estetica": "Luxury",
                 "atmosfera": "Haze", "secundario": "Dust", "final": "Cap on top", "som": "Hum",
                 "falas": [{"quem": "A", "idioma": "English", "texto": "Hi."}],
                 "inicio": {"P01": {"position": "plinth"}}, "fim": {"P01": {"position": "plinth"}},
                 "mudancas_aprovadas": ["P01.position"], "camera_xy": [1, -2], "cruzamento_motivado": True,
                 "linha_do_tempo": [{"trilha": "camera", "de": 0, "ate": 3}], "custo_teste": 10,
                 "custo_final": 35, "tentativas": 3, "referencias": ["ref"], "preservar": ["shape"],
                 "restricoes": ["No text."], "alvo": "the label"}],
}
NEW_FULL_PROJECT = {
    "title": "Old", "model": "cs4", "mode": "t2v", "aspect_ratio": "9:16", "resolution": "720p",
    "bibles": {"P01": {"type": "product", "description": "A black bottle", "fixed": {"color": "black"},
                       "variable": {"position": "can change"}}},
    "constraints": ["Keep the label readable."], "preserve": ["label"], "references": ["start_image"],
    "target": "the cap", "subject": "A bottle", "setting": "A studio", "lighting": "Soft light", "aesthetic": "Noir",
    "axis": [[0, 0], [4, 0]],
    "shots": [{"id": "T01", "duration": 5, "entities": ["P01"], "subject": "A glass bottle",
               "setting": "A dark studio", "action": "It rests", "micro_action": "Mist drifts", "framing": "Close-up",
               "camera": "slow orbit", "optics": "85mm look", "lighting": "Rim light", "aesthetic": "Luxury",
               "atmosphere": "Haze", "secondary": "Dust", "final": "Cap on top", "sound": "Hum",
               "dialogue": [{"speaker": "A", "language": "English", "text": "Hi."}],
               "start": {"P01": {"position": "plinth"}}, "end": {"P01": {"position": "plinth"}},
               "approved_changes": ["P01.position"], "camera_xy": [1, -2], "motivated_crossing": True,
               "timeline": [{"track": "camera", "from": 0, "to": 3}], "test_cost": 10,
               "final_cost": 35, "attempts": 3, "references": ["ref"], "preserve": ["shape"],
               "constraints": ["No text."], "target": "the label"}],
}


# language-check: off  (these tests feed the old Portuguese names on purpose)
class OldNames(unittest.TestCase):
    """6.x still accepts the 5.x Portuguese names, with a warning that names the new one; output is English only."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.d = Path(self.dir.name)
        (self.d / "catalog.json").write_text(json.dumps(CATALOG))

    def tearDown(self):
        self.dir.cleanup()

    def write(self, name, data):
        (self.d / name).write_text(json.dumps(data), encoding="utf-8")
        return self.d / name

    def test_old_subcommand_works_and_warns(self):
        f = self.write("p.json", project())
        code, out, err = _cli("validar", f, "--snapshot", self.d / "catalog.json")
        new_code, new_out, new_err = _cli("validate", f, "--snapshot", self.d / "catalog.json")
        self.assertEqual((code, out), (new_code, new_out))
        self.assertEqual(new_err, "")
        self.assertEqual(_warnings(err),
                         ["deprecated: 'validar' is now 'validate'; the old name will be removed in 7.0"])
        for old, new in (("compilar", "compile"), ("pontuar", "score"), ("otica", "optics")):
            arg = ROOT / "templates/evaluation.json" if new == "score" else f
            args = ["50", "4"] if new == "optics" else [arg]
            code, out, err = _cli(old, *args)
            self.assertEqual((code, out), _cli(new, *args)[:2], old)
            self.assertEqual(len(_warnings(err)), 1, old)

    def test_old_options_and_values_work_and_warn(self):
        key = self.write("key.json", {"com": "X", "sem": "Y"})
        out = self.d / "calibration" / "2026-01-01-product-ad-a1.json"
        code, stdout, err = _cli("resultado", "--chave", key, "--voto", "empate", "--categoria=anuncio-produto",
                                 "--modelo", "cs4", "--tomadas", "3", "--custo", "90", "--versao", "5.1.0",
                                 "--primeiro", "juntos", "--saida", out)
        self.assertEqual(code, 0, err)
        rec = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual((rec["vote"], rec["category"], rec["seen_first"]), ("tie", "product-ad", "together"))
        self.assertLessEqual(set(rec), hfd.RECORD_FIELDS)
        self.assertEqual(set(json.loads(stdout)), {"errors", "record", "file", "reminder"})
        warnings = _warnings(err)
        for old, new in (("resultado", "result"), ("--chave", "--key"), ("--voto", "--vote"), ("empate", "tie"),
                         ("--categoria", "--category"), ("anuncio-produto", "product-ad"), ("--saida", "--out"),
                         ("--primeiro", "--first"), ("juntos", "together"), ("--versao", "--version")):
            self.assertIn(f"deprecated: '{old}' is now '{new}'; the old name will be removed in 7.0", warnings)
        self.assertEqual(len([w for w in warnings if w.startswith("deprecated:")]), 13)
        self.assertEqual(len([w for w in warnings if "old 5.x names" in w and "com, sem" in w]), 1)  # the key file

    def test_old_project_file_loads_with_one_warning(self):
        self.assertEqual(hfd.translate_project(copy.deepcopy(OLD_FULL_PROJECT))[0], NEW_FULL_PROJECT)
        old = {"modelo": "cs4", "modo": "t2v", "proporcao": "9:16",
               "tomadas": [{"id": "T01", "duracao": 5, "sujeito": "A glass bottle", "acao": "It rests on a plinth",
                            "camera": "slow orbit", "som": "soft glass chime",
                            "falas": [{"quem": "A", "idioma": "English", "texto": "Hi."}],
                            "linha_do_tempo": [{"trilha": "camera", "de": 0, "ate": 3}],
                            "custo_teste": 10, "custo_final": 35, "tentativas": 1}]}
        new = shot(project(), sound="soft glass chime", dialogue=[{"speaker": "A", "language": "English", "text": "Hi."}],
                   timeline=[{"track": "camera", "from": 0, "to": 3}], test_cost=10, final_cost=35, attempts=1)
        old_f, new_f = self.write("old.json", old), self.write("new.json", new)
        for cmd in ("validate", "compile", "budget"):
            with self.subTest(cmd):
                extra = [] if cmd == "budget" else ["--snapshot", self.d / "catalog.json"]
                code, out, err = _cli(cmd, old_f, *extra)
                new_code, new_out, _ = _cli(cmd, new_f, *extra)
                self.assertEqual((code, err), (new_code, ""))
                r, expected = json.loads(out), json.loads(new_out)
                first = r["warnings"].pop(0)
                self.assertEqual(r, expected)
                self.assertTrue(first.startswith(f"{old_f}: read with old 5.x names ("), first)
                for name in ("tomadas", "falas", "quem", "linha_do_tempo", "custo_teste"):
                    self.assertIn(name, first)
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            self.assertEqual(_cli("exportar", old_f, a, "--retrato", self.d / "catalog.json")[0], 0)
            _cli("export", new_f, b, "--snapshot", self.d / "catalog.json")
            for name in ("script.md", "shots.csv", "subtitles.srt"):
                self.assertEqual((Path(a) / name).read_text(), (Path(b) / name).read_text(), name)

    def test_old_and_new_name_of_the_same_field_is_an_error(self):
        cases = {
            "project": ("validate", {**project(), "tomadas": project()["shots"]}, ("'tomadas'", "'shots'")),
            "shot": ("validate", shot(project(), duracao=5), ("'duracao'", "'duration'")),
            "dialogue": ("compile", shot(project(), dialogue=[{"speaker": "A", "quem": "B", "text": "Hi."}]),
                         ("'quem'", "'speaker'")),
            "evaluation": ("score", {**json.loads((ROOT / "templates/evaluation.json").read_text()), "tipo": "result"},
                           ("'tipo'", "'type'")),
        }
        for name, (cmd, data, words) in cases.items():
            with self.subTest(name):
                code, out, err = _cli(cmd, self.write("x.json", data))
                self.assertEqual((code, out), (2, ""))
                error = json.loads(err)["error"]
                for w in words:
                    self.assertIn(w, error)
        f = self.write("prefs.json", {"modo": "follow", "mode": "follow"})
        self.assertEqual(_cli("preferences", "--file", f)[0], 2)
        with self.assertRaises(hfd.Error):
            hfd.translate_record({"voto": "com", "vote": "with"})

    def test_old_preferences_file_is_read(self):
        cwd = os.getcwd()
        os.chdir(self.d)
        try:
            folder = Path(".higgsfield-director")
            folder.mkdir()
            old = folder / "preferencias.json"
            old.write_text('{"modo": "acompanhar", "calibrar": "sim", "atualizado_em": "2026-01-01"}\n',
                           encoding="utf-8")
            code, out, err = _cli("preferences")
            self.assertEqual(code, 0)
            r = json.loads(out)
            self.assertEqual((r["defined"], r["mode"], r["calibrate"], r["updated_at"], r["file"]),
                             (True, "follow", "yes", "2026-01-01", str(old)))
            warnings = _warnings(err)
            self.assertEqual(len(warnings), 2)
            self.assertIn("preferences.json", warnings[0])
            self.assertIn("modo", warnings[1])
            code, out, err = _cli("preferencias", "--modo", "preco")
            self.assertEqual(code, 0)
            new = json.loads((folder / "preferences.json").read_text(encoding="utf-8"))
            self.assertEqual((new["mode"], new["calibrate"]), ("price", "yes"))
            self.assertEqual(set(new), {"mode", "calibrate", "updated_at"})
            self.assertIn("deprecated: 'preco' is now 'price'; the old name will be removed in 7.0", _warnings(err))
            self.assertIn('"modo": "acompanhar"', old.read_text(encoding="utf-8"))  # the old file is left as it was
            code, out, err = _cli("preferences")
            self.assertEqual((code, err, json.loads(out)["mode"]), (0, "", "price"))
        finally:
            os.chdir(cwd)

    def test_old_snapshot_loads(self):
        old = self.write("old.json", _to_old_snapshot(CATALOG))
        warnings = []
        cat = hfd.load_models(old, warnings)
        self.assertEqual({k: v for k, v in cat["models"].items() if k != "ranged"}, CATALOG["models"])
        self.assertEqual(cat["generated_at"], CATALOG["generated_at"])
        self.assertEqual(len(warnings), 1)
        p = self.write("p.json", project())
        code, out, err = _cli("validate", p, "--snapshot", old)
        self.assertEqual((code, err), (0, ""))
        r = json.loads(out)
        self.assertEqual(len(r["warnings"]), 1)
        self.assertIn("modelos", r["warnings"][0])
        code, out, err = _cli("models", "--snapshot", old, "--id", "cs4")
        self.assertEqual(json.loads(out), CATALOG["models"]["cs4"])
        self.assertEqual(len(_warnings(err)), 1)
        ranged = self.write("ranged.json", shot(project(model="ranged"), duration=16))
        code, out, _ = _cli("validate", ranged, "--snapshot", old)
        self.assertEqual(code, 1)
        self.assertTrue(any("above the maximum" in e for e in json.loads(out)["errors"]))

    def test_old_evaluation_scores_the_same(self):
        new = json.loads((ROOT / "templates/evaluation.json").read_text())
        names = {"identity": "identidade", "motion": "movimento", "lighting": "luz", "materials": "materiais",
                 "continuity": "continuidade"}
        fields = {"score": "nota", "evidence": "evidencia", "not_applicable": "nao_se_aplica"}
        old = {"tipo": "resultado", "arquivo": new["file"], "falha_critica": new["critical_failure"],
               "criterios": {names.get(k, k): {fields[a]: b for a, b in c.items()}
                             for k, c in new["criteria"].items()}}
        code, out, err = _cli("score", self.write("old.json", old))
        self.assertEqual((code, json.loads(out)), (0, hfd.score(new)))
        self.assertEqual(len(_warnings(err)), 1)

    def test_old_calibration_record_translates(self):
        old = {"formato": 1, "data": "2026-11-24", "versao_skill": "5.1.0+e4dee7b", "categoria": "anuncio-produto",
               "modelo": "cs4", "tomadas": 3, "custo_creditos": 92, "referencia_de_imagem": True, "voto": "com",
               "avaliador": "cego-automatico", "visto_primeiro": "sem", "motivo": "free text",
               "notas": {"com": {"total": 82.5, "criterios": {"identidade": 8.7, "luz": 9.0}},
                         "sem": {"total": 73.8}}}
        new, found = hfd.translate_record(old)
        self.assertEqual(new, {"format": 1, "date": "2026-11-24", "skill_version": "5.1.0+e4dee7b",
                               "category": "product-ad", "model": "cs4", "shots": 3, "cost_credits": 92,
                               "image_reference": True, "vote": "with", "rater": "blind-auto",
                               "seen_first": "without", "reason": "free text",
                               "scores": {"with": {"total": 82.5, "criteria": {"identity": 8.7, "lighting": 9.0}},
                                          "without": {"total": 73.8}}})
        self.assertEqual(hfd.check_record(new), [])
        self.assertIn("anuncio-produto", found)


if __name__ == "__main__":
    unittest.main()

# language-check: on

class Crop(unittest.TestCase):
    """Phase B of the sketch: hfd writes the crop commands; it runs nothing."""

    def test_valid_box_becomes_a_fractional_crop(self):
        r = hfd.crop("sheet.png", "frames", ["T01:0.04,0.07,0.33,0.48"])
        self.assertEqual(r["errors"], [])
        cmd = r["commands"][0]["command"]
        self.assertEqual(cmd[0], "ffmpeg")
        self.assertIn("-n", cmd, "never overwrites an existing crop")
        self.assertIn("crop=w=iw*0.2700:h=ih*0.3900:x=iw*0.0500:y=ih*0.0800", cmd)
        self.assertEqual(cmd[-1], str(Path("frames") / "T01.png"))

    def test_invalid_boxes_become_errors_without_a_command(self):
        r = hfd.crop("f.png", "q", ["A:0.5,0.1,0.4,0.9", "B:0,0,1", "C D:0,0,1,1", "E:0,0,0.02,0.02",
                                    "F:0,0,1,1", "F:0,0,0.5,0.5"])
        self.assertEqual([c["frame"] for c in r["commands"]], ["F"])
        self.assertEqual(len(r["errors"]), 5)

    def test_cli_exits_with_1_when_there_is_an_error(self):
        code, out, _ = _cli("crop", "f.png", "q", "A:0,0,0.5,0.5", "B:2,0,3,1")
        self.assertEqual(code, 1)
        self.assertEqual(len(json.loads(out)["commands"]), 1)
        code, _, err = _cli("crop", "f.png", "q", "A:0,0,1,1", "--margin", "0.5")
        self.assertEqual(code, 2)
        self.assertIn("margin", err)

    @unittest.skipUnless(__import__("shutil").which("ffmpeg"), "no ffmpeg on this machine")
    def test_real_crop(self):
        import subprocess
        with tempfile.TemporaryDirectory() as d:
            sheet = Path(d) / "sheet.png"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=white:s=400x200", "-frames:v", "1",
                            str(sheet)], check=True)
            r = hfd.crop(sheet, d, ["Q1:0,0,0.5,1", "Q2:0.5,0,1,1"], margin=0)
            for c in r["commands"]:
                subprocess.run(c["command"], check=True)
            for name in ("Q1", "Q2"):
                out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of",
                                      "csv=p=0", str(Path(d) / f"{name}.png")], capture_output=True, text=True)
                self.assertEqual(out.stdout.strip(), "200,200")
