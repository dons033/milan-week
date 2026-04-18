"""Add the 23 umbrella programs from the 2026 deep-research report.

De-dupes against the existing DB by normalised title (first 5 significant words).
Uses the service-role key to bypass RLS.
"""
import io, json, re, sys, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent

def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

EVENTS = [
    # ---- At Fair (Rho) ----
    {
        "title": "EuroCucina / FTK 2026",
        "host": "Salone del Mobile.Milano",
        "venue": "Fiera Milano Rho \u2014 Pavilions 2/4",
        "address": "Strada Statale 33 del Sempione 28, Rho",
        "starts_on": "2026-04-21", "ends_on": "2026-04-26",
        "starts_time": "09:30", "ends_time": "18:30",
        "phase": "At Fair (Rho)",
        "notes": "Biennial kitchen fair with Future Technology for Kitchen.",
        "rsvp": "Trade all week; public 25\u201326 Apr",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.salonemilano.it/en"}],
    },
    {
        "title": "International Bathroom Exhibition 2026",
        "host": "Salone del Mobile.Milano",
        "venue": "Fiera Milano Rho \u2014 Pavilions 6/10",
        "address": "Strada Statale 33 del Sempione 28, Rho",
        "starts_on": "2026-04-21", "ends_on": "2026-04-26",
        "starts_time": "09:30", "ends_time": "18:30",
        "phase": "At Fair (Rho)",
        "notes": "Biennial bathroom fair.",
        "rsvp": "Trade all week; public 25\u201326 Apr",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.salonemilano.it/en"}],
    },
    {
        "title": "SaloneSatellite 2026",
        "host": "Salone del Mobile.Milano",
        "venue": "Fiera Milano Rho",
        "address": "Strada Statale 33 del Sempione 28, Rho",
        "starts_on": "2026-04-21", "ends_on": "2026-04-26",
        "starts_time": "09:30", "ends_time": "18:30",
        "phase": "At Fair (Rho)",
        "notes": "Emerging-design showcase and award.",
        "rsvp": "Open to the public at large (fair admission applies)",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.salonemilano.it/en"}],
    },
    # ---- District programs ----
    {
        "title": "Brera Design District 2026",
        "host": "Brera Design District",
        "venue": "District-wide, Brera",
        "address": "Brera, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "District program; selected events require free Fuorisalone Passport.",
        "rsvp": "Mixed by sub-event",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.breradesigndistrict.it/en"}],
    },
    {
        "title": "Isola Design Festival 2026",
        "host": "Isola Design Group",
        "venue": "Fabbrica Sassetti + Stecca3 + Fondazione Catella + Zona K",
        "address": "Via Filippo Sassetti 31, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": "10:00", "ends_time": "19:00",
        "phase": "Fuorisalone",
        "notes": "Independent design festival across the Isola district.",
        "rsvp": "Free",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://isola.design/"}],
    },
    {
        "title": "Porta Venezia Design District 2026",
        "host": "Porta Venezia Design District",
        "venue": "District-wide incl. Citt\u00e0 Studi Design Hub / Piscina Romano",
        "address": "Porta Venezia / Citt\u00e0 Studi, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "District program of installations and exhibitions.",
        "rsvp": "Mixed by sub-event",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.portaveneziadesigndistrict.com/"}],
    },
    {
        "title": "5VIE Design Week 2026",
        "host": "5VIE",
        "venue": "Cavallerizze + Palazzo Correnti + SIAM",
        "address": "Via Olona 4, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": "10:30", "ends_time": "20:00",
        "phase": "Fuorisalone",
        "notes": "Historic-centre district; 5VIE Day on 22 Apr with extended hours.",
        "rsvp": "Mixed by sub-event",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://5vie.it/"}],
    },
    {
        "title": "Portanuova Design Week 2026",
        "host": "Portanuova",
        "venue": "Piazza Gae Aulenti + Piazza Alvar Aalto",
        "address": "Piazza Gae Aulenti 12, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "District route with installations, photo corners and talks.",
        "rsvp": "Mostly free; some activations require app booking",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.fuorisalone.it/en/2026"}],
    },
    {
        "title": "Zona Sarpi Design 2026",
        "host": "Milan China Design Center / Zona Sarpi",
        "venue": "Via Paolo Sarpi + Piazzale Baiamonti + Via Bramante",
        "address": "Via Paolo Sarpi, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Chinatown territorial platform with installations and co-design.",
        "rsvp": "Mixed by sub-event",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.fuorisalone.it/en/2026"}],
    },
    # ---- Tortona cluster ----
    {
        "title": "Tortona Rocks 2026",
        "host": "Tortona Rocks",
        "venue": "District-wide, Tortona",
        "address": "Via Tortona, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Project platform in the Tortona area.",
        "rsvp": "Mixed by sub-event",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.fuorisalone.it/en/2026"}],
    },
    {
        "title": "Superstudio Design 2026",
        "host": "Superstudio",
        "venue": "Superstudio Pi\u00f9 + Maxi + Village (Bovisa)",
        "address": "Via Tortona 27 / Via Bergognone / Bovisa, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Three-venue platform of exhibitions, installations and talks.",
        "rsvp": None,
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.superstudiogroup.com/"}],
    },
    # ---- Venue / institution programs ----
    {
        "title": "MoscaPartners Variations 2026 (umbrella)",
        "host": "MoscaPartners",
        "venue": "Palazzo Litta",
        "address": "Corso Magenta 24, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": "10:00", "ends_time": "20:00",
        "phase": "Fuorisalone",
        "notes": "Press preview 20 Apr 10:00\u201319:00; 21\u201325 visitors; 26 closes 18:00.",
        "rsvp": "Professionals/press fast-track line",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.moscapartners.it/"}],
    },
    {
        "title": "DOPIR 2026",
        "host": "KV Design / DOPIR collective",
        "venue": "Casa Bagatti Valsecchi",
        "address": "Via Santo Spirito 7, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Collective exhibition; designer meet-up 24 Apr 18:30\u201322:30.",
        "rsvp": None,
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.fuorisalone.it/en/2026"}],
    },
    {
        "title": "Dropcity 2026 programme",
        "host": "Dropcity",
        "venue": "Dropcity",
        "address": "Via Sammartini 40, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Research platform in converted Stazione Centrale tunnels.",
        "rsvp": None,
        "source": "Official",
        "links": [{"label": "Official", "url": "https://dropcity.org/"}],
    },
    {
        "title": "Triennale Milano \u2014 Milano Design Week 2026",
        "host": "Triennale Milano",
        "venue": "Triennale Milano",
        "address": "Viale Emilio Alemagna 6, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Umbrella public programme incl. Toyo Ito lecture 20 Apr 11:00.",
        "rsvp": "Mixed; several exhibitions free, others ticketed",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://triennale.org/en"}],
    },
    {
        "title": "ADI Design Week 2026",
        "host": "ADI Design Museum",
        "venue": "ADI Design Museum",
        "address": "Piazza Compasso d\u2019Oro 1, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": "10:30", "ends_time": "21:00",
        "phase": "Fuorisalone",
        "notes": "Exhibitions, installations, talks and award events.",
        "rsvp": "Mixed by programme item",
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.adidesignmuseum.org/en/"}],
    },
    {
        "title": "Convey 2026",
        "host": "Simple Flair / Convey",
        "venue": "Convey Building",
        "address": "Via San Senatore 10, Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Multi-brand exhibition, cultural program and networking.",
        "rsvp": None,
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.conveydesign.com/"}],
    },
    {
        "title": "Milano Kids Design Week 2026",
        "host": "The Playful Living / MKDW",
        "venue": "Citywide programme",
        "address": "Milano",
        "starts_on": "2026-04-20", "ends_on": "2026-04-26",
        "starts_time": None, "ends_time": None,
        "phase": "Fuorisalone",
        "notes": "Family/kids design programme; example workshop 26 Apr 16:00 at Chinese Cultural Center.",
        "rsvp": None,
        "source": "Official",
        "links": [{"label": "Official", "url": "https://www.fuorisalone.it/en/2026"}],
    },
]

