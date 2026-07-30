"""Build an illustrative black-spot map dataset from the REAL engine.

The deployed API only ever receives demo telemetry at a single location, so
its black-spot endpoint returns one point — nothing to show spatially. This
script does for black spots what `build_traffic_demo.py` does for perception:
it runs the *real* `RiskFusionEngine` + `BlackSpotEngine` (no reimplemented
logic) over a seeded, multi-location scenario and serialises the nominations,
so the map has genuine engine output to plot. It is labelled "illustrative
sample" in the UI, exactly like the recorded-footage demo — the engine is
real, the near-miss telemetry it runs on is authored.

    python -m ai.demo.build_blackspot_demo

Output: backend/static/demo/blackspots/sample.json, served by the FastAPI
/demo static mount and fetched by the Black Spots page's map.
"""
from __future__ import annotations

import json
import math
import random
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

from ai.blackspot.engine import BlackSpotEngine, RiskObservation
from ai.blackspot.geo import EARTH_RADIUS_M, MetricGrid
from ai.blackspot.simulation import (
    DANGEROUS_PROFILE,
    LocationProfile,
    sample_assessment,
    _SIM_START,
)
from ai.common.types import RiskLevel

_GRID = MetricGrid()


def _snap_to_cell_center(latitude: float, longitude: float) -> tuple[float, float]:
    """Move a point to the centre of its 500m grid cell.

    Cells are an areal bin (see geo.MetricGrid): a stretch whose coordinates
    happen to sit near a cell boundary fragments into two dots under GPS jitter.
    Snapping each seeded stretch to its cell centre puts every jittered fix a
    full 250m from any boundary, so one stretch stays one nomination — a
    presentation fix for the seeded demo, not a change to the engine.
    """
    ec, nc = _GRID.cell_of(latitude, longitude)
    northing_center = (nc + 0.5) * _GRID.cell_size_m
    lat_center = math.degrees(northing_center / EARTH_RADIUS_M)
    easting_center = (ec + 0.5) * _GRID.cell_size_m
    lon_center = math.degrees(easting_center / (EARTH_RADIUS_M * math.cos(math.radians(lat_center))))
    return lat_center, lon_center

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "backend" / "static" / "demo" / "blackspots"

HORIZON_DAYS = 60
SEED = 7

# A corridor of stretches across Delhi NCR, each a variation of the repo's
# worked "structurally dangerous" profile but leaning on a different causal
# factor, so the map shows the full intervention taxonomy (engineering /
# enforcement / education) rather than one colour. Coordinates are spaced well
# past the 500m cell size so each lands in its own cell. Every profile here is
# deliberately dangerous enough to nominate; a real deployment would see mostly
# safe road, but a map of empty space demonstrates nothing.
def _profile(name, lat, lon, **overrides) -> LocationProfile:
    return replace(DANGEROUS_PROFILE, name=name, latitude=lat, longitude=lon, **overrides)


