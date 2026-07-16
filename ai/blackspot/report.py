"""Reproduce the lead-time evaluation behind docs/blackspot_lead_time chart.

    python -m ai.blackspot.report

Regenerates, from the real engines, every number that chart displays: the
15-seed lead-time distribution at two traffic volumes, one illustrative
30-day accumulation curve (with the true dual-threshold nomination day, not
a near-miss-count-only approximation), and the iRAD crash-threshold sweep.
Printed as JSON so a reviewer can diff a re-run against what shipped, rather
than trusting a number transcribed into a chart once and never rechecked.
"""
from __future__ import annotations

import dataclasses
import json

from ai.blackspot.simulation import (
    DANGEROUS_PROFILE,
    IRAD_HORIZON_DAYS,
    SAFE_PROFILE,
    find_nomination_day,
    generate_cumulative_series,
    run_multi_seed,
    simulate_irad_crash_threshold,
)

CHART_DAYS = 30
QUIET_DAILY_PASSES = 10
BUSY_DAILY_PASSES = 45
CRASH_PROBABILITY_SWEEP = {
    "1-in-20": 1 / 20,
    "1-in-100": 1 / 100,
    "1-in-300": 1 / 300,
    "1-in-1000": 1 / 1000,
}


def build_report(seeds: int = 15, seed: int = 0) -> dict:
    quiet_dangerous = dataclasses.replace(DANGEROUS_PROFILE, daily_passes=QUIET_DAILY_PASSES)
    quiet_safe = dataclasses.replace(SAFE_PROFILE, daily_passes=QUIET_DAILY_PASSES)

    busy = run_multi_seed(seeds=seeds, horizon_days=120, daily_passes=BUSY_DAILY_PASSES)
    quiet = run_multi_seed(seeds=seeds, horizon_days=120, daily_passes=QUIET_DAILY_PASSES)

    dangerous_nm, dangerous_exposure = generate_cumulative_series(
        quiet_dangerous, seed=seed, days=CHART_DAYS
    )
    safe_nm, _ = generate_cumulative_series(quiet_safe, seed=seed, days=CHART_DAYS)
    illustrative_nomination_day = find_nomination_day(dangerous_nm, dangerous_exposure)

    long_series = generate_cumulative_series(quiet_dangerous, seed=seed, days=IRAD_HORIZON_DAYS)[0]
    irad_sweep = {
        label: simulate_irad_crash_threshold(long_series, crash_probability_given_near_miss=p, seed=seed)
        for label, p in CRASH_PROBABILITY_SWEEP.items()
    }

    sorted_quiet = sorted(quiet.lead_times_days)
    median_index = len(sorted_quiet) // 2
    median = (
        sorted_quiet[median_index]
        if len(sorted_quiet) % 2
        else (sorted_quiet[median_index - 1] + sorted_quiet[median_index]) / 2
    )

    return {
        "seeds_run": seeds,
        "busy_daily_passes": BUSY_DAILY_PASSES,
        "busy_lead_times_days": sorted(busy.lead_times_days),
        "busy_false_positives": busy.false_positives,
        "quiet_daily_passes": QUIET_DAILY_PASSES,
        "quiet_lead_times_days": sorted_quiet,
        "quiet_lead_time_median_days": median,
        "quiet_false_positives": quiet.false_positives,
        "illustrative_curve_seed": seed,
        "illustrative_dangerous_near_miss_series": dangerous_nm,
        "illustrative_dangerous_exposure_series": dangerous_exposure,
        "illustrative_safe_near_miss_series": safe_nm,
        "illustrative_nomination_day": illustrative_nomination_day,
        "irad_horizon_days": IRAD_HORIZON_DAYS,
        "irad_sweep_days": irad_sweep,
    }


if __name__ == "__main__":
    print(json.dumps(build_report(), indent=2))
