"""Apply the per-event URL research dump to the links column.

Matches by title (case-insensitive, en-dash/em-dash normalised). Labels are
derived from the URL hostname using LABEL_FOR; falls back to 'Source'.
Up to 3 links per event, preserving the ranked order from the research.
"""
import io, json, re, sys, urllib.parse, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "scripts" / "_research-links-20260418.json"


LABEL_FOR = [
    ("wallpaper.com", "Wallpaper"),
    ("dezeen.com", "Dezeen"),
    ("designboom.com", "Designboom"),
    ("galeriemagazine.com", "Galerie"),
    ("wwd.com", "WWD"),
    ("businessofhome.com", "Business of Home"),
    ("domusweb.it", "Domus"),
    ("salonemilano.it", "Official"),
    ("fuorisalone.it", "Fuorisalone"),
    ("alcova.xyz", "Alcova"),
    ("architecturaldigest.com", "AD"),
    ("nssmag.com", "NSS"),
    ("stirworld.com", "STIR"),
    ("novitapr.com", "Novit\u00e0"),
    # brand/official sites — use a short brand label
    ("poltronafrau.com", "Poltrona Frau"),
    ("prada.com", "Prada"),
]

def label_for(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    for needle, label in LABEL_FOR:
        if needle in host: return label
    return "Source"


def norm_title(t: str) -> str:
    """Loose matcher: lowercase, collapse dashes, strip punctuation/whitespace."""
    t = t.lower()
    t = t.replace("\u2014", "-").replace("\u2013", "-")
    t = re.sub(r"[^\w\s-]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env


def req(env, method, path, body=None, anon=False):
    key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] if anon else env["SUPABASE_SERVICE_ROLE_KEY"]
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8") or "null")


def main():
    env = read_env()
    research = json.loads(RESEARCH.read_text(encoding="utf-8"))
    research.pop("_metadata", None)

    # Fetch all events once, build title-index
    events = req(env, "GET", "/rest/v1/events?select=id,title", anon=True)
    by_norm = {}
    for e in events:
        by_norm.setdefault(norm_title(e["title"]), []).append(e)

    matched, missed = 0, []
    for raw_title, payload in research.items():
        key = norm_title(raw_title)
        candidates = by_norm.get(key, [])
        if not candidates:
            missed.append(raw_title)
            continue
        urls = payload.get("urls", [])[:3]
        links = [{"label": label_for(u), "url": u} for u in urls]
        for ev in candidates:
            req(env, "PATCH", f"/rest/v1/events?id=eq.{ev['id']}", body={"links": links})
            labels = ", ".join(l["label"] for l in links)
            print(f"  \u2713 {ev['title'][:55]:55s}  [{labels}]")
            matched += 1

    print(f"\nMatched: {matched}  Missed: {len(missed)}")
    for m in missed: print(f"  - {m}")

if __name__ == "__main__":
    main()
