# appname

Check candidate names against Apple's public App Store catalog, from the terminal or the web.

[Search online](https://appname-lookup.vercel.app)

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

Web results include app icons, screenshot previews, and catalog-checked name alternatives for exact matches.

The React frontend uses [shadcn/ui](https://ui.shadcn.com/) with mobile drawers, screenshot carousels, and a searchable storefront picker. `api/search.py` serves lookups on Vercel; the Python CLI stays dependency-free.

```sh
npm ci
npm run dev
npm test
npm run build
```

Use `vercel dev` for the frontend and Python API together, or run the API on port 8000 while using Vite. Deploy with `vercel --prod`.

Interaction and responsive-layout decisions were informed by [Vercel UI SDK](https://github.com/vercel-labs/ui) and [Expo Exact](https://github.com/expo/exact).

Uses Apple's [Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html). No API key or account required.
