"""Small, local wordplay suggestions; catalog checks happen separately."""

import re
import unicodedata

# A small vocabulary gives common app-name words a more useful starting point.
RELATED = {
    "cradle": ["Nestling", "Haven", "Cocoon"],
    "nest": ["Nook", "Roost", "Haven"],
    "notes": ["Jot", "Scribble", "Quill"],
    "note": ["Jot", "Scribble", "Quill"],
    "write": ["Quill", "Scribe", "Draft"],
    "written": ["Quill", "Scribe", "Draft"],
    "focus": ["Clarity", "Still", "Attune"],
    "calm": ["Still", "Serene", "Hush"],
    "spark": ["Kindle", "Glimmer", "Flare"],
    "flow": ["Drift", "Current", "Ripple"],
    "relay": ["Baton", "Signal", "Beacon"],
    "connect": ["Tether", "Thread", "Link"],
    "connections": ["Tether", "Thread", "Link"],
    "headroom": ["Loft", "Breathing Room", "Clearspace"],
    "task": ["Tally", "Stride", "Done"],
    "tasks": ["Tally", "Stride", "Done"],
    "home": ["Nook", "Haven", "Hearth"],
    "tuck": ["Nestle", "Snug", "Fold"],
}


def key(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold()) if c.isalnum())


def suggest_names(name):
    """Return diverse candidate names without making any availability claim."""
    base = re.sub(r"\s+", " ", name.strip())
    compact = "".join(base.split())
    stem = compact[:23]
    related = RELATED.get(key(base), RELATED.get(key(base.split()[-1]), [])) if base else []
    candidates = []
    if related:
        candidates.extend([(related[0], "related word"),
                           (related[1] + " Club", "related word"),
                           (related[2] + "ly", "wordplay")])
    # Keep spelling variants recognizable rather than generating random strings.
    if compact.lower().endswith("le"):
        candidates.append((compact[:-1] + "y", "spelling variation"))
    elif compact.lower().endswith("e"):
        candidates.append((compact[:-1] + "ly", "spelling variation"))
    elif compact.lower().endswith("y"):
        candidates.append((compact[:-1] + "ie", "spelling variation"))
    else:
        candidates.append((stem + "io", "spelling variation"))
    candidates.extend([(stem + "ish", "wordplay"), ("Little " + stem, "playful pairing"),
                       (stem + "well", "wordplay"), (stem + " Grove", "playful pairing"),
                       (stem + " Parade", "playful pairing"), ("Hey " + stem, "playful pairing")])
    found, seen = [], {key(base)}
    for candidate, kind in candidates:
        normalized = key(candidate)
        if 2 <= len(candidate) <= 30 and normalized and normalized not in seen:
            found.append({"name": candidate, "kind": kind})
            seen.add(normalized)
        if len(found) == 6:
            break
    return found
