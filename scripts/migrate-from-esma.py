"""One-time migration: copy Esma's public events to the Milan Week DB.

- Reads Esma's Supabase with her anon key (embedded below)
- Applies the same public/private classifier we validated earlier
- Maps each event's `source` token to a homepage URL for `source_url`
  (v0 fallback; specific per-event URLs can be added later)
- Writes to Milan Week's Supabase using the service-role key so RLS is bypassed
"""
import io, json, re, sys, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent

# Esma's DB (source) — public read access is fine, her anon key is already in git history
ESMA_URL = "https://uvtgylpfxhcwaecqxhjh.supabase.co"
ESMA_KEY = "sb_publishable_haxbNq_1LPFoLpAwFgZQIA_mpILpWWZ"

# Milan Week DB (destination) — read from .env.local
def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

# Classifier (copied from the Esma repo; kept simple)
PRIVATE_SIGNALS = [
    r"personal\s+(?:&|and)?\s*non[\-\s]?transferable",
    r"no\s+plus\s+one",
    r"strictly\s+invite\s+only",
    r"check\s+press\s+kit",
    r"invite\s+confirmed",
    r"screenshot",
    r"save\s+the\s+date\s+received",
    r"personal\s+invite",
    r"private\s+invite",
    r"rsvp@tcpr\.co",
    r"confirmed\s*\u2713",          # "CONFIRMED ✓" — Esma personal confirmation marker
    r"\u2605\s*confirmed",           # "★ CONFIRMED" in titles
    r"\bcocktail reception\b",       # invite-only cocktails
    r"\blate[\- ]night\s+dance\s+party\b",
]
PRIVATE_SOURCES = {"Invite", "Invite (screenshot)"}

def is_public(e):
    source = (e.get("source") or "").strip()
    if source in PRIVATE_SOURCES: return False
    # status=CONFIRMED in the source xlsx marked events Esma personally received
    # invites to; those are not public listings even if the underlying event is.
    if (e.get("status") or "").upper() == "CONFIRMED": return False
    blob = " ".join([
        (e.get("rsvp") or "").lower(),
        (e.get("notes") or "").lower(),
        (e.get("title") or "").lower(),
    ])
    for pat in PRIVATE_SIGNALS:
        if re.search(pat, blob): return False
    return bool(source)

# Source token → homepage URL. First recognised token wins.
SOURCE_HOMEPAGES = [
    ("designweek.netlify.app", "https://designweek.netlify.app/"),
    ("AD Pro Salone Guide", "https://www.architecturaldigest.com/story/ad-pro-guide-to-salone-del-mobile"),
    ("The Future Perfect", "https://www.thefutureperfect.com/"),
    ("Designboom", "https://www.designboom.com/"),
    ("Galerie", "https://www.galeriemagazine.com/"),
    ("Dezeen", "https://www.dezeen.com/"),
    ("Novit\u00e0", "https://novitacomm.com/"),
    ("Wallpaper", "https://www.wallpaper.com/"),
    ("Domus", "https://www.domusweb.it/"),
    ("STIR", "https://www.stirworld.com/"),
    ("Fluxx", "https://www.fluxxmagazine.com/"),
    ("Fuorisalone.it", "https://www.fuorisalone.it/"),
    ("NSS G-Club", "https://www.nssmag.com/"),
    ("Il Sole 24 Ore", "https://www.ilsole24ore.com/"),
    ("P:S", "https://www.pitchsomething.com/"),
]

def source_url_for(source):
    if not source: return None
    for token, url in SOURCE_HOMEPAGES:
        if token.lower() in source.lower():
            return url
    return None

def links_for(source):
    """One-element links array using the best-known homepage for the source."""
    url = source_url_for(source)
    if not url: return []
    label = (source or "Source").split("/")[0].split("\u00b7")[0].strip() or "Source"
    return [{"label": label, "url": url}]

def fetch(url, key, path, method="GET", body=None, prefer=None):
    full = url.rstrip("/") + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer: headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(full, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode("utf-8") or "null"
    return json.loads(raw)

def main():
    env = read_env()
    dest_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    dest_key = env["SUPABASE_SERVICE_ROLE_KEY"]

    # 1. fetch from Esma
    all_events = fetch(ESMA_URL, ESMA_KEY, "/rest/v1/events?select=*&order=starts_on.asc")
    print(f"Fetched {len(all_events)} events from Esma's DB")

    # 2. filter to public
    public = [e for e in all_events if is_public(e)]
    print(f"Public subset: {len(public)}")

    # 3. clear destination, then insert
    existing = fetch(dest_url, dest_key, "/rest/v1/events?select=id")
    if existing:
        print(f"Destination has {len(existing)} rows; clearing first\u2026")
        fetch(dest_url, dest_key, "/rest/v1/events?id=gt.00000000-0000-0000-0000-000000000000", method="DELETE")

    # 4. strip columns the destination doesn't have (pick) + build links array
    rows = []
    for e in public:
        rows.append({
            "id": e["id"],  # preserve UUIDs so picks in localStorage survive
            "starts_on": e["starts_on"],
            "ends_on": e.get("ends_on"),
            "starts_time": e.get("starts_time"),
            "ends_time": e.get("ends_time"),
            "title": e["title"],
            "host": e.get("host"),
            "venue": e.get("venue"),
            "address": e.get("address"),
            "phase": e.get("phase"),
            "notes": e.get("notes"),
            "rsvp": e.get("rsvp"),
            "source": e.get("source"),
            "links": links_for(e.get("source")),
            "status": e.get("status"),
            "lat": e.get("lat"),
            "lng": e.get("lng"),
            "sort_order": e.get("sort_order", 0),
        })

    # 5. batch insert
    B = 50
    inserted = 0
    for i in range(0, len(rows), B):
        batch = rows[i:i+B]
        fetch(dest_url, dest_key, "/rest/v1/events", method="POST", body=batch, prefer="return=minimal")
        inserted += len(batch)
        print(f"  inserted {inserted}/{len(rows)}")

    # 6. summary
    have_links = sum(1 for r in rows if r["links"])
    have_coords = sum(1 for r in rows if r["lat"] is not None)
    print(f"\nDone. {len(rows)} events written.")
    print(f"  with links:  {have_links}  without: {len(rows) - have_links}")
    print(f"  with coords: {have_coords}  without: {len(rows) - have_coords}")

if __name__ == "__main__":
    main()
