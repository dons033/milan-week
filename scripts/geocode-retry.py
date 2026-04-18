"""Retry geocoding for events missing lat/lng by trying multiple query candidates.

For each event with no coords, generates candidates in order of specificity:
  1. Street + number regex (e.g. 'Via Palestro 8')
  2. After-the-dot fragment of 'Venue · Address' strings
  3. Venue name alone + Milano
  4. Known-landmark fallback (fair, big venues)

Stops at the first Nominatim hit. Rate-limited to 1 req/sec.
Run: python scripts/geocode-retry.py
"""
import io, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

# Manual overrides for well-known venues Nominatim struggles with.
LANDMARKS = {
    "fiera milano rho": (45.5177, 9.0807),
    "baggio military hospital": (45.4621, 9.0857),
    "ospedale militare di baggio": (45.4621, 9.0857),
    "teatro litta": (45.4665, 9.1798),
    "palazzo litta": (45.4665, 9.1798),
    "torre velasca": (45.4608, 9.1912),
    "superstudio pi\u00f9": (45.4519, 9.1624),
    "base milano": (45.4490, 9.1620),
    "dropcity": (45.4858, 9.2005),
    "triennale milano": (45.4720, 9.1722),
    "ikonica art gallery": (45.4712, 9.1550),
    "palazzo citterio": (45.4725, 9.1889),
    "mohd turati": (45.4811, 9.1960),
    "designpuntozero": (45.6111, 8.8508),
    "palazzo acerbi": (45.4593, 9.1898),
    "fiera di rho": (45.5177, 9.0807),
    "rho": (45.5177, 9.0807),
}

STREET_RE = re.compile(
    r"(?:Via|Viale|Corso|Piazza|Largo|Strada|Piazzale)\s+[A-Z][\w'\u00c0-\u017f\.\s\-]+?\s+\d+[A-Za-z]?",
)

def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env

def supabase_req(env, method, path, body=None):
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8") or "null"
    return json.loads(raw)

def nominatim(q):
    if "milan" not in q.lower() and "milano" not in q.lower():
        q_full = q + ", Milano, Italy"
    else:
        q_full = q
    url = (
        "https://nominatim.openstreetmap.org/search?"
        + urllib.parse.urlencode({"q": q_full, "format": "json", "limit": 1, "countrycodes": "it"})
    )
    req = urllib.request.Request(url, headers={"User-Agent": "CalendarApp-Esma/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data: return None, None
    return float(data[0]["lat"]), float(data[0]["lon"])

SKIP_WORDS = ("tbc", "by appointment", "confirmed upon rsvp", "details provided", "address on request", "on request")

def clean(s):
    if not s: return None
    t = str(s).strip()
    if not t or t.lower() in ("\u2014", "-"): return None
    if any(w in t.lower() for w in SKIP_WORDS): return None
    return t

def strip_parens(s):
    return re.sub(r"\([^)]*\)", "", s).strip(" ,;\u00b7")

def candidates(venue, address):
    """Generate geocoding candidates from venue + address, in order of preference."""
    venue_c = clean(venue)
    addr_c = clean(address)
    out = []

    # Try landmark dictionary against venue + address text
    for text in (venue_c or "", addr_c or ""):
        low = text.lower()
        for key in LANDMARKS:
            if key in low:
                return [("__landmark__", LANDMARKS[key])]

    if addr_c:
        addr_clean = strip_parens(addr_c)
        # Before slash (first alt)
        for part in re.split(r"\s*/\s*", addr_clean):
            part = part.strip()
            if not part: continue
            # Extract street + number
            m = STREET_RE.search(part)
            if m:
                out.append(("street", m.group(0)))
            # After-the-dot fragment
            if "\u00b7" in part:
                for sub in part.split("\u00b7"):
                    sub = sub.strip()
                    if sub and STREET_RE.search(sub):
                        out.append(("after-dot", STREET_RE.search(sub).group(0)))
            out.append(("addr-part", part))

    if venue_c:
        venue_clean = strip_parens(venue_c)
        # split on slash/plus
        for part in re.split(r"\s*[/+]\s*", venue_clean):
            part = part.strip(" \u00b7,;")
            if not part: continue
            out.append(("venue", part))

    # Dedup, preserve order
    seen = set()
    result = []
    for kind, q in out:
        if q in seen: continue
        seen.add(q)
        result.append((kind, q))
    return result

def main():
    env = read_env()
    events = supabase_req(env, "GET", "/rest/v1/events?select=id,title,venue,address&lat=is.null")
    print(f"Events missing coords: {len(events)}\n")
    done = 0
    still_failed = []
    for ev in events:
        cands = candidates(ev.get("venue"), ev.get("address"))
        if not cands:
            still_failed.append((ev["title"], "no usable query"))
            continue
        hit = None
        # Landmark shortcut
        if cands and cands[0][0] == "__landmark__":
            hit = ("landmark", cands[0][1])
        else:
            for kind, q in cands:
                try:
                    lat, lng = nominatim(q)
                except Exception as e:
                    time.sleep(1.1)
                    continue
                if lat is not None:
                    hit = (f"{kind}:{q}", (lat, lng))
                    break
                time.sleep(1.1)
        if not hit:
            still_failed.append((ev["title"], str(cands[:2])))
            continue
        kind, (lat, lng) = hit
        supabase_req(env, "PATCH", f"/rest/v1/events?id=eq.{ev['id']}", body={"lat": lat, "lng": lng})
        print(f"  \u2713 {ev['title'][:50]:50s}  [{kind[:30]}]  ->  {lat:.4f}, {lng:.4f}")
        done += 1

    print(f"\nGeocoded: {done}    Still failed: {len(still_failed)}")
    for t, why in still_failed:
        print(f"  - {t[:55]}  ({why[:60]})")

if __name__ == "__main__":
    main()
