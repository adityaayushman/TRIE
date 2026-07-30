"""Quantified evaluation of black-spot discovery — detection, specificity, lead time.

    python -m ai.blackspot.evaluate

The lead-time headline (7 days vs iRAD) is one number; this reports the
methodology as a reviewer would want it: across many seeds and two traffic
volumes, how often does the engine nominate the genuinely dangerous location
(detection rate / sensitivity), how often does it wrongly nominate the safe one
(false-positive rate; 1 - specificity), and what is the *distribution* of the
lead time, not just its median.

Scope, stated plainly: this is a controlled evaluation, not a field trial. The
"dangerous" and "safe" locations are authored from the causal factors
ai/trie/risk_fusion.py already models, and the near-miss->crash conversion has
no measured constant, so it is swept. The result therefore supports "the
discovery methodology is sensitive, specific, and early across an order of
magnitude of assumptions," not "these are field-measured rates." Validating
against real MoRTH black spots needs near-miss telemetry for real locations,
which is not publicly available — that remains the open experiment.
"""
from __future__ import annotations

import json

from ai.blackspot.simulation import (
    IRAD_HORIZON_DAYS,
    run_multi_seed,
    simulate_irad_crash_threshold,
    generate_cumulative_series,
    DANGEROUS_PROFILE,
)
import dataclasses

SEEDS = 40
VOLUMES = {"busy_junction": 45, "quiet_road": 10}
CRASH_SWEEP = {"1-in-20": 1 / 20, "1-in-100": 1 / 100, "1-in-300": 1 / 300, "1-in-1000": 1 / 1000}


def _percentile(values: list[int], q: float) -> float:
    """Linear-interpolated percentile; q in [0, 1]. Empty -> nan."""
    if not values:
        return float("nan")
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    pos = q * (len(ordered) - 1)
    low = int(pos)
    frac = pos - low
    hi = min(low + 1, len(ordered) - 1)
    return round(ordered[low] + frac * (ordered[hi] - ordered[low]), 1)


def evaluate(seeds: int = SEEDS) -> dict:
    volumes: dict[str, dict] = {}
    for name, passes in VOLUMES.items():
        result = run_multi_seed(seeds=seeds, horizon_days=120, daily_passes=passes)
        lead = result.lead_times_days
        volumes[name] = {
            "daily_passes": passes,
            "seeds": result.seeds_run,
            # Sensitivity: did the engine flag the genuinely dangerous stretch?
            "detection_rate": round(result.nomination_rate, 3),
            "never_nominated": result.never_nominated,
            # 1 - specificity: did it wrongly flag the safe stretch?
            "false_positive_rate": round(result.false_positives / result.seeds_run, 3),
            "lead_time_days": {
                "min": min(lead) if lead else None,
                "p25": _percentile(lead, 0.25),
                "median": _percentile(lead, 0.50),
                "p75": _percentile(lead, 0.75),
                "max": max(lead) if lead else None,
            },
        }

    # Contrast: how long iRAD's crash-count threshold takes on the same stream,
    # under each assumed near-miss->crash conversion rate.
    quiet_dangerous = dataclasses.replace(DANGEROUS_PROFILE, daily_passes=VOLUMES["quiet_road"])
    long_series = generate_cumulative_series(quiet_dangerous, seed=0, days=IRAD_HORIZON_DAYS)[0]
    irad_sweep = {
        label: simulate_irad_crash_threshold(long_series, crash_probability_given_near_miss=p, seed=0)
        for label, p in CRASH_SWEEP.items()
    }

    return {
        "seeds": seeds,
        "horizon_days": 120,
        "by_volume": volumes,
        "irad_threshold_days": irad_sweep,
        "irad_horizon_days": IRAD_HORIZON_DAYS,
    }


if __name__ == "__main__":
    print(json.dumps(evaluate(), indent=2))
