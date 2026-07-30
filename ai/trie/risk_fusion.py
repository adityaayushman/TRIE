"""Transportation Risk Intelligence Engine (TRIE) — the core innovation.

Fuses driver, vehicle, road and traffic state into a single dynamic risk score.

Two design decisions distinguish this from a conventional ADAS risk model, and
both come from what actually kills people on Indian roads (MoRTH 2024:
1,77,175 deaths; two-wheeler riders 46.2%, pedestrians 20.6%).

**1. Vulnerable road users are a first-class risk factor.** Conventional models
score the risk *to the occupant* — distraction, lane discipline, closing speed.
But over two-thirds of Indian road deaths are people with no metal around them.
A car moving through a crowd of motorcycles and pedestrians is dangerous
regardless of how alert its driver is, and this model says so.

**2. The factor set adapts to what is actually observable.** A conventional
model assumes a fixed sensor suite and a lane-disciplined road. Here, lane
drift is scored *only where lane markings exist*, and driver distraction *only
where a driver's face is visible*. Most Indian roads have no lane markings, and
a two-wheeler rider has no cabin camera — so on those roads a fixed model would
either fabricate measurements or silently score dangerous conditions as safe.
When a factor is unobservable its weight is redistributed across the rest, so
the score always spans a true 0-100 and stays comparable between a lane-marked
highway and an unmarked village road.

Real implementation: a learned fusion model (gradient-boosted trees or a small
MLP) trained on labelled near-miss/accident telemetry. The weights below are a
transparent rule-based approximation — which has the side benefit of making
`contributing_factors` exactly additive, and therefore honestly explainable
without post-hoc attribution.
"""
from __future__ import annotations

from ai.common.types import (
    DetectedObject,
    DriverState,
    EnvironmentState,
    PerceptionResult,
    RiskAssessment,
    RiskLevel,
    RoadState,
    TrafficState,
    VehicleDynamics,
)
from ai.vru_intelligence.vulnerability import VulnerabilityAssessment, amplify_exposure

# The perception/telemetry factors, ordered by share of Indian road deaths the
# factor speaks to, not by how easy it is to measure.
_PERCEPTION_WEIGHTS = {
    "driver_distraction": 0.28,
    "speed": 0.22,
    "vru_exposure": 0.20,
    "road_quality": 0.13,
    "lane_drift": 0.09,
    "traffic_congestion": 0.08,
}

# Environmental context (lighting / time of day; see ai/environment) is a
# seventh factor. It is folded in so the six factors above keep their *exact*
# original relative weights whenever it is unobserved: each is scaled by
# (1 - LOW_LIGHT_WEIGHT), so redistributing over the six alone renormalises
# straight back to the published values. An assessment with no timestamp
# therefore scores identically to before this factor existed.
LOW_LIGHT_WEIGHT = 0.10
_BASE_WEIGHTS = {
    **{factor: weight * (1 - LOW_LIGHT_WEIGHT) for factor, weight in _PERCEPTION_WEIGHTS.items()},
    "low_light": LOW_LIGHT_WEIGHT,
}

# Speed reference. 120km/h is the highest Indian expressway limit, so at or
# above it the speed term saturates.
_SPEED_REFERENCE_KMH = 120.0

# Lateral error at which lane drift is scored as maximal — roughly half a
# 3.5m lane, i.e. a wheel on the line.
_LANE_DRIFT_LIMIT_M = 1.75

# A vulnerable road user whose box fills this fraction of the frame is close
# enough to be unavoidable.
_VRU_IMMINENT_BOX_AREA = 0.12
# Above this many vulnerable road users, the scene is crowded and the count
# stops adding information.
_VRU_CROWD_COUNT = 5


def _box_area(detection: DetectedObject) -> float:
    x1, y1, x2, y2 = detection.bbox
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def vru_exposure(perception: PerceptionResult) -> float:
    """How exposed the vulnerable road users around this vehicle are, 0-1.

    Combines proximity with crowding, because they are different dangers: one
    pedestrian stepping off a kerb right in front is imminent, while a dense
    swarm of motorcycles is a sustained hazard even when none is close.
    Proximity dominates, since it is the one that leaves no time to react.

    Box area stands in for distance. It is monocular and crude — a proper
    implementation projects to ground plane or uses stereo/depth — but it is
    monotonic in closeness, which is what the score needs.
    """
    users = perception.vulnerable_road_users
    if not users:
        return 0.0

    proximity = min(max(_box_area(user) for user in users) / _VRU_IMMINENT_BOX_AREA, 1.0)
    crowding = min(len(users) / _VRU_CROWD_COUNT, 1.0)
    return min(0.65 * proximity + 0.35 * crowding, 1.0)


