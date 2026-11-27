#!/usr/bin/env python3
"""The connector's free quotes without the model: this script talks to the Higgsfield connector's server itself.

Every step a script takes costs the agent no tokens (AGENTS.md, "Scripts before the model"). The day's price table
is many small requests, so this script makes them, and the agent runs one command and reads one summary.

    python3 connector.py login              # once: the operator signs in to Higgsfield in the browser
    python3 connector.py prices [options]   # the day's table: plan, quote each request, import; prints the summary
    python3 connector.py status             # the stored sign-in, and whether the server has the tools used here
    python3 connector.py logout             # revokes the sign-in and deletes it

The sign-in is the operator's own. It is stored only on this computer, in a file only the operator can read
(~/.config/higgsfield-director/connector.json), never in a project or in this repository, and never printed. The
sign-in endpoints are read from the server each time (RFC 9728 and RFC 8414), not written here. The script calls only
the tools in ALLOWED, which are free and generate nothing; any other tool is refused in code. Standard library only.
"""
import argparse
import base64
import hashlib
import json
import os
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

SERVER = os.environ.get("HFD_CONNECTOR_URL", "https://mcp.higgsfield.ai/mcp")
STORE = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "higgsfield-director" / "connector.json"
ALLOWED = ("estimate_video_cost", "estimate_image_cost", "models_explore")  # free, and they generate nothing
SCOPE = "openid email offline_access"
PORT = 8976  # the sign-in comes back to http://127.0.0.1:8976/callback
PROTOCOL = "2025-06-18"
AGENT = "higgsfield-director-connector"
HFD = Path(__file__).resolve().parent / "hfd.py"


class Error(Exception):
    pass


