"""Causal Intelligence Engine — explains *why* risk is rising, not just that it is.

Real implementation: a causal graph / structural model over the TRIE
contributing_factors (e.g. a Bayesian network or learned causal DAG) that
distinguishes root causes from correlated symptoms. This stub ranks the
factors TRIE already computed and maps the top one to a predicted event
via a small rule table.
"""
from __future__ import annotations

from ai.common.types import CausalExplanation, RiskAssessment

_FACTOR_LABELS = {
    "driver_distraction": "Driver Distraction",
    "speed": "High Speed",
    "vru_exposure": "Vulnerable Road Users Nearby",
    "lane_drift": "Lane Drift",
    "road_quality": "Poor Road Surface",
    "traffic_congestion": "Heavy Traffic",
}

_PREDICTED_EVENT_BY_CAUSE = {
    "driver_distraction": "Rear-End Collision",
    "speed": "Loss of Control",
    # The two-thirds of Indian road deaths a conventional ADAS never names.
    "vru_exposure": "Pedestrian or Two-Wheeler Collision",
    "lane_drift": "Side-Swipe Collision",
    "road_quality": "Loss of Traction",
    "traffic_congestion": "Rear-End Collision",
}


class CausalIntelligenceEngine:
    def explain(self, risk: RiskAssessment) -> CausalExplanation:
        if not risk.contributing_factors:
            return CausalExplanation(primary_cause="unknown", secondary_causes=[], predicted_event="none")

        ranked = sorted(risk.contributing_factors.items(), key=lambda kv: kv[1], reverse=True)
        primary_key = ranked[0][0]
        secondary_keys = [k for k, v in ranked[1:] if v > 0]

        return CausalExplanation(
            primary_cause=_FACTOR_LABELS.get(primary_key, primary_key),
            secondary_causes=[_FACTOR_LABELS.get(k, k) for k in secondary_keys],
            predicted_event=_PREDICTED_EVENT_BY_CAUSE.get(primary_key, "Collision"),
        )
