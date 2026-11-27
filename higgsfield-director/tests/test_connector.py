"""Tests of connector.py, with no network and no sign-in. Run from the skill root:
python3 -m unittest discover -s tests -v

The prices here are made up, 0 or at least 1000 credits, as in test_hfd.py.
"""
import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import connector  # noqa: E402
from test_hfd import CATALOG  # noqa: E402


def _quote(credits):
    return {"content": [{"type": "text", "text": json.dumps({"cost": {"credits": credits, "credits_exact": credits},
                                                             "quote_ref": "quote:x"})}]}


class Connector(unittest.TestCase):
    def test_only_the_free_tools_can_be_called(self):
        s = connector.Session({"server": "https://example.test/mcp", "access_token": "t"})
        with mock.patch.object(connector.Session, "request") as req:
            for name in ("generate_video", "generate_image", "generate_video_batch", "execute_preset",
                         "media_upload", "upscale_video", "balance"):
                with self.subTest(name=name), self.assertRaises(connector.Error):
                    s.call(name, {"params": {}})
            req.assert_not_called()
        self.assertEqual(set(connector.ALLOWED), {"estimate_video_cost", "estimate_image_cost", "models_explore"})

    def test_the_answer_is_read_from_json_or_from_events(self):
        answer = {"jsonrpc": "2.0", "id": 3, "result": {"ok": True}}
        events = ('event: message\r\ndata: {"jsonrpc": "2.0", "method": "notifications/progress"}\r\n\r\n'
                  f"event: message\r\ndata: {json.dumps(answer)}\r\n\r\n").encode()
        for ctype, body in (("application/json", json.dumps(answer).encode()),
                            ("application/json", json.dumps([{"jsonrpc": "2.0", "id": 1}, answer]).encode()),
                            ("text/event-stream; charset=utf-8", events)):
            with self.subTest(ctype=ctype):
                self.assertEqual(connector.rpc_answer(ctype, body, 3), answer)
        for ctype, body in (("application/json", json.dumps({"id": 4}).encode()), ("application/json", b"<html>"),
                            ("text/event-stream", b"data: nothing\n\n")):
            with self.subTest(body=body), self.assertRaises(connector.Error):
                connector.rpc_answer(ctype, body, 3)

    def test_the_credits_come_from_the_estimate_answer(self):
        exact = {"content": [{"type": "text", "text": '{"cost": {"credits": 1001, "credits_exact": 1000.5}}'}]}
        self.assertEqual(connector.credits_of(exact), 1000.5)
        self.assertEqual(connector.credits_of({"structuredContent": {"cost": {"credits": 2000}}}), 2000)
        for nothing in ({"isError": True, **_quote(3000)}, {"content": [{"type": "text", "text": "not json"}]},
                        {"content": [{"type": "text", "text": '{"quote_ref": "q"}'}]},
                        {"content": [{"type": "text", "text": '{"cost": {"credits": true}}'}]}, None):
            with self.subTest(answer=nothing):
                self.assertIsNone(connector.credits_of(nothing))

    def test_the_sign_in_is_readable_by_the_operator_alone(self):
        with tempfile.TemporaryDirectory() as d:
            store = Path(d) / "conf" / "connector.json"
            with mock.patch.object(connector, "STORE", store):
                with self.assertRaises(connector.Error):
                    connector._load()
                connector._save({"access_token": "t"})
                self.assertEqual(stat.S_IMODE(store.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(store.parent.stat().st_mode), 0o700)
                self.assertEqual(connector._load(), {"access_token": "t"})
                os.chmod(store, 0o644)
                with self.assertRaises(connector.Error):
                    connector._load()

    def test_the_sign_in_endpoints_come_from_the_server(self):
        prm = {"resource": "https://example.test/mcp", "authorization_servers": ["https://auth.example.test"]}
        meta = {"issuer": "https://auth.example.test", "authorization_endpoint": "https://auth.example.test/a",
                "token_endpoint": "https://auth.example.test/t", "registration_endpoint": "https://auth.example.test/r"}

        def answers(prm, meta):
            return lambda method, url, *a, **k: (200, {}, json.dumps(
                prm if url.endswith("oauth-protected-resource") else meta).encode())

        with mock.patch.object(connector, "_http", answers(prm, meta)):
            self.assertEqual(connector.discover("https://example.test/mcp"), ("https://example.test/mcp", meta))
        for p, m in (({**prm, "authorization_servers": []}, meta), (prm, {**meta, "token_endpoint": "http://x/t"})):
            with self.subTest(p=p, m=m), mock.patch.object(connector, "_http", answers(p, m)), \
                    self.assertRaises(connector.Error):
                connector.discover("https://example.test/mcp")

    def test_prices_quotes_the_plan_and_imports_it(self):
        calls = []

        def request(method, params=None):
            calls.append(params["name"])
            model = params["arguments"]["params"]["model"]
            return {"isError": True} if model == "kling" else _quote(1000 * len(calls))

        with tempfile.TemporaryDirectory() as d:
            snap, table = Path(d) / "catalog.json", Path(d) / "prices.json"
            snap.write_text(json.dumps(CATALOG), encoding="utf-8")
            with mock.patch.object(connector, "_access", return_value={"server": "x", "access_token": "t"}), \
                    mock.patch.object(connector.Session, "open", return_value={}), \
                    mock.patch.object(connector.Session, "request", side_effect=request):
                r = connector.prices(models="cs4,kling", snapshot=snap, table=table)
            rows = json.loads(table.read_text(encoding="utf-8"))["rows"]
        self.assertEqual((r["requests"], r["quoted"]), (len(calls), len(calls) - 1))
        self.assertEqual([m.split(":")[0] for m in r["missing"]], ["kling"])
        self.assertEqual(len(rows), len(calls) - 1)
        self.assertTrue(all(c in connector.ALLOWED for c in calls))
        self.assertEqual(r["summary"], "first price table of this project")

    def test_logout_without_a_sign_in_is_quiet(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(connector, "STORE", Path(d) / "none.json"):
            self.assertEqual(connector.logout(), {"signed_in": False})


if __name__ == "__main__":
    unittest.main()
