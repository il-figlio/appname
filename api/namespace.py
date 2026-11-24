"""Keyless public namespace lookup. Missing records never imply claimability."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit, quote
import json
import re
import time
from threading import Lock

PLATFORMS = ("github", "bluesky", "npm", "pypi")
TLDS = ("com", "ai", "io", "sh", "dev", "app", "bot", "xyz", "co", "net", "org", "gg")
LOCK = Lock()
CACHE = {}
BOOTSTRAP = None
BOOTSTRAP_AT = 0

def get(url):
    try:
        with urlopen(Request(url, headers={"User-Agent": "appname-namespace/0.1", "Accept": "application/json"}), timeout=5) as response:
            return response.status, json.loads(response.read(2_000_000))
    except HTTPError as exc:
        return exc.code, {}
    except (OSError, ValueError, TypeError):
        return 0, {}

def rdap_services():
    global BOOTSTRAP, BOOTSTRAP_AT
    with LOCK:
        if BOOTSTRAP is not None and time.monotonic() - BOOTSTRAP_AT < 3600:
            return BOOTSTRAP
        status, body = get("https://data.iana.org/rdap/dns.json")
        if status != 200 or not isinstance(body, dict):
            return {}
        result = {}
        for suffixes, urls in body.get("services", []):
            endpoint = next((u for u in urls if u.startswith("https://")), None)
            if endpoint:
                for suffix in suffixes:
                    result[suffix] = endpoint.rstrip("/")
        BOOTSTRAP, BOOTSTRAP_AT = result, time.monotonic()
        return result

def lookup(mode, name, target, services=None):
    label = name + "." + target if mode == "domain" else name
    source = ""
    status = "unknown"
    detail = "No conclusive response."
    if mode == "domain":
        endpoint = (services or {}).get(target)
        if endpoint:
            source = endpoint + "/domain/" + quote(label, safe="")
            code, body = get(source)
            if code == 200 and isinstance(body, dict) and body.get("objectClassName") == "domain" and str(body.get("ldhName", "")).lower().rstrip(".") == label:
                status, detail = "taken", "Registration record found."
            elif code == 404:
                status, detail = "no_public_match", "No RDAP record; confirm with a registrar."
            elif code == 429:
                status, detail = "rate_limited", "Registry throttled the request."
        else:
            detail = "No supported HTTPS RDAP service in IANA bootstrap."
    else:
        if target == "github":
            valid = re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?", name) and "--" not in name
            source = "https://api.github.com/users/" + quote(name, safe="")
        elif target == "bluesky":
            valid = re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", name)
            label = name + ".bsky.social"
            source = "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=" + quote(label, safe="")
        elif target == "npm":
            valid = re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,62}", name)
            source = "https://registry.npmjs.org/" + quote(name, safe="")
        else:
            valid = re.fullmatch(r"[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?", name)
            source = "https://pypi.org/pypi/" + quote(name, safe="") + "/json"
        if not valid:
            status, detail = "invalid", "Does not match platform naming rules."
        else:
            code, body = get(source)
            positive = isinstance(body, dict) and (body.get("login") if target == "github" else body.get("did") if target == "bluesky" else body.get("name") if target == "npm" else body.get("info", {}).get("name") if isinstance(body.get("info"), dict) else None)
            if code == 200 and positive:
                status, detail = "taken", "Public account or package found."
            elif code == 404 and target != "bluesky":
                status, detail = "no_public_match", "No public record; claimability unconfirmed."
            elif code == 429:
                status, detail = "rate_limited", "Provider throttled the request."
    return dict(target=target, name=label, status=status, detail=detail, source=source,
                checked_at=datetime.now(timezone.utc).isoformat())

def search(path):
    try:
        if len(path) > 2048:
            raise ValueError("Request too long.")
        p = parse_qs(urlsplit(path).query, max_num_fields=3)
        if set(p) != {"mode", "name", "targets"} or any(len(v) != 1 for v in p.values()):
            raise ValueError("Supply mode, name and targets.")
        mode, name = p["mode"][0], p["name"][0].strip().lower()
        if mode not in ("username", "domain"):
            raise ValueError("Invalid search mode.")
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?", name):
            raise ValueError("Use 1–63 ASCII letters, digits or supported separators.")
        if mode == "domain" and not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", name):
            raise ValueError("Enter a single domain label without its extension.")
        targets = tuple(dict.fromkeys(p["targets"][0].split(",")))
        if not targets or any(t not in (TLDS if mode == "domain" else PLATFORMS) for t in targets):
            raise ValueError("Unsupported target.")
    except ValueError as exc:
        return 400, {"error": str(exc)}
    key = (mode, name, targets)
    with LOCK:
        cached = CACHE.get(key)
        if cached and time.monotonic() - cached[0] < 120:
            return 200, cached[1]
    services = rdap_services() if mode == "domain" else None
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(lambda t: lookup(mode, name, t, services), targets))
    result = {"name": name, "mode": mode, "results": rows}
    with LOCK:
        if len(CACHE) >= 128:
            CACHE.pop(next(iter(CACHE)))
        CACHE[key] = (time.monotonic(), result)
    return 200, result

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        status, result = search(self.path)
        body = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
