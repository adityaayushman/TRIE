"""Simulated evaluation: how much earlier does near-miss discovery flag a
dangerous stretch than iRAD's crash-count threshold would?

iRAD/e-DAR flags a black spot only after five fatal/grievous crashes, or ten
deaths, in three years. That threshold requires deaths to accumulate before a
location is even a candidate for intervention. This module quantifies the
alternative this repo proposes: nominating from near-misses, which are far
more frequent than crashes, using the *real* RiskFusionEngine and
BlackSpotEngine from this codebase — not reimplemented logic.

This is a methodology validation, not a real-world numeric claim. It cannot
be, honestly, without labelled Indian crash telemetry (which does not exist
in this repo and is not what ai/blackspot/ needs to run). Two things are
simulated rather than measured:

1. Location "danger" is authored, not observed: a dangerous profile combines
   poor road surface, unmarked lanes, and regular vulnerable-road-user
   exposure -- precisely the causal factors ai/trie/risk_fusion.py already
   weights, so the simulation is checking that the pipeline responds to the
   conditions it claims to model, not asserting a new fact about them.
2. The near-miss -> crash conversion rate is a swept parameter
   (`crash_probability_given_near_miss`), not a measured constant, because no
   public source ties a HIGH-risk telemetry event to real crash probability.
   The result is reported as a sensitivity curve across a plausible range, so
   the conclusion is "the lead time holds across an order of magnitude of
   assumptions," not "the lead time is exactly N days."
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from ai.blackspot.engine import BlackSpotEngine, RiskObservation
from ai.blackspot.geo import haversine_m
from ai.common.types import (
    DetectedObject,
    DriverState,
    PerceptionResult,
    RiskLevel,
    RoadState,
    TrafficState,
    VehicleDynamics,
)
from ai.trie.risk_fusion import RiskFusionEngine

# iRAD's own rule: a National Highway stretch qualifies as a black spot after
# five or more fatal/grievous crashes in three years.
IRAD_CRASH_THRESHOLD = 5
IRAD_HORIZON_DAYS = 365 * 3

_SIM_START = datetime(2026, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True)
class LocationProfile:
    """The distribution telemetry is sampled from at one point on the map.

    Values are ranges, not constants: a real stretch of road does not produce
    identical readings on every pass, and a simulation that pretended it did
    would prove nothing about a detector's ability to work under noise.
    """

    name: str
    latitude: float
    longitude: float
    daily_passes: float
    surface_quality_range: tuple[float, float]
    lane_detected_probability: float
    speed_kmh_mean: float
    speed_kmh_std: float
    vru_probability: float
    """Probability any given pass encounters a vulnerable road user at all."""
    vru_count_range: tuple[int, int]
    vru_close_probability: float
    """Given a VRU is present, probability it is close enough to read as
    imminent rather than merely visible at ordinary dashcam distance."""
    attention_score_range: tuple[float, float]
    congestion_range: tuple[float, float]


# Mirrors this repo's own worked example: a driver who is not doing anything
# wrong, on a road with no lane markings and a damaged surface, moving through
# regular pedestrian/two-wheeler traffic. The danger is structural, not
# behavioural -- which is exactly the claim ai/trie/risk_fusion.py makes and
# this simulation checks the pipeline actually acts on.
DANGEROUS_PROFILE = LocationProfile(
    name="unmarked junction, damaged surface, VRU-heavy",
    latitude=28.4595,
    longitude=77.0266,
    # A single junction/stretch, not a full highway corridor: modest daily
    # volume is what makes the accumulation-of-evidence story visible at all
    # -- at highway volume the exposure threshold clears in under a day,
    # which is mechanically correct but too instant to be an illustrative
    # comparison against a threshold that takes years.
    daily_passes=45.0,
    surface_quality_range=(0.15, 0.40),
    lane_detected_probability=0.05,
    speed_kmh_mean=75.0,
    speed_kmh_std=15.0,
    vru_probability=0.55,
    vru_count_range=(1, 4),
    vru_close_probability=0.25,
    attention_score_range=(0.65, 1.0),
    congestion_range=(0.10, 0.40),
)

# A comparably busy, unremarkable stretch: good surface, marked lanes, rare
# VRU presence. Included so the simulation also demonstrates specificity --
# a location that is not actually dangerous must not get nominated just for
# being well-travelled.
SAFE_PROFILE = LocationProfile(
    name="marked highway, good surface",
    latitude=28.5100,
    longitude=77.0900,
    daily_passes=45.0,
    surface_quality_range=(0.85, 1.0),
    lane_detected_probability=0.95,
    speed_kmh_mean=58.0,
    speed_kmh_std=9.0,
    vru_probability=0.08,
    vru_count_range=(0, 1),
    vru_close_probability=0.05,
    attention_score_range=(0.80, 1.0),
    congestion_range=(0.05, 0.20),
)


def _sample_vru_boxes(count: int, rng: random.Random, close_probability: float = 0.3) -> list[DetectedObject]:
    """Pedestrian/two-wheeler boxes at varied range.

    Most are at ordinary dashcam distance; a minority are close enough to
    read as imminent (box area near or past
    ai.trie.risk_fusion._VRU_IMMINENT_BOX_AREA) -- an unmarked crossing with
    real foot/two-wheeler traffic produces exactly this mix, not uniformly
    distant sightings.
    """
    boxes = []
    for _ in range(count):
        half = rng.uniform(0.20, 0.30) if rng.random() < close_probability else rng.uniform(0.03, 0.10)
        cx, cy = rng.uniform(0.2, 0.8), rng.uniform(0.4, 0.9)
        boxes.append(
            DetectedObject("person", 0.8, (cx - half, cy - half, cx + half, cy + half))
        )
    return boxes


def sample_assessment(profile: LocationProfile, rng: random.Random) -> RiskObservation:
    """Draw one simulated vehicle pass through `profile`, scored by the real
    RiskFusionEngine."""
    vru_count = 0
    if rng.random() < profile.vru_probability:
        vru_count = rng.randint(*profile.vru_count_range)

    perception = PerceptionResult(
        vehicles=[],
        two_wheelers=_sample_vru_boxes(vru_count // 2, rng, profile.vru_close_probability),
        pedestrians=_sample_vru_boxes(
            vru_count - vru_count // 2, rng, profile.vru_close_probability
        ),
        lane_offset_m=rng.uniform(-0.3, 0.3),
        lane_detected=rng.random() < profile.lane_detected_probability,
    )
    road = RoadState(surface_quality_score=rng.uniform(*profile.surface_quality_range))
    traffic = TrafficState(congestion_level=rng.uniform(*profile.congestion_range))
    vehicle = VehicleDynamics(
        speed_kmh=max(0.0, rng.gauss(profile.speed_kmh_mean, profile.speed_kmh_std))
    )
    driver = DriverState(
        attention_score=rng.uniform(*profile.attention_score_range), face_detected=True
    )

    risk = RiskFusionEngine().fuse(
        driver=driver, road=road, traffic=traffic, vehicle=vehicle, perception=perception
    )
    return risk


@dataclass(frozen=True)
class DailyTally:
    day: int
    cumulative_near_misses: dict[str, int]
    """Per-profile-name cumulative HIGH+ near-miss count, for plotting."""
    cumulative_crashes: int
    """Simulated crashes at the dangerous location under one crash-probability
    draw. Recomputed by `sweep_crash_probability` per swept value; this field
    reflects whichever probability the caller last ran with."""


@dataclass(frozen=True)
class SimulationResult:
    seed: int
    blackspot_lead_time_days: int | None
    """First day BlackSpotEngine nominates the dangerous location. None if it
    never does within the horizon."""
    false_positive: bool
    """Whether the safe location was ever nominated -- it should not be."""
    daily_tallies: list[DailyTally]
    observations_generated: int


def _cell_matches(spot_lat: float, spot_lon: float, profile: LocationProfile) -> bool:
    return haversine_m(spot_lat, spot_lon, profile.latitude, profile.longitude) < 600


def run_simulation(
    seed: int = 0,
    horizon_days: int = 120,
    near_miss_level: RiskLevel = RiskLevel.HIGH,
    min_exposure: int = 30,
    min_near_misses: int = 5,
    checkpoint_days: int = 7,
    dangerous_profile: LocationProfile = DANGEROUS_PROFILE,
    safe_profile: LocationProfile = SAFE_PROFILE,
) -> SimulationResult:
    """Run the dangerous + safe location streams through the real engines for
    `horizon_days`, checkpointing discovery every `checkpoint_days` (coarse
    pass) then refining to the exact day within the week discovery first
    succeeds (fine pass) -- full daily re-aggregation over the whole history
    would be O(days^2) and unnecessary for a day-level answer.
    """
    rng = random.Random(seed)
    engine = BlackSpotEngine(
        near_miss_level=near_miss_level, min_exposure=min_exposure, min_near_misses=min_near_misses
    )

    observations: list[RiskObservation] = []
    daily_near_miss_counts: dict[str, list[int]] = {
        dangerous_profile.name: [],
        safe_profile.name: [],
    }
    cumulative_near_misses = {dangerous_profile.name: 0, safe_profile.name: 0}

    def _generate_day_observations(day: int) -> None:
        timestamp = _SIM_START + timedelta(days=day)
        for profile in (dangerous_profile, safe_profile):
            pass_count = _poisson(rng, profile.daily_passes)
            for index in range(pass_count):
                risk = sample_assessment(profile, rng)
                observations.append(
                    RiskObservation(
                        vehicle_id=f"SIM-{profile.name}-{day}-{index}",
                        latitude=profile.latitude + rng.uniform(-0.0005, 0.0005),
                        longitude=profile.longitude + rng.uniform(-0.0005, 0.0005),
                        timestamp=timestamp + timedelta(seconds=index),
                        risk_score=risk.risk_score,
                        risk_level=risk.risk_level,
                        contributing_factors=risk.contributing_factors,
                    )
                )
                if _LEVEL_SEVERITY[risk.risk_level] >= _LEVEL_SEVERITY[near_miss_level]:
                    cumulative_near_misses[profile.name] += 1
        daily_near_miss_counts[dangerous_profile.name].append(
            cumulative_near_misses[dangerous_profile.name]
        )
        daily_near_miss_counts[safe_profile.name].append(cumulative_near_misses[safe_profile.name])

    def _nominated(profile: LocationProfile) -> bool:
        return any(_cell_matches(spot.latitude, spot.longitude, profile) for spot in engine.discover(observations))

    lead_time_days: int | None = None
    false_positive = False
    day = 0
    last_checkpoint_day = -1
    while day < horizon_days and lead_time_days is None:
        checkpoint_end = min(day + checkpoint_days, horizon_days)
        for d in range(day, checkpoint_end):
            _generate_day_observations(d)
        last_checkpoint_day = checkpoint_end - 1

        if _nominated(safe_profile):
            false_positive = True
        if _nominated(dangerous_profile):
            # Refine within this checkpoint window to the exact day.
            lead_time_days = _refine_to_exact_day(
                engine, observations, day, checkpoint_end, dangerous_profile
            )
        day = checkpoint_end

    daily_tallies = [
        DailyTally(
            day=index,
            cumulative_near_misses={
                dangerous_profile.name: daily_near_miss_counts[dangerous_profile.name][index],
                safe_profile.name: daily_near_miss_counts[safe_profile.name][index],
            },
            cumulative_crashes=0,
        )
        for index in range(len(daily_near_miss_counts[dangerous_profile.name]))
    ]

    return SimulationResult(
        seed=seed,
        blackspot_lead_time_days=lead_time_days,
        false_positive=false_positive,
        daily_tallies=daily_tallies,
        observations_generated=len(observations),
    )


_LEVEL_SEVERITY = {
    RiskLevel.LOW: 0,
    RiskLevel.MODERATE: 1,
    RiskLevel.HIGH: 2,
    RiskLevel.CRITICAL: 3,
}


def _poisson(rng: random.Random, mean: float) -> int:
    """Knuth's algorithm -- avoids a numpy dependency for one draw."""
    import math

    L = math.exp(-mean)
    k = 0
    p = 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            return k - 1


