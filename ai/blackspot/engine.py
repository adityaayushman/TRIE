"""Predictive black-spot discovery from near-miss telemetry.

India identifies black spots reactively: iRAD/e-DAR flags a 500m stretch only
once it has recorded five or more fatal/grievous crashes, or ten deaths, over
three years. People must die before a location earns the label, and of ~13,795
stretches identified between 2016 and 2022 only ~5,036 had been rectified.

This engine nominates the same unit of road from *near-misses* instead, which
occur orders of magnitude more often than crashes, so a location can be flagged
before it kills anyone. Three properties make a nomination defensible:

* **Exposure normalisation.** Raw counts measure traffic volume as much as
  danger. A stretch with 10 near-misses in 1,000 passes is safer than one with
  5 in 20. Rates, not counts.
* **The vehicle pass as the unit of analysis.** A vehicle stuck at a bad
  junction emits assessments continuously; counting ticks would let one driver
  manufacture a black spot. Each pass contributes at most one exposure and at
  most one near-miss.
* **A lower confidence bound.** 1 near-miss in 1 pass is a 100% rate on no
  evidence. Two mechanisms handle this, and they are not interchangeable:
  `min_exposure` *excludes* barely-observed cells outright, because the Wilson
  bound alone does not save us — Wilson(1,1)=0.21 genuinely outranks
  Wilson(40,200)=0.15. Among cells that clear that bar, the Wilson lower bound
  then ranks equal rates by how well attested they are: 5-in-30 (0.07) sits
  below 33-in-200 (0.12) at the same ~16.5% rate.

The output attributes each nomination to a cause and routes it to the arm of
MoRTH's 4E framework that can act on it — a pothole cluster is an Engineering
work order, habitual over-speeding is an Enforcement problem.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from ai.blackspot.geo import DEFAULT_CELL_SIZE_M, MetricGrid, centroid, haversine_m
from ai.common.types import RiskLevel

# Ordered by severity so "at least HIGH" is expressible.
_LEVEL_SEVERITY = {
    RiskLevel.LOW: 0,
    RiskLevel.MODERATE: 1,
    RiskLevel.HIGH: 2,
    RiskLevel.CRITICAL: 3,
}


class Intervention(str, Enum):
    """Which arm of MoRTH's 4E framework a nomination belongs to.

    Emergency Care is absent by construction: it responds to crashes that have
    already happened, which is exactly what this engine exists to pre-empt.
    """

    ENGINEERING = "engineering"
    ENFORCEMENT = "enforcement"
    EDUCATION = "education"


# Which authority can actually fix each cause. Road surface is a public works
# problem; speed is a policing problem; distraction is a driver-behaviour
# problem. Congestion is engineering because a stretch that is repeatedly
# congested enough to be dangerous is a capacity/design failure.
_INTERVENTION_BY_FACTOR = {
    "road_quality": Intervention.ENGINEERING,
    "traffic_congestion": Intervention.ENGINEERING,
    "lane_drift": Intervention.ENGINEERING,
    # A stretch where vehicles repeatedly have near-misses with pedestrians and
    # two-wheelers is missing a footpath, a crossing, or a refuge. That is a
    # public-works failure, not a driver-education one.
    "vru_exposure": Intervention.ENGINEERING,
    "speed": Intervention.ENFORCEMENT,
    "driver_distraction": Intervention.EDUCATION,
}

_FACTOR_LABELS = {
    "driver_distraction": "Driver Distraction",
    "speed": "High Speed",
    "vru_exposure": "Vulnerable Road Users Nearby",
    "lane_drift": "Lane Drift",
    "road_quality": "Poor Road Surface",
    "traffic_congestion": "Heavy Traffic",
}


@dataclass(frozen=True)
class RiskObservation:
    """One assessed moment, located in space.

    This is a persisted RiskEvent plus a GPS fix — the pipeline's output is
    useless for spatial analysis without one.
    """

    vehicle_id: str
    latitude: float
    longitude: float
    timestamp: datetime
    risk_score: float
    risk_level: RiskLevel
    contributing_factors: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class BlackSpot:
    """A stretch of road nominated as dangerous, and why."""

    latitude: float
    longitude: float
    near_miss_count: int
    exposure: int
    """Distinct vehicle passes observed through the cell — the denominator."""
    incident_rate: float
    """near_miss_count / exposure. The headline figure, but volume-sensitive at
    low exposure — rank by `confidence` instead."""
    confidence: float
    """Wilson score lower bound on the incident rate at 95%. The ranking key:
    the rate we can defend given how much evidence we have. Only meaningful
    because `min_exposure` has already excluded thinly-observed cells."""
    dominant_cause: str
    cause_breakdown: dict[str, float]
    """Share of accumulated causal weight per factor, summing to ~1."""
    intervention: Intervention
    radius_m: float
    """How spread out the near-misses were around the centroid."""
    first_seen: datetime
    last_seen: datetime

    @property
    def qualifies_under_irad(self) -> bool:
        """Whether this stretch would already be an official black spot.

        iRAD's threshold is five *crashes*; ours counts near-misses, so this is
        a deliberately loose analogue used to contrast the two regimes, not a
        claim of equivalence.
        """
        return self.near_miss_count >= 5


def wilson_lower_bound(successes: int, trials: int, z: float = 1.96) -> float:
    """Lower bound of the Wilson score interval for a binomial proportion.

    Preferred over the normal approximation because it stays valid for the
    small, lopsided samples this engine actually sees (a handful of near-misses
    in a few dozen passes), where the textbook interval can run below zero.
    """
    if trials <= 0:
        return 0.0

    proportion = successes / trials
    denominator = 1 + z**2 / trials
    centre = proportion + z**2 / (2 * trials)
    margin = z * math.sqrt((proportion * (1 - proportion) + z**2 / (4 * trials)) / trials)
    return max(0.0, (centre - margin) / denominator)


@dataclass
class _CellStats:
    exposure: int = 0
    near_misses: int = 0
    factor_weight: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    points: list[tuple[float, float]] = field(default_factory=list)
    first_seen: datetime | None = None
    last_seen: datetime | None = None


class BlackSpotEngine:
    """Aggregates located risk observations into ranked black-spot nominations.

    Args:
        cell_size_m: Spatial bin size. Defaults to iRAD's 500m stretch.
        near_miss_level: Minimum risk level counted as a near-miss.
        min_exposure: Passes required before a cell may be nominated at all.
            Guards against a cell seen twice, both times badly, outranking a
            genuinely surveyed stretch.
        min_near_misses: Near-misses required, mirroring iRAD's five-crash rule.
        pass_gap: Time a vehicle must be absent from a cell before its return
            counts as a new pass. Prevents a stalled vehicle inflating either
            the numerator or the denominator.
    """

    def __init__(
        self,
        cell_size_m: float = DEFAULT_CELL_SIZE_M,
        near_miss_level: RiskLevel = RiskLevel.HIGH,
        min_exposure: int = 30,
        min_near_misses: int = 5,
        pass_gap: timedelta = timedelta(minutes=5),
    ) -> None:
        if min_exposure < 1:
            raise ValueError(f"min_exposure must be at least 1, got {min_exposure}")
        if min_near_misses < 1:
            raise ValueError(f"min_near_misses must be at least 1, got {min_near_misses}")

        self.grid = MetricGrid(cell_size_m=cell_size_m)
        self.near_miss_level = near_miss_level
        self.min_exposure = min_exposure
        self.min_near_misses = min_near_misses
        self.pass_gap = pass_gap

    def _is_near_miss(self, observation: RiskObservation) -> bool:
        return _LEVEL_SEVERITY[observation.risk_level] >= _LEVEL_SEVERITY[self.near_miss_level]

    def discover(self, observations: list[RiskObservation]) -> list[BlackSpot]:
        """Nominate black spots, most defensible first.

        Observations may arrive in any order and from any mix of vehicles; they
        are grouped per vehicle and replayed in time order so passes can be
        delimited.
        """
        cells: dict[tuple[int, int], _CellStats] = defaultdict(_CellStats)

        by_vehicle: dict[str, list[RiskObservation]] = defaultdict(list)
        for observation in observations:
            by_vehicle[observation.vehicle_id].append(observation)

        for vehicle_observations in by_vehicle.values():
            self._accumulate_vehicle(sorted(vehicle_observations, key=lambda o: o.timestamp), cells)

        spots = [
            self._build(cell, stats)
            for cell, stats in cells.items()
            if stats.exposure >= self.min_exposure and stats.near_misses >= self.min_near_misses
        ]
        # Confidence first: it already folds in the rate and the evidence behind
        # it. Count breaks ties so the better-attested stretch wins.
        return sorted(spots, key=lambda s: (s.confidence, s.near_miss_count), reverse=True)

    def _accumulate_vehicle(
        self, observations: list[RiskObservation], cells: dict[tuple[int, int], _CellStats]
    ) -> None:
        """Replay one vehicle's timeline, counting each pass through a cell once."""
        last_seen_in_cell: dict[tuple[int, int], datetime] = {}
        near_miss_used: dict[tuple[int, int], bool] = {}

        for observation in observations:
            cell = self.grid.cell_of(observation.latitude, observation.longitude)
            stats = cells[cell]

            previous = last_seen_in_cell.get(cell)
            is_new_pass = previous is None or observation.timestamp - previous > self.pass_gap
            if is_new_pass:
                stats.exposure += 1
                near_miss_used[cell] = False
            last_seen_in_cell[cell] = observation.timestamp

            if stats.first_seen is None or observation.timestamp < stats.first_seen:
                stats.first_seen = observation.timestamp
            if stats.last_seen is None or observation.timestamp > stats.last_seen:
                stats.last_seen = observation.timestamp

            if not self._is_near_miss(observation) or near_miss_used.get(cell):
                continue

            near_miss_used[cell] = True
            stats.near_misses += 1
            stats.points.append((observation.latitude, observation.longitude))
            for factor, weight in observation.contributing_factors.items():
                stats.factor_weight[factor] += weight

    def _build(self, cell: tuple[int, int], stats: _CellStats) -> BlackSpot:
        latitude, longitude = centroid(stats.points)
        total_weight = sum(stats.factor_weight.values())

        if total_weight > 0:
            breakdown = {
                factor: round(weight / total_weight, 3)
                for factor, weight in sorted(
                    stats.factor_weight.items(), key=lambda kv: kv[1], reverse=True
                )
            }
            dominant_factor = next(iter(breakdown))
        else:
            breakdown = {}
            dominant_factor = ""

        radius_m = max(
            (haversine_m(latitude, longitude, lat, lon) for lat, lon in stats.points),
            default=0.0,
        )

        return BlackSpot(
            latitude=latitude,
            longitude=longitude,
            near_miss_count=stats.near_misses,
            exposure=stats.exposure,
            incident_rate=round(stats.near_misses / stats.exposure, 4),
            confidence=round(wilson_lower_bound(stats.near_misses, stats.exposure), 4),
            dominant_cause=_FACTOR_LABELS.get(dominant_factor, dominant_factor or "unknown"),
            cause_breakdown=breakdown,
            intervention=_INTERVENTION_BY_FACTOR.get(dominant_factor, Intervention.ENFORCEMENT),
            radius_m=round(radius_m, 1),
            first_seen=stats.first_seen,
            last_seen=stats.last_seen,
        )