def _http(method, url, body=None, headers=None, form=False, timeout=60):
    h = {"User-Agent": AGENT, **(headers or {})}
    data = None
    if body is not None:
        data = (urllib.parse.urlencode(body) if form else json.dumps(body)).encode("utf-8")
        h["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()
    except (urllib.error.URLError, OSError) as e:
        raise Error(f"{urllib.parse.urlsplit(url).netloc}: {e}")


def _json(status, body, what):
    if status >= 400:
        raise Error(f"{what}: HTTP {status} {body[:300].decode('utf-8', 'replace')}")
    try:
        return json.loads(body)
    except ValueError:
        raise Error(f"{what}: the answer is not JSON")


def _b64(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def discover(server=SERVER):
    """The resource and its sign-in server's endpoints, as the server publishes them today."""
    u = urllib.parse.urlsplit(server)
    s, _, b = _http("GET", f"{u.scheme}://{u.netloc}/.well-known/oauth-protected-resource")
    prm = _json(s, b, "protected resource metadata")
    auth = (prm.get("authorization_servers") or [None])[0]
    if not isinstance(auth, str) or not auth.startswith("https://"):
        raise Error("the server names no sign-in server")
    s, _, b = _http("GET", auth.rstrip("/") + "/.well-known/oauth-authorization-server")
    meta = _json(s, b, "sign-in server metadata")
    for k in ("authorization_endpoint", "token_endpoint"):
        if not str(meta.get(k, "")).startswith("https://"):
            raise Error(f"the sign-in server publishes no {k}")
    return prm.get("resource") or server, meta


def _save(data, store=None):
    store = Path(store or STORE)
    store.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(store.parent, 0o700)
    fd = os.open(store, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.chmod(store, 0o600)


def _load(store=None):
    store = Path(store or STORE)
    if not store.exists():
        raise Error("not signed in: run connector.py login (the operator signs in once, in the browser)")
    if store.stat().st_mode & 0o077:
        raise Error(f"{store} can be read by others: run connector.py login again")
    try:
        return json.loads(store.read_text(encoding="utf-8"))
    except ValueError:
        raise Error(f"{store} is damaged: run connector.py login again")


def _token(endpoint, client, form):
    form = {**form, "client_id": client["client_id"]}
    if client.get("client_secret"):
        form["client_secret"] = client["client_secret"]
    t = _json(*_http("POST", endpoint, form, form=True)[::2], "token")
    if not t.get("access_token"):
        raise Error("token: the answer has no access token")
    return {"access_token": t["access_token"], "refresh_token": t.get("refresh_token"),
            "expires_at": time.time() + float(t.get("expires_in") or 3600)}


def login(server=SERVER, port=PORT, timeout=600, open_browser=True):
    resource, meta = discover(server)
    redirect = f"http://127.0.0.1:{port}/callback"
    try:
        old = _load()
    except Error:
        old = {}
    client = old.get("client") if old.get("server") == server else None
    if not client or redirect not in (client.get("redirect_uris") or []):
        if not meta.get("registration_endpoint"):
            raise Error("the sign-in server takes no new clients (no registration_endpoint)")
        client = _json(*_http("POST", meta["registration_endpoint"], {
            "client_name": "higgsfield-director (local quotes)", "redirect_uris": [redirect],
            "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
            "token_endpoint_auth_method": "none", "scope": SCOPE})[::2], "client registration")
        if not client.get("client_id"):
            raise Error("client registration: the answer has no client_id")
        client.setdefault("redirect_uris", [redirect])
    verifier, state = _b64(secrets.token_bytes(32)), secrets.token_urlsafe(16)
    url = meta["authorization_endpoint"] + "?" + urllib.parse.urlencode({
        "response_type": "code", "client_id": client["client_id"], "redirect_uri": redirect, "scope": SCOPE,
        "state": state, "code_challenge": _b64(hashlib.sha256(verifier.encode("ascii")).digest()),
        "code_challenge_method": "S256", "resource": resource})
    got = {}

    class Back(BaseHTTPRequestHandler):
        def do_GET(self):
            p = urllib.parse.urlsplit(self.path)
            if p.path != "/callback":
                self.send_response(404)
                self.end_headers()
                return
            got.update(urllib.parse.parse_qs(p.query))
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Signed in. You can close this tab." if "code" in got
                             else b"The sign-in did not finish; see the terminal.")

        def log_message(self, *args):
            pass

    try:
        srv = HTTPServer(("127.0.0.1", port), Back)
    except OSError as e:
        raise Error(f"port {port} on this computer is busy ({e}); try --port")
    srv.timeout = 5
    print(f"sign in to Higgsfield in the browser (waiting {timeout // 60} min): {url}", file=sys.stderr, flush=True)
    if open_browser and sys.platform == "darwin":
        subprocess.run(["open", url], check=False)
    end = time.time() + timeout
    try:
        while not got and time.time() < end:
            srv.handle_request()
    finally:
        srv.server_close()
    first = {k: v[0] for k, v in got.items()}
    if not first:
        raise Error("no sign-in within the time limit")
    if first.get("state") != state:
        raise Error("sign-in: the answer does not match this request; try again")
    if "error" in first:
        raise Error(f"sign-in: {first['error']} {first.get('error_description', '')}".strip())
    if first.get("iss") and meta.get("issuer") and first["iss"] != meta["issuer"]:
        raise Error("sign-in: the answer came from another sign-in server")
    tok = _token(meta["token_endpoint"], client, {"grant_type": "authorization_code", "code": first["code"],
                                                   "redirect_uri": redirect, "code_verifier": verifier,
                                                   "resource": resource})
    _save({"server": server, "resource": resource, "token_endpoint": meta["token_endpoint"],
           "revocation_endpoint": meta.get("revocation_endpoint"), "client": client, **tok})
    return {"signed_in": True, "file": str(STORE), "refresh": bool(tok["refresh_token"])}


def _access():
    s = _load()
    if s.get("expires_at", 0) - 60 < time.time():
        if not s.get("refresh_token"):
            raise Error("the sign-in expired: run connector.py login")
        try:
            tok = _token(s["token_endpoint"], s["client"], {"grant_type": "refresh_token",
                                                            "refresh_token": s["refresh_token"],
                                                            "resource": s["resource"]})
        except Error as e:
            raise Error(f"the sign-in could not be renewed ({e}): run connector.py login")
        tok["refresh_token"] = tok["refresh_token"] or s["refresh_token"]
        s.update(tok)
        _save(s)
    return s


def rpc_answer(content_type, body, want):
    """The JSON-RPC answer with id `want`, from a JSON body or a stream of server-sent events."""
    text = body.decode("utf-8", "replace")
    if "text/event-stream" in (content_type or ""):
        found = []
        for block in text.replace("\r\n", "\n").split("\n\n"):
            data = "\n".join(line[5:].lstrip() for line in block.split("\n") if line.startswith("data:"))
            try:
                found.append(json.loads(data))
            except ValueError:
                continue
    else:
        try:
            x = json.loads(text)
        except ValueError:
            raise Error("server: the answer is not JSON")
        found = x if isinstance(x, list) else [x]
    for m in found:
        if isinstance(m, dict) and m.get("id") == want:
            return m
    raise Error("server: no answer to the request")


class Session:
    """One MCP session over streamable HTTP. It calls tools from ALLOWED only."""

    def __init__(self, store):
        self.url, self.token = store["server"], store["access_token"]
        self.sid, self.version, self.n = None, None, 0

    def _send(self, msg):
        h = {"Authorization": f"Bearer {self.token}", "Accept": "application/json, text/event-stream"}
        if self.sid:
            h["Mcp-Session-Id"] = self.sid
        if self.version:
            h["MCP-Protocol-Version"] = self.version
        s, hdr, b = _http("POST", self.url, msg, h, timeout=120)
        self.sid = hdr.get("mcp-session-id", self.sid)
        if s == 401:
            raise Error("the server refused the sign-in (HTTP 401): run connector.py login")
        if s >= 400:
            raise Error(f"server: HTTP {s} {b[:300].decode('utf-8', 'replace')}")
        return rpc_answer(hdr.get("content-type"), b, msg["id"]) if "id" in msg else None

    def request(self, method, params=None):
        self.n += 1
        r = self._send({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params or {}})
        if r.get("error"):
            raise Error(f"{method}: {r['error'].get('message')}")
        return r.get("result") or {}

    def open(self):
        r = self.request("initialize", {"protocolVersion": PROTOCOL, "capabilities": {},
                                        "clientInfo": {"name": AGENT, "version": "1"}})
        self.version = r.get("protocolVersion") or PROTOCOL
        self._send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return r

    def call(self, name, arguments):
        if name not in ALLOWED:
            raise Error(f"{name}: this script calls only the free tools {', '.join(ALLOWED)}")
        return self.request("tools/call", {"name": name, "arguments": arguments})

    def tools(self):
        names, cursor = [], None
        for _ in range(50):
            r = self.request("tools/list", {"cursor": cursor} if cursor else {})
            names += [t.get("name") for t in r.get("tools") or [] if isinstance(t, dict)]
            cursor = r.get("nextCursor")
            if not cursor:
                break
        return names


def credits_of(result):
    """The credits of an estimate's answer ({"cost": {"credits_exact": N}}, in a text block), or None."""
    if not isinstance(result, dict) or result.get("isError"):
        return None
    blobs = [result.get("structuredContent")] + [c.get("text") for c in result.get("content") or []
                                                if isinstance(c, dict) and c.get("type") == "text"]
    for b in blobs:
        if isinstance(b, str):
            try:
                b = json.loads(b)
            except ValueError:
                continue
        if isinstance(b, dict):
            cost = b.get("cost") if isinstance(b.get("cost"), dict) else b
            for k in ("credits_exact", "credits"):
                if type(cost.get(k)) in (int, float):
                    return cost[k]
    return None


def _hfd(*args):
    p = subprocess.run([sys.executable, str(HFD), *map(str, args)], capture_output=True, text=True)
    try:
        out = json.loads(p.stdout or p.stderr)
    except ValueError:
        raise Error(f"hfd.py {args[0]}: {(p.stderr or p.stdout).strip()[:300]}")
    if p.returncode or "error" in out:
        raise Error(f"hfd.py {args[0]}: {out.get('error')}")
    return out


def prices(kind="video", models=None, duration=None, snapshot=None, table=None):
    opts = ["--type", kind] + (["--models", models] if models else []) + \
           (["--duration", duration] if duration else []) + (["--snapshot", snapshot] if snapshot else [])
    plan = _hfd("prices", "--plan", *opts)
    start, session = time.time(), Session(_access())
    session.open()
    credits, missing = [], []
    for r in plan["requests"]:
        try:
            c = credits_of(session.call(r["tool"], {"params": r["params"]}))
        except Error as e:
            c = None
            missing.append(f"{r['params'].get('model')}: {e}")
        else:
            if c is None:
                missing.append(f"{r['params'].get('model')}: the answer has no price")
        credits.append(c)
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
        (Path(d) / "credits.json").write_text(json.dumps(credits), encoding="utf-8")
        out = _hfd("prices", "--import", Path(d) / "credits.json", "--plan-file", Path(d) / "plan.json",
                   *(["--file", table] if table else []), *(["--snapshot", snapshot] if snapshot else []))
    return {"requests": len(plan["requests"]), "quoted": len(plan["requests"]) - len(missing), "missing": missing,
            "seconds": round(time.time() - start, 1), "file": out.get("file"), "summary": out.get("summary"),
            "changes": out.get("changes"), "reminder": out.get("reminder")}


def status():
    s = _load()
    out = {"signed_in": True, "file": str(STORE), "renews": bool(s.get("refresh_token"))}
    session = Session(_access())
    info = session.open()
    names = set(session.tools())
    out.update({"server": (info.get("serverInfo") or {}).get("name"), "tools": len(names),
                "allowed_present": {n: n in names for n in ALLOWED}})
    return out


def logout():
    try:
        s = _load()
    except Error:
        return {"signed_in": False}
    revoked = []
    for kind in ("refresh_token", "access_token"):
        if s.get(kind) and s.get("revocation_endpoint"):
            form = {"token": s[kind], "token_type_hint": kind, "client_id": s["client"]["client_id"]}
            revoked.append(_http("POST", s["revocation_endpoint"], form, form=True)[0] < 400)
    STORE.unlink()
    return {"signed_in": False, "revoked": all(revoked) if revoked else None}


def main(argv=None):
    ap = argparse.ArgumentParser(prog="connector.py", description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("login", help="sign in once, in the browser")
    s.add_argument("--port", type=int, default=PORT)
    s.add_argument("--no-browser", action="store_true", help="print the address instead of opening it")
    s = sub.add_parser("prices", help="the day's price table, quoted here and imported with hfd.py")
    s.add_argument("--type", choices=["video", "image", "all"], default="video")
    s.add_argument("--models")
    s.add_argument("--duration")
    s.add_argument("--snapshot")
    s.add_argument("--file", help="the table (default: .higgsfield-director/prices.json in the current folder)")
    sub.add_parser("status", help="the stored sign-in and the server's tools")
    sub.add_parser("logout", help="revoke the sign-in and delete it")
    a = ap.parse_args(argv)
    try:
        if a.cmd == "login":
            r = login(port=a.port, open_browser=not a.no_browser)
        elif a.cmd == "prices":
            r = prices(a.type, a.models, a.duration, a.snapshot, a.file)
        elif a.cmd == "status":
            r = status()
        else:
            r = logout()
    except Error as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps(r, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
