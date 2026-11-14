#!/usr/bin/env python3
"""Search published App Store titles; never claims name availability."""

import argparse
from datetime import datetime, timezone
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import sys
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://itunes.apple.com/search"
ENTITIES = {"ios": "software", "mac": "macSoftware"}


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold())
                   if c.isalnum())


def classify(query, title):
    q, t = normalize(query), normalize(title)
    if q == t:
        return "exact", 1.0
    # Include an app's brand before a descriptive suffix such as ':' or '—'.
    brand = normalize(re.split(r"[:|–—]|\s-\s", title, maxsplit=1)[0])
    score = SequenceMatcher(None, q, t).ratio()
    if q == brand or q in t or t in q or score >= 0.65:
        return "similar", round(score, 3)
    return "other", round(score, 3)


def fetch(query, country, platform, timeout):
    params = {"term": query, "country": country, "entity": ENTITIES[platform],
              "media": "software", "limit": 200}
    url = API + "?" + urlencode(params)
    request = Request(url, headers={"User-Agent": "appname-cli/0.1"})
    with urlopen(request, timeout=timeout) as response:
        data = json.load(response)
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ValueError("Apple returned an unexpected response")
    return data["results"], url


def summarize(query, country, platform, apps, source):
    matches = []
    seen = set()
    for app in apps:
        title, app_id = app.get("trackName"), app.get("trackId")
        if not isinstance(title, str) or app_id in seen:
            continue
        seen.add(app_id)
        kind, score = classify(query, title)
        if kind == "other":
            continue
        matches.append({"name": title, "match": kind, "similarity": score,
                        "developer": app.get("artistName", ""), "id": app_id,
                        "url": app.get("trackViewUrl", "")})
    matches.sort(key=lambda m: (m["match"] != "exact", -m["similarity"], m["name"]))
    status = ("exact_match" if any(m["match"] == "exact" for m in matches)
              else "similar_matches" if matches else "no_public_match")
    return {"query": query, "country": country, "platform": platform,
            "status": status, "availability": "unconfirmed",
            "matches": matches, "results_scanned": len(apps),
            "search_limit_reached": len(apps) >= 200, "source": source}


def country_code(value):
    if not re.fullmatch(r"[a-zA-Z]{2}", value):
        raise argparse.ArgumentTypeError("country must be a two-letter code, e.g. us")
    return value.lower()


def positive_number(value):
    number = float(value)
    if not 0 < number <= 300:
        raise argparse.ArgumentTypeError("must be greater than 0 and at most 300")
    return number


def parser():
    root = argparse.ArgumentParser(prog="appname", description=__doc__)
    root.add_argument("--version", action="version", version="appname 0.1.0")
    sub = root.add_subparsers(dest="command", required=True)
    check = sub.add_parser("check", help="check one or more candidate names")
    check.add_argument("names", nargs="*", help="quote names containing spaces")
    check.add_argument("--file", type=Path, help="read additional names, one per line; - for stdin")
    check.add_argument("--country", type=country_code, default="us", help="storefront (default: us)")
    check.add_argument("--platform", choices=["ios", "mac", "all"], default="ios")
    check.add_argument("--json", action="store_true", help="emit full JSON to stdout")
    check.add_argument("--limit", type=int, default=5, help="matches shown per search (default: 5; JSON includes all)")
    check.add_argument("--timeout", type=positive_number, default=20)
    return root


def render(result, limit):
    labels = {"exact_match": "EXACT MATCH", "similar_matches": "SIMILAR MATCHES",
              "no_public_match": "NO PUBLIC MATCH", "error": "LOOKUP FAILED"}
    print(f"\n{result['query']} · {result['country'].upper()} · {result['platform']}  {labels[result['status']]}")
    if result["status"] == "error":
        print(f"  {result['error']}")
        return
    for match in result["matches"][:limit]:
        print(f"  [{match['match']}] {match['name']} — {match['developer']}")
        if match["url"]:
            print(f"    {match['url']}")
    remaining = len(result["matches"]) - limit
    if remaining > 0:
        print(f"  + {remaining} more; use --json or --limit")
    if result["search_limit_reached"]:
        print("  Apple returned the 200-result cap; results may be incomplete.")


def main(argv=None):
    cli = parser()
    args = cli.parse_args(argv)
    if args.limit < 1:
        cli.error("--limit must be at least 1")
    names = list(args.names)
    if args.file:
        try:
            content = sys.stdin.read() if str(args.file) == "-" else args.file.read_text()
        except (OSError, UnicodeError) as error:
            cli.error(str(error))
        names.extend(content.splitlines())
    names = list(dict.fromkeys(n.strip() for n in names if n.strip()))
    if not names:
        cli.error("supply at least one name or --file")
    for name in names:
        if not 2 <= len(name) <= 30 or not normalize(name):
            cli.error(f"name must contain letters or numbers and be 2–30 characters: {name!r}")
    platforms = ["ios", "mac"] if args.platform == "all" else [args.platform]
    results = []
    last_start = None
    for name in names:
        for platform in platforms:
            # Apple's published guidance is approximately 20 calls/minute.
            if last_start is not None:
                time.sleep(max(0, 3.1 - (time.monotonic() - last_start)))
            last_start = time.monotonic()
            if not args.json:
                print(f"Searching {name!r} ({platform}, {args.country})…", file=sys.stderr)
            try:
                apps, source = fetch(name, args.country, platform, args.timeout)
                result = summarize(name, args.country, platform, apps, source)
            except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
                result = {"query": name, "country": args.country, "platform": platform,
                          "status": "error", "availability": "unconfirmed", "error": str(error),
                          "matches": []}
            results.append(result)
            if not args.json:
                render(result, args.limit)
    note = ("Public catalog search only. Reserved or unpublished names may not appear. "
            "All name availability remains unconfirmed until accepted by App Store Connect.")
    if args.json:
        print(json.dumps({"schema_version": 1,
                          "checked_at": datetime.now(timezone.utc).isoformat(),
                          "notice": note, "results": results}, ensure_ascii=False, indent=2))
    else:
        print(f"\n{note}")
    return 1 if any(r["status"] == "error" for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