def _refine_to_exact_day(
    engine: BlackSpotEngine,
    observations: list[RiskObservation],
    window_start_day: int,
    window_end_day: int,
    profile: LocationProfile,
) -> int:
    """Binary-search the exact day within [window_start_day, window_end_day)
    that discovery first succeeds, using only observations up to that day."""
    for candidate_day in range(window_start_day, window_end_day):
        cutoff = _SIM_START + timedelta(days=candidate_day + 1)
        subset = [o for o in observations if o.timestamp < cutoff]
        spots = engine.discover(subset)
        if any(_cell_matches(spot.latitude, spot.longitude, profile) for spot in spots):
            return candidate_day
    return window_end_day - 1


@dataclass(frozen=True)
class MultiSeedResult:
    daily_passes: float
    seeds_run: int
    lead_times_days: list[int]
    """One entry per seed that *was* nominated within the horizon; seeds that
    never nominate are counted in `never_nominated`, not silently dropped."""
    never_nominated: int
    false_positives: int

    @property
    def nomination_rate(self) -> float:
        return (self.seeds_run - self.never_nominated) / self.seeds_run if self.seeds_run else 0.0


def run_multi_seed(
    seeds: int = 10,
    horizon_days: int = 120,
    daily_passes: float | None = None,
    **kwargs,
) -> MultiSeedResult:
    """Run the simulation across many seeds so the headline number is a
    distribution, not one run's luck.

    `daily_passes` overrides both profiles' traffic volume, so the same
    scenario can be replayed at a different realism setting (e.g. a quiet
    single-lane road vs a busy junction) without editing the module-level
    profiles.
    """
    import dataclasses

    lead_times: list[int] = []
    never_nominated = 0
    false_positives = 0

    dangerous = DANGEROUS_PROFILE
    safe = SAFE_PROFILE
    if daily_passes is not None:
        dangerous = dataclasses.replace(DANGEROUS_PROFILE, daily_passes=daily_passes)
        safe = dataclasses.replace(SAFE_PROFILE, daily_passes=daily_passes)

    for seed in range(seeds):
        result = run_simulation(
            seed=seed,
            horizon_days=horizon_days,
            dangerous_profile=dangerous,
            safe_profile=safe,
            **kwargs,
        )

        if result.blackspot_lead_time_days is None:
            never_nominated += 1
        else:
            lead_times.append(result.blackspot_lead_time_days)
        if result.false_positive:
            false_positives += 1

    return MultiSeedResult(
        daily_passes=daily_passes if daily_passes is not None else DANGEROUS_PROFILE.daily_passes,
        seeds_run=seeds,
        lead_times_days=lead_times,
        never_nominated=never_nominated,
        false_positives=false_positives,
    )


