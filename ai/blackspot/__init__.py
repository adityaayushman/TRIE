"""Predictive black-spot discovery — TRIE aggregated across vehicles and time.

Where ai/trie/ answers "how dangerous is this vehicle, right now", this answers
"how dangerous is this stretch of road, for everyone" — the same causal
framework turned from the vehicle axis onto the location axis.
"""
from ai.blackspot.engine import (
    BlackSpot,
    BlackSpotEngine,
    Intervention,
    RiskObservation,
    wilson_lower_bound,
)
from ai.blackspot.geo import DEFAULT_CELL_SIZE_M, MetricGrid, haversine_m

__all__ = [
    "BlackSpot",
    "BlackSpotEngine",
    "DEFAULT_CELL_SIZE_M",
    "Intervention",
    "MetricGrid",
    "RiskObservation",
    "haversine_m",
    "wilson_lower_bound",
]
