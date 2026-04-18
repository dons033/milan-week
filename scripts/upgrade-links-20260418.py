"""Upgrade three categories of event links to more specific URLs supplied by
the 18 Apr research dump.

1. SaloneSatellite 2026         → specific Salone page
2. Alcova umbrella + sub-events → alcova.xyz/visit/milano-2026
3. Dezeen-sourced events        → dezeen.com/eventsguide/
"""
import io, json, sys, urllib.request
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


def req(env, method, path, body=None, anon=False):
    key = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] if anon else env["SUPABASE_SERVICE_ROLE_KEY"]
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8") or "null")


def upgrade(env, match_fn, new_url, new_label=None, label_tag="upgraded"):
    rows = req(env, "GET", "/rest/v1/events?select=id,title,links,phase,source", anon=True)
    count = 0
    for row in rows:
        if not match_fn(row): continue
        links = list(row.get("links") or [])
        # Replace the first link's URL (and optionally label); keep other links
        if links:
            links[0] = {
                "label": new_label or links[0].get("label") or "Official",
                "url": new_url,
            }
        else:
            links = [{"label": new_label or "Official", "url": new_url}]
        req(env, "PATCH", f"/rest/v1/events?id=eq.{row['id']}", body={"links": links})
        print(f"  [{label_tag}] {row['title'][:55]}  \u2192  {new_url}")
        count += 1
    return count


def main():
    env = read_env()

    # 1. SaloneSatellite specific page
    sat_count = upgrade(
        env,
        lambda r: "salonesatellite" in r["title"].lower(),
        "https://www.salonemilano.it/en/exhibitions/salonesatellite",
        new_label="Official",
        label_tag="satellite",
    )

    # 2. Alcova — any event whose phase is 'Alcova' OR title starts with 'Alcova'
    alcova_count = upgrade(
        env,
        lambda r: (r.get("phase") == "Alcova") or r["title"].lower().startswith("alcova"),
        "https://www.alcova.xyz/visit/milano-2026",
        new_label="Alcova",
        label_tag="alcova",
    )

    # 3. Dezeen — source contains 'Dezeen' AND current first-link is dezeen.com homepage
    def is_dezeen(r):
        src = (r.get("source") or "").lower()
        if "dezeen" not in src: return False
        links = r.get("links") or []
        if not links: return True
        return "dezeen.com" in (links[0].get("url") or "") and "eventsguide" not in (links[0].get("url") or "")
    dezeen_count = upgrade(
        env,
        is_dezeen,
        "https://www.dezeen.com/eventsguide/",
        new_label="Dezeen",
        label_tag="dezeen",
    )

    print(f"\nUpgraded:  SaloneSatellite={sat_count}  Alcova={alcova_count}  Dezeen={dezeen_count}")


if __name__ == "__main__":
    main()