def req(env, method, path, body=None, key_name="SUPABASE_SERVICE_ROLE_KEY"):
    key = env[key_name]
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8") or "null")

def norm(title):
    s = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
    stop = {"the", "a", "an", "at", "by", "and", "of", "with", "from", "for", "\u00d7", "x"}
    words = [w for w in s.split() if w not in stop]
    return " ".join(words[:5])

def main():
    env = read_env()
    existing = req(env, "GET", "/rest/v1/events?select=title", key_name="NEXT_PUBLIC_SUPABASE_ANON_KEY")
    existing_keys = {norm(e["title"]) for e in existing}
    print(f"Existing: {len(existing)}; normalised keys: {len(existing_keys)}")

    to_insert, skipped = [], []
    for ev in EVENTS:
        k = norm(ev["title"])
        if k in existing_keys:
            skipped.append(ev["title"])
            continue
        existing_keys.add(k)
        to_insert.append({**ev, "status": None})

    if skipped:
        print(f"Skipped {len(skipped)} duplicates:")
        for t in skipped: print(f"  - {t}")
    print(f"Inserting {len(to_insert)} new umbrella programs\u2026")

    if to_insert:
        req(env, "POST", "/rest/v1/events", body=to_insert)
    print("Done. Run geocode-retry.py next to fill any missing lat/lng.")

if __name__ == "__main__":
    main()
