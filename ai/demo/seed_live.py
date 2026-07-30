"""Seed the live database with realistic assessments from the real pipeline.

    python -m ai.demo.seed_live

A public demo with an empty database shows empty charts — technically honest,
but it reads as broken rather than as "no data yet". This drives a realistic
drive profile through the *real* POST /risk/assess endpoint, so every row is
genuine engine output (real fusion, real environmental factor) on realistic
telemetry — not fabricated numbers written straight to the table. Because every
GET route is anonymous, the seeded history then shows for everyone, signed in or
not.

The primary vehicle is sent last so it is the most-recent one the Risk History
view keys on, and its speed follows an arc (accelerate into risk, ease off) so
the trend line actually tells a story instead of sitting flat.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

API = "https://trie-backend.onrender.com/api/v1"
DEMO_LAT, DEMO_LON = 28.4595, 77.0266

# A drive that climbs into risk and eases back — reads as a real trip.
PRIMARY_SPEEDS = [28, 42, 55, 68, 82, 96, 110, 124, 130, 118, 101, 86, 72, 58, 47, 61, 78, 92]

# A little fleet so "vehicles seen" and the black-spot exposure look alive.
FLEET = {
    "SRG-2W-114": [66, 74, 83, 91, 88, 79],
    "SRG-AUTO-27": [38, 45, 52, 49, 41],
    "SRG-BUS-09": [54, 62, 70, 65, 58, 63],
    "SRG-CAR-88": [88, 102, 116, 121, 104, 90],
}
PRIMARY = "SRG-PATROL-1"


def _post(path: str, body: dict, token: str | None = None) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{API}{path}", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read())


def _register() -> str:
    email = f"seed_{int(time.time())}@example.com"
    payload = _post("/auth/register", {"email": email, "password": "seeddemo123", "organisation": "Demo Fleet"})
    return payload["access_token"]


def _assess(token: str, vehicle_id: str, speed: float, jitter: float) -> float:
    body = {
        "vehicle_id": vehicle_id,
        "speed_kmh": speed,
        "latitude": DEMO_LAT + jitter,
        "longitude": DEMO_LON + jitter,
    }
    return _post("/risk/assess", body, token)["risk_score"]


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

    total = 0
    for i, (vehicle, speeds) in enumerate(FLEET.items()):
        for speed in speeds:
            score = _assess(token, vehicle, speed, jitter=(i - 2) * 0.0004)
            total += 1
            print(f"  {vehicle:14} {speed:5.0f} km/h -> {score:5.1f}%")

    print(f"\nprimary vehicle {PRIMARY} (sent last, most-recent trend):")
    for speed in PRIMARY_SPEEDS:
        score = _assess(token, PRIMARY, speed, jitter=0.0)
        total += 1
        print(f"  {speed:5.0f} km/h -> {score:5.1f}%")

    print(f"\nseeded {total} real assessments across {len(FLEET) + 1} vehicles.")


if __name__ == "__main__":
    main()
