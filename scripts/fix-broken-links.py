"""Fix the three dead domains I guessed wrong:
  novitacomm.com      -> novitapr.com
  fluxxmagazine.com   -> www.fluxx.it
  pitchsomething.com  -> www.patricksisson.com   (P:S = Patrick Sisson)
"""
import io, json, sys, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent

REPLACEMENTS = {
    "https://novitacomm.com/": "https://novitapr.com/",
    "https://www.fluxxmagazine.com/": "https://www.fluxx.it/",
    "https://www.pitchsomething.com/": "https://www.patricksisson.com/",
}

def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

def req(env, method, path, body=None, key_name="SUPABASE_SERVICE_ROLE_KEY"):
    key = env[key_name]
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8") or "null")

def main():
    env = read_env()
    rows = req(env, "GET", "/rest/v1/events?select=id,title,links", key_name="NEXT_PUBLIC_SUPABASE_ANON_KEY")
    print(f"Events: {len(rows)}")
    fixed = 0
    for r in rows:
        links = r.get("links") or []
        changed = False
        new_links = []
        for link in links:
            url = link.get("url")
            if url in REPLACEMENTS:
                new_links.append({**link, "url": REPLACEMENTS[url]})
                changed = True
            else:
                new_links.append(link)
        if changed:
            req(env, "PATCH", f"/rest/v1/events?id=eq.{r['id']}", body={"links": new_links})
            fixed += 1
            print(f"  \u2713 {r['title'][:50]}")
    print(f"\nFixed {fixed} rows.")

if __name__ == "__main__":
    main()
