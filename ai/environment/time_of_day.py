"""Environmental context: lighting / time-of-day risk from the clock.

Unlike the perception factors, this needs no camera and no external feed — the
hour of day is free from the assessment timestamp, so it is a real input the
deployed, telemetry-only pipeline can actually use. And unlike the fusion
weights, the prior here is grounded in *published* Indian data, not authored:

  MoRTH, "Road Accidents in India 2022": the 18:00–21:00 window alone holds
  20.4% of all road accidents — the single highest three-hour band, and stable
  across five years. Night hours carry fewer accidents but a markedly higher
  fatality rate per crash (reduced visibility, higher speeds, fatigue).

So the risk here is dominated by darkness, with an added bump over the MoRTH
evening peak. It is a calibrated prior from public aggregates, not a per-vehicle
measurement — stated as such, and combined with the observed factors by the same
fusion, never asserted as a certainty.
"""
from __future__ import annotations

import math

# Rough Indian averages; a location-aware version would use lat/lon + date to
# compute true sunrise/sunset, which is the natural refinement.
_DAWN_START, _DAWN_END = 5.5, 7.0
_DUSK_START, _DUSK_END = 17.5, 19.0
_EVENING_PEAK_HOUR = 19.5  # centre of MoRTH's 18:00–21:00 concentration


def _smoothstep(edge0: float, edge1: float, x: float) -> float:
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def light_risk_for_hour(hour: float) -> float:
    """Lighting / time-of-day risk in [0, 1] for a 24-hour clock hour.

    Low in full daylight, high through the night, with a bump over the evening
    accident peak. Continuous, so an assessment at 18:40 is not a cliff-edge
    away from one at 17:59.
    """
    h = hour % 24.0
    daylight = _smoothstep(_DAWN_START, _DAWN_END, h) * (1.0 - _smoothstep(_DUSK_START, _DUSK_END, h))
    darkness = 1.0 - daylight
    evening_peak = math.exp(-((h - _EVENING_PEAK_HOUR) ** 2) / (2 * 1.6**2))
    risk = 0.12 + 0.62 * darkness + 0.18 * evening_peak
    return round(min(1.0, risk), 3)


def describe_hour(hour: float) -> str:
    """A short human label for the lighting condition at this hour."""
    h = hour % 24.0
    if _DAWN_END <= h < _DUSK_START:
        return "daylight"
    if _DAWN_START <= h < _DAWN_END:
        return "dawn"
    if _DUSK_START <= h < _DUSK_END:
        return "dusk"
    if _DUSK_END <= h < 21.0:
        return "evening peak"
    return "night"
