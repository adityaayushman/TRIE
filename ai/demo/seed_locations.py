"""Seed the live database with a handful of registered locations and
realistic assessments, so /dashboard/locations shows real cards instead of
an honest-but-blank "no sites registered yet" — the same problem, and the
same fix, as ai.demo.seed_live for the unscoped dashboard.

    python -m ai.demo.seed_locations

Every location here is a real, identifiable, well-known Indian road junction
or highway stretch (approximate public coordinates — these are landmark
junctions, not survey-grade GPS). None of them has an actual TRIE camera
installed; each location's `description` says so plainly, and so does this
docstring: what's real is the *risk scoring* — every assessment is posted to
the real POST /risk/assess endpoint and scored by the real fusion pipeline,
tagged to the location via a real location_id — not a fabricated score
written straight to a table. What's illustrative is that a device is sitting
at that junction sending telemetry at all; no such device exists yet.

Speeds are shaped to tell a small story per location (a quiet stretch mostly
cruising, a chaotic junction lurching in speed) within the telemetry-only
pipeline's real, documented ceiling — no camera means speed is the only live
factor, so risk tops out around 30-35% (MODERATE) regardless of location;
this seeder never fabricates a HIGH/CRITICAL score the deployed API cannot
actually produce.

NH48 Gurugram Junction gets a longer profile (35 passes, not 10) than the
rest: enough real exposure and near-misses to clear
`/dashboard/blackspots`' own default thresholds (min_exposure=30,
min_near_misses=5, near_miss_level=moderate) and produce a genuine black-spot
nomination there too — verified live: exposure 40, 12 near-misses, 30% rate,
dominant cause "High Speed", routed to "enforcement". The other four
locations are left below that bar deliberately, so the black-spot page's own
"1 stretch nominated" (not five) stays an honest reflection of which cells
actually cleared the evidence bar, not an artefact of seeding every location
identically.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

API = "https://trie-backend.onrender.com/api/v1"

SEED_NOTE = (
    "Seed demo — a real, well-known Indian junction/stretch. No TRIE camera is "
    "installed here; every assessment below is real engine output on "
    "illustrative telemetry (python -m ai.demo.seed_locations), not a live feed."
)

# Real, well-known Indian road locations (approximate public coordinates —
# landmark-level, not survey-grade), each with a small speed profile that
# tells its own story within the telemetry-only ceiling (~30-35% max).
LOCATIONS: dict[str, dict] = {
    "NH48 Gurugram Junction": {
        "description": (
            "NH48 near Gurugram, Haryana — the same reference point "
            f"ai/blackspot/simulation.py uses. {SEED_NOTE}"
        ),
        "latitude": 28.4595,
        "longitude": 77.0266,
        # 35 passes, not 10 (see module docstring): enough real exposure and
        # near-misses to clear /dashboard/blackspots' own default thresholds.
        "speeds": [
            58, 72, 88, 104, 118, 126, 115, 98, 80, 64,
            45, 52, 60, 68, 75, 82, 58, 64, 71, 49,
            56, 63, 70, 77, 84, 91, 98, 105, 112, 50,
            58, 66, 74, 82, 90,
        ],
    },
    "Silk Board Junction, Bengaluru": {
        "description": f"One of Bengaluru's most notoriously congested junctions (Hosur Road / Outer Ring Road). {SEED_NOTE}",
        "latitude": 12.9172,
        "longitude": 77.6228,
        "speeds": [12, 18, 24, 15, 9, 22, 31, 19, 14, 27],
    },
    "ITO Junction, Delhi": {
        "description": f"A major signalised intersection in central Delhi, on the Ring Road. {SEED_NOTE}",
        "latitude": 28.6280,
        "longitude": 77.2410,
        "speeds": [20, 35, 48, 62, 40, 28, 45, 55, 38, 22],
    },
    "Dahisar Toll Naka, Mumbai": {
        "description": f"The northern entry toll point to Mumbai on the Western Express Highway. {SEED_NOTE}",
        "latitude": 19.2551,
        "longitude": 72.8664,
        "speeds": [30, 45, 60, 75, 90, 100, 92, 78, 63, 48],
    },
    "Anna Salai, Chennai": {
        "description": f"A major arterial road through central Chennai. {SEED_NOTE}",
        "latitude": 13.0604,
        "longitude": 80.2496,
        "speeds": [25, 38, 50, 42, 33, 46, 58, 44, 36, 29],
    },
}


def _post(path: str, body: dict, token: str | None = None, retries: int = 3) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{API}{path}", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    # The free-tier backend occasionally 502s mid-run (seen live: 4 of 5
    # locations seeded cleanly, the 5th's response was lost to one). A
    # transient gateway error is not a reason to abandon a 50-request run —
    # retry a few times before giving up.
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            if exc.code >= 500 and attempt < retries - 1:
                time.sleep(5)
                continue
            raise


def _register() -> str:
    email = f"seed_locations_{int(time.time())}@example.com"
    payload = _post(
        "/auth/register",
        {"email": email, "password": "seeddemo123", "organisation": "Demo Fleet"},
    )
    return payload["access_token"]


def _get(path: str) -> object:
    with urllib.request.urlopen(f"{API}{path}", timeout=30) as resp:
        return json.loads(resp.read())


def main() -> None:
    print("waking backend / registering …")
    for attempt in range(6):
        try:
            token = _register()
            break
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"  backend not ready ({exc}); retrying in 15s …")
            time.sleep(15)
    else:
        raise SystemExit("backend did not wake in time")

    # Idempotent by name: re-running this (e.g. after a partial run) must
    # never create a second "NH48 Gurugram Junction" — GET /locations is
    # public, so this is a free check before any write.
    existing = {loc["name"]: loc["id"] for loc in _get("/locations")}

    total_locations = 0
    total_assessments = 0
    for name, spec in LOCATIONS.items():
        if name in existing:
            print(f"already registered {name!r} -> {existing[name]} (skipping create)")
            location = {"id": existing[name]}
        else:
            location = _post(
                "/locations",
                {
                    "name": name,
                    "description": spec["description"],
                    "latitude": spec["latitude"],
                    "longitude": spec["longitude"],
                },
                token,
            )
            total_locations += 1
            print(f"registered {name!r} -> {location['id']}")

        # Idempotent on assessments too: a re-run after a partial failure
        # (the exact scenario that motivated this) must not re-post a
        # location's already-landed assessments and inflate its count.
        event_count = _get(f"/locations/{location['id']}")["event_count"]
        if event_count >= len(spec["speeds"]):
            print(f"    already has {event_count} assessments (skipping)")
            continue

        for i, speed in enumerate(spec["speeds"][event_count:], start=event_count):
            body = {
                "vehicle_id": f"SEED-{name[:3].upper()}-{i:02d}",
                "speed_kmh": speed,
                "location_id": location["id"],
            }
            score = _post("/risk/assess", body, token)["risk_score"]
            total_assessments += 1
            print(f"    {speed:5.0f} km/h -> {score:5.1f}%")

    print(
        f"\nseeded {total_locations} locations, {total_assessments} real assessments. "
        "Visit /dashboard/locations."
    )


if __name__ == "__main__":
    main()
