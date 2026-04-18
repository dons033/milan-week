"""Delete high-confidence duplicate events and normalise non-standard phases.

12 rows are deleted — all lower-quality 'Exhibitions — Open Hours' / 'Daytime —
Open Hours' / 'Evening — Hard Starts' shadows of editorially-sourced entries.

After that, any remaining event still in a non-standard phase is remapped to
one of the four canonical phases: 'Pre-Fair', 'Fuorisalone', 'Alcova',
'At Fair (Rho)'.
"""
import io, json, sys, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent

# High-confidence duplicate IDs to delete.
DELETE_IDS = [
    "67d586fd-2836-4535-8710-4851f4862b0c",  # 5 Vie QoT (open hrs) — dup
    "e77a553f-406c-4beb-9322-d79262c10303",  # Buccellati (open hrs) — dup
    "3c8b44a2-40e2-485f-8d43-4059f04ea273",  # cc-tapis Fornasetti (open hrs) — dup
    "e9f37542-1a16-4f53-80ce-90d1b837ef06",  # Fondazione Prada (open hrs) — dup
    "963b2761-dc51-47fb-bc4e-43bdad85e7ab",  # GROHE (open hrs) — dup
    "1e9b71ac-8803-4a82-a30b-767ef60483ef",  # Miu Miu (open hrs) — dup
    "ea3766ae-dc10-4cd0-acd3-d349dc778bd0",  # Prada Frames (open hrs) — dup
    "15540dba-cad5-4351-9994-77451d87d550",  # USM x Snohetta (open hrs) — dup
    "f35287b0-6efe-47f2-bc9a-0e37aea615fb",  # When Apricots Blossom (open hrs) — dup of Uzbekistan row
    "9acb45f5-37be-43f1-acd8-08e7d28e14b4",  # The Eames Houses (simpler dup)
    "7918881b-ad9a-4be9-b2e4-924c84a3e88f",  # Moooi (one of two)
    "e81c3290-b3b7-4d91-9778-f40e30e5ca42",  # VOCLA (one of two)
]

# Map non-standard phases → canonical. Applied to whatever survives after the deletes.
CANONICAL_PHASES = {"Pre-Fair", "Fuorisalone", "Alcova", "At Fair (Rho)"}
PHASE_REMAP_DEFAULT = "Fuorisalone"  # if it's not Alcova / At Fair, default to Fuorisalone


def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env


def req(env, method, path, body=None):
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8") or "null")


def main():
    env = read_env()

    # 1. Deletes
    print(f"Deleting {len(DELETE_IDS)} duplicate rows\u2026")
    for rid in DELETE_IDS:
        req(env, "DELETE", f"/rest/v1/events?id=eq.{rid}")
    print("  done")

    # 2. Phase normalisation
    rows = req(env, "GET", "/rest/v1/events?select=id,title,phase")
    remapped = 0
    for r in rows:
        phase = r.get("phase")
        if phase in CANONICAL_PHASES or phase is None:
            continue
        new = PHASE_REMAP_DEFAULT
        req(env, "PATCH", f"/rest/v1/events?id=eq.{r['id']}", body={"phase": new})
        print(f"  phase: {r['title'][:50]}  {phase!r} \u2192 {new!r}")
        remapped += 1
    print(f"Remapped phase on {remapped} rows")

    after = req(env, "GET", "/rest/v1/events?select=id")
    print(f"\nFinal count: {len(after)} events")


if __name__ == "__main__":
    main()
