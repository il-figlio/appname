"""Vercel HTTP endpoint for the shared App Store catalog search."""

from collections import OrderedDict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
import json
import math
from pathlib import Path
import re
import sys
from threading import Lock
import time
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import appname

_CACHE = OrderedDict()
_LOCK = Lock()
_LAST_REQUEST = 0.0
_CACHE_SECONDS = 300
_MAX_CACHE = 128
_REQUEST_INTERVAL = 3.1


def search(path):
    """Return (HTTP status, result, headers) without depending on HTTP internals."""
    global _LAST_REQUEST
    try:
        if len(path) > 2048:
            raise ValueError("Search URL is too long.")
        params = parse_qs(urlsplit(path).query, keep_blank_values=True, max_num_fields=6)
        if set(params) - {"name", "country", "platform"} or any(len(v) != 1 for v in params.values()):
            raise ValueError("Use one name, country and platform per search.")
        name = params.get("name", [""])[0].strip()
        country = params.get("country", ["us"])[0].lower()
        platform = params.get("platform", ["ios"])[0]
        if not 2 <= len(name) <= 30 or not appname.normalize(name) or any(ord(c) < 32 for c in name):
            raise ValueError("Enter a name with letters or numbers, 2–30 characters long.")
        if not re.fullmatch(r"[a-z]{2}", country):
            raise ValueError("Use a two-letter storefront code, such as us or gb.")
        if platform not in ("ios", "mac"):
            raise ValueError("Choose the iOS or Mac App Store.")
    except ValueError as error:
        return 400, {"status": "error", "error": str(error), "availability": "unconfirmed"}, {}

    key = (name, country, platform)
    now = time.monotonic()
    with _LOCK:
        if key in _CACHE:
            expires, result = _CACHE[key]
            if expires > now:
                _CACHE.move_to_end(key)
                return 200, result, {}
            del _CACHE[key]
        wait = _REQUEST_INTERVAL - (now - _LAST_REQUEST)
        if wait > 0:
            return 429, {"status": "error", "error": "Please wait a few seconds before searching again.",
                         "availability": "unconfirmed"}, {"Retry-After": str(math.ceil(wait))}
        _LAST_REQUEST = now
    try:
        apps, source = appname.fetch(name, country, platform, 12)
        if any(not isinstance(item, dict) for item in apps):
            raise ValueError("Unexpected catalog response")
        result = appname.summarize(name, country, platform, apps, source)
    except (OSError, ValueError, TypeError, KeyError):
        return 502, {"status": "error", "error": "Apple’s catalog could not be reached. Please try again shortly.",
                     "availability": "unconfirmed"}, {}
    result["checked_at"] = datetime.now(timezone.utc).isoformat()
    with _LOCK:
        _CACHE[key] = (time.monotonic() + _CACHE_SECONDS, result)
        while len(_CACHE) > _MAX_CACHE:
            _CACHE.popitem(last=False)
    return 200, result, {}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        status, result, headers = search(self.path)
        body = json.dumps(result, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        # Candidate names are not deliberately written to application logs.
        pass