def generate_cumulative_near_miss_series(
    profile: LocationProfile,
    seed: int,
    days: int,
    near_miss_level: RiskLevel = RiskLevel.HIGH,
) -> list[int]:
    """Cumulative near-miss count per day at one location over `days`.

    Independent of BlackSpotEngine/discovery -- this only needs
    RiskFusionEngine's per-pass scores, so it can run over a multi-year
    horizon cheaply for the iRAD crash-threshold comparison, which needs a
    much longer window than the discovery lead-time question does.
    """
    rng = random.Random(seed)
    cumulative = 0
    series: list[int] = []
    for day in range(days):
        pass_count = _poisson(rng, profile.daily_passes)
        for _ in range(pass_count):
            risk = sample_assessment(profile, rng)
            if _LEVEL_SEVERITY[risk.risk_level] >= _LEVEL_SEVERITY[near_miss_level]:
                cumulative += 1
        series.append(cumulative)
    return series


def simulate_irad_crash_threshold(
    daily_near_miss_counts: list[int],
    crash_probability_given_near_miss: float,
    seed: int = 0,
    crash_threshold: int = IRAD_CRASH_THRESHOLD,
    horizon_days: int = IRAD_HORIZON_DAYS,
) -> int | None:
    """Given the *same* dangerous-location near-miss stream a simulation run
    produced, simulate how long iRAD's reactive, crash-count rule would take
    to flag the same stretch.

    Each day's *incremental* near-misses (not the cumulative total) are each
    independently rolled against `crash_probability_given_near_miss`; the day
    the running crash count reaches `crash_threshold` is returned. None if it
    never does within `horizon_days` -- itself a meaningful result, not a
    missing one: it means the stretch would still be unlisted after three
    years under the reactive rule.
    """
    rng = random.Random(seed)
    incremental = [daily_near_miss_counts[0]] + [
        daily_near_miss_counts[i] - daily_near_miss_counts[i - 1]
        for i in range(1, len(daily_near_miss_counts))
    ]

    crashes = 0
    day = 0
    while day < min(len(incremental), horizon_days):
        for _ in range(max(0, incremental[day])):
            if rng.random() < crash_probability_given_near_miss:
                crashes += 1
                if crashes >= crash_threshold:
                    return day
        day += 1
    return None