PROFILES = [
    # Poor surface, unmarked — an Engineering (public works) nomination.
    _profile(
        "Unmarked junction, damaged surface",
        28.4595, 77.0266,
        surface_quality_range=(0.10, 0.30),
        lane_detected_probability=0.03,
        speed_kmh_mean=70.0,
    ),
    # Heavy, close vulnerable-road-user traffic — Engineering (missing crossing).
    _profile(
        "School crossing, dense foot traffic",
        28.4720, 77.0410,
        surface_quality_range=(0.45, 0.65),
        vru_probability=0.85,
        vru_count_range=(2, 5),
        vru_close_probability=0.55,
        speed_kmh_mean=55.0,
    ),
    # Sustained over-speeding — Enforcement (policing). HIGH risk is multi-factor
    # by design (speed's weight is 0.22, so speed alone tops out ~22/100), so
    # this crosses the threshold via a combination while keeping speed the single
    # largest term: near-limit speed, unmarked lanes (which redistributes weight
    # onto speed), moderate surface/VRU kept below it, and low distraction.
    _profile(
        "Expressway over-speeding stretch",
        28.4880, 77.0620,
        surface_quality_range=(0.45, 0.62),
        lane_detected_probability=0.10,
        speed_kmh_mean=118.0,
        speed_kmh_std=7.0,
        vru_probability=0.40,
        vru_count_range=(1, 3),
        vru_close_probability=0.18,
        attention_score_range=(0.82, 1.0),
        congestion_range=(0.30, 0.55),
    ),
    # Chronically distracted driving at a signal — Education (behaviour).
    _profile(
        "Signal with habitual distraction",
        28.5020, 77.0480,
        surface_quality_range=(0.65, 0.85),
        lane_detected_probability=0.7,
        speed_kmh_mean=58.0,
        vru_probability=0.30,
        attention_score_range=(0.25, 0.55),
    ),
    # Repeatedly congested market road — Engineering (capacity/design failure).
    _profile(
        "Congested market road",
        28.4660, 77.0730,
        surface_quality_range=(0.40, 0.60),
        speed_kmh_mean=48.0,
        vru_probability=0.60,
        vru_count_range=(1, 4),
        congestion_range=(0.70, 0.95),
    ),
    # A milder stretch — fewer near-misses, so it lands lower-ranked / possibly
    # below the iRAD analogue, showing the "predicted early" contrast.
    _profile(
        "Edge-of-threshold slip road",
        28.5140, 77.0350,
        surface_quality_range=(0.55, 0.75),
        lane_detected_probability=0.5,
        speed_kmh_mean=64.0,
        vru_probability=0.35,
        daily_passes=28.0,
    ),
]


def build_observations(rng: random.Random) -> list[RiskObservation]:
    observations: list[RiskObservation] = []
    for profile in PROFILES:
        base_lat, base_lon = _snap_to_cell_center(profile.latitude, profile.longitude)
        for day in range(HORIZON_DAYS):
            timestamp = _SIM_START + timedelta(days=day)
            passes = max(1, int(round(rng.gauss(profile.daily_passes, profile.daily_passes * 0.15))))
            for index in range(passes):
                risk = sample_assessment(profile, rng)
                observations.append(
                    RiskObservation(
                        vehicle_id=f"SAMPLE-{profile.name}-{day}-{index}",
                        # Small jitter so the centroid and radius are
                        # non-degenerate, as real GPS fixes would be — kept tight
                        # (~17m) so a stretch stays within its own 500m cell
                        # instead of fragmenting across a boundary into two dots.
                        latitude=base_lat + rng.uniform(-0.00015, 0.00015),
                        longitude=base_lon + rng.uniform(-0.00015, 0.00015),
                        timestamp=timestamp + timedelta(seconds=index * 30),
                        risk_score=risk.risk_score,
                        risk_level=risk.risk_level,
                        contributing_factors=risk.contributing_factors,
                    )
                )
    return observations


def main() -> None:
    rng = random.Random(SEED)
    observations = build_observations(rng)

    engine = BlackSpotEngine(
        near_miss_level=RiskLevel.HIGH,
        min_exposure=30,
        min_near_misses=5,
    )
    spots = engine.discover(observations)

    payload = [
        {
            "latitude": round(s.latitude, 6),
            "longitude": round(s.longitude, 6),
            "near_miss_count": s.near_miss_count,
            "exposure": s.exposure,
            "incident_rate": s.incident_rate,
            "confidence": s.confidence,
            "dominant_cause": s.dominant_cause,
            "cause_breakdown": s.cause_breakdown,
            "intervention": s.intervention.value,
            "radius_m": s.radius_m,
            "qualifies_under_irad": s.qualifies_under_irad,
            "first_seen": s.first_seen.isoformat(),
            "last_seen": s.last_seen.isoformat(),
        }
        for s in spots
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "sample.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"{len(observations)} observations -> {len(payload)} black spots")
    for s in payload:
        print(
            f"  {s['latitude']:.4f},{s['longitude']:.4f}  "
            f"nm={s['near_miss_count']:<4} exp={s['exposure']:<5} "
            f"conf={s['confidence']:.3f} {s['intervention']:<11} "
            f"iRAD={'Y' if s['qualifies_under_irad'] else 'n'}  {s['dominant_cause']}"
        )
    print(f"\nwrote {OUTPUT_DIR / 'sample.json'}")


if __name__ == "__main__":
    main()
