"""Geocode all events with addresses using Nominatim (OSM) and write lat/lng to Supabase.

Rate-limited to 1 req/sec per Nominatim usage policy.
Run: python scripts/geocode.py
"""
import io, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env

def supabase_req(env, method, path, body=None, extra_headers=None):
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra_headers: headers.update(extra_headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8") or "null"
    return json.loads(raw)

def geocode(q):
    """Return (lat, lng) or (None, None)."""
    # bias to Milan by appending if not present
    if "milan" not in q.lower() and "milano" not in q.lower():
        q = q + ", Milano, Italy"
    url = (
        "https://nominatim.openstreetmap.org/search?"
        + urllib.parse.urlencode({"q": q, "format": "json", "limit": 1, "countrycodes": "it"})
    )
    req = urllib.request.Request(url, headers={"User-Agent": "CalendarApp-Esma/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data: return None, None
    return float(data[0]["lat"]), float(data[0]["lon"])

def clean_address(a):
    """Strip notes / parentheticals that confuse the geocoder."""
    if not a: return None
    a = re.sub(r"\(.*?\)", "", a).strip(" ,;")
    a = re.sub(r"\s+", " ", a)
    if not a or a.upper() in ("TBC", "—"): return None
    return a

def main():
    env = read_env()
    # fetch events without coords that have an address
    events = supabase_req(env, "GET", "/rest/v1/events?select=id,address,venue,title,lat&lat=is.null")
    print(f"Events missing coords: {len(events)}")
    done, failed, skipped = 0, [], 0
    for ev in events:
        addr = clean_address(ev.get("address")) or clean_address(ev.get("venue"))
        if not addr:
            skipped += 1
            continue
        try:
            lat, lng = geocode(addr)
        except Exception as e:
            print(f"  ! {ev['title'][:40]}: geocode error {e}")
            failed.append(ev["id"])
            time.sleep(1.1)
            continue
        if lat is None:
            print(f"  - {ev['title'][:50]}: no hit for {addr!r}")
            failed.append(ev["id"])
        else:
            supabase_req(
                env, "PATCH", f"/rest/v1/events?id=eq.{ev['id']}",
                body={"lat": lat, "lng": lng},
            )
            done += 1
            print(f"  \u2713 {ev['title'][:50]}  ->  {lat:.4f}, {lng:.4f}")
        time.sleep(1.1)  # Nominatim rate limit
    print(f"\nDone. Geocoded: {done}  Failed: {len(failed)}  Skipped (no addr): {skipped}")

if __name__ == "__main__":
    main()
