# appname

Check candidate names against Apple's public App Store catalog, from the terminal or the web.

[Search online](https://appname-roguelite.vercel.app)

## Install

Requires Python 3.10+.

```sh
uv tool install git+https://github.com/il-figlio/appname.git
# or: pipx install git+https://github.com/il-figlio/appname.git
```

## Use

```sh
appname check "Cradle" "Nestling"
appname check "Headroom" --platform all --country gb
appname check --file candidates.txt --json
```

Results show exact and similar matches with developer names and App Store links. The default is the US iOS catalog; choose `--platform mac` or `all`, and a two-letter `--country` code.

**No public match does not mean available.** Reserved, unpublished and region-limited names may be missing. Confirm the name in App Store Connect.

## Develop

```sh
python3 -m pip install -e .
python3 -m unittest discover -s tests -v
```

The buildless web interface is in `public/`; `api/search.py` serves lookups on Vercel. Deploy with `vercel`.

Uses Apple's [Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html). No API key or account required.