def _redistribute(observed: set[str]) -> dict[str, float]:
    """Renormalise the observable factors' weights to sum to 1.

    This is what keeps scores comparable across sensor suites and road types:
    without it, a rider with no cabin camera on an unmarked road could never
    exceed 63% risk no matter how dangerous the situation, purely because two
    factors were unmeasurable.
    """
    total = sum(weight for factor, weight in _BASE_WEIGHTS.items() if factor in observed)
    if total <= 0:
        return {}
    return {
        factor: weight / total
        for factor, weight in _BASE_WEIGHTS.items()
        if factor in observed
    }


class RiskFusionEngine:
    def fuse(
        self,
        driver: DriverState,
        road: RoadState,
        traffic: TrafficState,
        vehicle: VehicleDynamics,
        perception: PerceptionResult,
        environment: EnvironmentState | None = None,
        vulnerability: VulnerabilityAssessment | None = None,
    ) -> RiskAssessment:
        # Always observable: they need no sensor beyond telemetry and the road
        # camera the platform already requires.
        exposure = vru_exposure(perception)
        # If a helmet/triple-riding detector saw the scene, the *same* physical
        # proximity of a bare-headed or overloaded rider is a higher fatality
        # exposure than a helmeted one (ai/vru_intelligence). Amplify the
        # magnitude here, before weighting, so the vru_exposure term's
        # additive contribution honestly reflects it and nothing else shifts.
        if vulnerability is not None:
            exposure = amplify_exposure(exposure, vulnerability)
        magnitudes = {
            "speed": min(vehicle.speed_kmh / _SPEED_REFERENCE_KMH, 1.0),
            "road_quality": 1.0 - road.surface_quality_score,
            "traffic_congestion": traffic.congestion_level,
            "vru_exposure": exposure,
        }

        if driver.face_detected:
            magnitudes["driver_distraction"] = 1.0 - driver.attention_score
        if perception.lane_detected:
            magnitudes["lane_drift"] = min(
                abs(perception.lane_offset_m) / _LANE_DRIFT_LIMIT_M, 1.0
            )
        # Environmental context is observable whenever a timestamp is known —
        # free on the telemetry-only deployment. Omitted here (default None), it
        # is treated as any unobserved factor: dropped, weight redistributed.
        if environment is not None:
            magnitudes["low_light"] = max(0.0, min(1.0, environment.light_risk))

        weights = _redistribute(set(magnitudes))
        factors = {
            factor: magnitude * weights[factor] for factor, magnitude in magnitudes.items()
        }
        risk_score = round(sum(factors.values()) * 100, 1)

        # Uncertainty band, driven entirely by which factors went unmeasured.
        # `raw` scores the observed factors at their *base* weight (no
        # redistribution), i.e. what the risk would be if every unobserved
        # factor were benign — the floor. The unobserved base weight, all of it
        # at magnitude 1, is the most those factors could add — the ceiling.
        # _BASE_WEIGHTS sums to 1, so the unobserved share is 1 - observed.
        raw = sum(magnitude * _BASE_WEIGHTS[factor] for factor, magnitude in magnitudes.items())
        observed_weight = sum(_BASE_WEIGHTS[factor] for factor in magnitudes)
        unobserved_weight = max(0.0, 1.0 - observed_weight)
        risk_lower = round(raw * 100, 1)
        risk_upper = round(min(1.0, raw + unobserved_weight) * 100, 1)

        if risk_score >= 80:
            level = RiskLevel.CRITICAL
        elif risk_score >= 55:
            level = RiskLevel.HIGH
        elif risk_score >= 30:
            level = RiskLevel.MODERATE
        else:
            level = RiskLevel.LOW

        # Surface the vulnerability attribution only when it actually changed
        # the score (a helmeted, non-overloaded scene multiplies by 1.0 and
        # carries no explanatory weight, so it stays None rather than noise).
        vru_vulnerability = None
        if vulnerability is not None and vulnerability.multiplier > 1.0:
            vru_vulnerability = {
                "multiplier": vulnerability.multiplier,
                "dominant_factor": vulnerability.dominant_factor,
                "without_helmet": vulnerability.without_helmet,
                "triple_riding": vulnerability.triple_riding,
            }

        return RiskAssessment(
            risk_score=risk_score,
            risk_level=level,
            contributing_factors=factors,
            unobserved_factors=sorted(set(_BASE_WEIGHTS) - set(magnitudes)),
            vru_vulnerability=vru_vulnerability,
            risk_lower=risk_lower,
            risk_upper=risk_upper,
        )
