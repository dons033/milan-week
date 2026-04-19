"""Merge per-event deep-link URLs into existing links arrays.

Rules:
  - Same-host URL already in the array? Replace it with the more specific one
    (assumes the incoming research URL is more specific than what we have)
  - Different host? Append, up to 3 total links per event
  - Preserve user-supplied ordering (incoming URLs prepended; existing
    same-host links removed)

Match events by normalised title.
"""
import io, json, re, sys, urllib.parse, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "scripts" / (sys.argv[1] if len(sys.argv) > 1 else "_research-fuorisalone-deeplinks.json")

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
    ("poltronafrau.com", "Poltrona Frau"),
    ("prada.com", "Prada"),
    ("kohler.com", "Kohler"),
    ("buccellati.com", "Buccellati"),
    ("duravit.it", "Duravit"),
    ("duravit.com", "Duravit"),
    ("brokis.com", "Brokis"),
    ("cc-tapis.com", "cc-tapis"),
    ("apartamentomagazine.com", "Apartamento"),
    ("mullervanseveren.be", "Muller Van Severen"),
    ("10corsocomo.com", "10 Corso Como"),
    ("vanityinmilan.com", "Vanity in Milan"),
    ("pinupmagazine.org", "Pin-Up"),
    ("bathroom-review.co.uk", "Bathroom Review"),
    ("d5mag.com", "D5 Mag"),
    ("aesop.com", "Aesop"),
    ("livingetc.com", "Livingetc"),
    ("monocle.com", "Monocle"),
    ("archdaily.com", "ArchDaily"),
    ("interiordaily.com", "Interior Daily"),
    ("ilgiornaledellarte.com", "Il Giornale dell'Arte"),
    ("artribune.com", "Artribune"),
    ("designerspace.it", "Designerspace"),
    ("triennale.org", "Triennale"),
    ("nilufar.com", "Nilufar"),
    ("pirellihangarbicocca.org", "Pirelli HangarBicocca"),
    ("gallerialuisadellepiane.it", "Galleria Delle Piane"),
    ("visualatelier8.com", "Visual Atelier 8"),
    ("hypebeast.com", "Hypebeast"),
    ("artribune.com", "Artribune"),
    ("ansa.it", "Ansa"),
    ("e-flux.com", "e-flux"),
    ("adidesignmuseum.org", "ADI Museum"),
    ("internimagazine.it", "Interni"),
    ("calicowallpaper.com", "Calico"),
    ("nuvomagazine.com", "Nuvo"),
    ("5vie.it", "5VIE"),
    ("artribune.com", "Artribune"),
    ("dimoregallery.com", "Dimoregallery"),
    ("glasitalia.com", "Glas Italia"),
    ("interiordaily.com", "Interior Daily"),
    ("janusetcie.com", "Janus et Cie"),
    ("poliform.it", "Poliform"),
    ("ilsole24ore.com", "Il Sole 24 Ore"),
    ("internimagazine.com", "Interni"),
    ("breradesignweek.it", "Brera Design Week"),
    ("miele.com", "Miele"),
    ("molteni.it", "Molteni"),
    ("yesmilano.it", "YesMilano"),
    ("samsung.com", "Samsung"),
    ("rossanaorlandi.com", "Rossana Orlandi"),
    ("ropac.net", "Thaddaeus Ropac"),
    ("milanoartemagazine.it", "Milano Arte"),
    ("artemest.com", "Artemest"),
]

def label_for(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    if host.startswith("www."): host = host[4:]
    # exact host or proper-suffix match (so calicowallpaper.com !~ wallpaper.com)
    for needle, label in LABEL_FOR:
        if host == needle or host.endswith("." + needle):
            return label
    return "Source"

def host_of(url: str) -> str:
    h = urllib.parse.urlparse(url).netloc.lower()
    return h[4:] if h.startswith("www.") else h

def norm_title(t: str) -> str:
    t = t.lower().replace("\u2014", "-").replace("\u2013", "-")
    t = re.sub(r"[^\w\s-]", "", t)
    return re.sub(r"\s+", " ", t).strip()

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

def merge_links(existing, incoming_urls):
    """Replace same-host existing entries with incoming URLs, then append remaining incoming. Cap at 3."""
    incoming_hosts = {host_of(u) for u in incoming_urls}
    new = [{"label": label_for(u), "url": u} for u in incoming_urls]
    for link in existing:
        if host_of(link.get("url") or "") not in incoming_hosts:
            new.append(link)
    return new[:3]

def main():
    env = read_env()
    research = json.loads(RESEARCH.read_text(encoding="utf-8"))
    events = req(env, "GET", "/rest/v1/events?select=id,title,links", anon=True)
    by_norm = {}
    for e in events:
        by_norm.setdefault(norm_title(e["title"]), []).append(e)

    matched, missed = 0, []
    for raw_title, urls in research.items():
        candidates = by_norm.get(norm_title(raw_title), [])
        if not candidates:
            missed.append(raw_title); continue
        for ev in candidates:
            existing = ev.get("links") or []
            merged = merge_links(existing, urls)
            req(env, "PATCH", f"/rest/v1/events?id=eq.{ev['id']}", body={"links": merged})
            labels = ", ".join(l["label"] for l in merged)
            print(f"  \u2713 {ev['title'][:55]:55s}  [{labels}]")
            matched += 1

    print(f"\nMerged: {matched}  Missed: {len(missed)}")
    for m in missed: print(f"  - {m}")

if __name__ == "__main__":
    main()
