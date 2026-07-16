"""Tests for the black-spot discovery evaluation simulation.

This is a methodology validation (see ai/blackspot/simulation.py's module
docstring for the caveats), so the properties worth pinning are: the real
engines actually discriminate the authored dangerous/safe profiles, the
comparison is reproducible, specificity holds (the safe control is never
falsely nominated), and the iRAD-threshold sweep behaves monotonically in
the direction the underlying model demands.
"""
from __future__ import annotations

import dataclasses

import pytest

from ai.blackspot.simulation import (
    DANGEROUS_PROFILE,
    SAFE_PROFILE,
    find_nomination_day,
    generate_cumulative_near_miss_series,
    generate_cumulative_series,
    run_multi_seed,
    run_simulation,
    sample_assessment,
    simulate_irad_crash_threshold,
)
from ai.common.types import RiskLevel

_LEVEL_SEVERITY = {RiskLevel.LOW: 0, RiskLevel.MODERATE: 1, RiskLevel.HIGH: 2, RiskLevel.CRITICAL: 3}


class TestProfileDiscrimination:
    """The simulation only means anything if the authored profiles actually
    produce different real-engine outputs -- otherwise it is testing nothing."""

    def test_the_dangerous_profile_produces_meaningfully_more_near_misses(self):
        import random

        rng = random.Random(0)
        dangerous_high_count = sum(
            1
            for _ in range(500)
            if _LEVEL_SEVERITY[sample_assessment(DANGEROUS_PROFILE, rng).risk_level]
            >= _LEVEL_SEVERITY[RiskLevel.HIGH]
        )
        safe_high_count = sum(
            1
            for _ in range(500)
            if _LEVEL_SEVERITY[sample_assessment(SAFE_PROFILE, rng).risk_level]
            >= _LEVEL_SEVERITY[RiskLevel.HIGH]
        )
        assert dangerous_high_count > safe_high_count
        assert safe_high_count == 0, "the safe control must not produce near-misses at all"


class TestRunSimulation:
    def test_is_deterministic_given_a_seed(self):
        first = run_simulation(seed=42, horizon_days=60)
        second = run_simulation(seed=42, horizon_days=60)
        assert first.blackspot_lead_time_days == second.blackspot_lead_time_days
        assert first.observations_generated == second.observations_generated

    def test_the_dangerous_location_is_eventually_nominated(self):
        result = run_simulation(seed=0, horizon_days=60)
        assert result.blackspot_lead_time_days is not None

    def test_the_safe_location_is_never_falsely_nominated(self):
        for seed in range(5):
            result = run_simulation(seed=seed, horizon_days=60)
            assert not result.false_positive, f"seed {seed} falsely nominated the safe control"

    def test_lead_time_is_within_the_horizon(self):
        horizon = 60
        result = run_simulation(seed=1, horizon_days=horizon)
        assert result.blackspot_lead_time_days is not None
        assert 0 <= result.blackspot_lead_time_days < horizon

    def test_never_nominated_within_a_too_short_horizon_reports_none_not_an_error(self):
        """A near-zero-traffic, near-zero-danger scenario should report
        'never nominated' honestly rather than crash or fabricate a day."""
        near_empty = dataclasses.replace(DANGEROUS_PROFILE, daily_passes=0.01, vru_probability=0.0)
        result = run_simulation(seed=0, horizon_days=5, dangerous_profile=near_empty)
        assert result.blackspot_lead_time_days is None


class TestMultiSeed:
    def test_higher_traffic_volume_reaches_evidence_thresholds_sooner(self):
        """The exposure/near-miss thresholds are the same regardless of
        traffic; more daily passes must not make discovery slower."""
        busy = run_multi_seed(seeds=8, horizon_days=90, daily_passes=45)
        quiet = run_multi_seed(seeds=8, horizon_days=90, daily_passes=10)

        assert busy.never_nominated == 0
        assert quiet.never_nominated == 0
        assert max(busy.lead_times_days) <= max(quiet.lead_times_days)

    def test_specificity_holds_across_many_seeds(self):
        result = run_multi_seed(seeds=10, horizon_days=60)
        assert result.false_positives == 0

    def test_nomination_rate_reflects_seeds_actually_nominated(self):
        result = run_multi_seed(seeds=6, horizon_days=60)
        assert result.nomination_rate == (6 - result.never_nominated) / 6


class TestIradComparison:
    def test_near_miss_series_is_monotonically_non_decreasing(self):
        series = generate_cumulative_near_miss_series(DANGEROUS_PROFILE, seed=0, days=90)
        assert series == sorted(series)

    def test_a_higher_conversion_rate_reaches_the_threshold_no_later(self):
        """More near-misses converting to crashes can only speed up reaching
        the crash-count threshold, never slow it down."""
        series = generate_cumulative_near_miss_series(DANGEROUS_PROFILE, seed=0, days=365)

        sooner = simulate_irad_crash_threshold(series, crash_probability_given_near_miss=0.05, seed=0)
        later = simulate_irad_crash_threshold(series, crash_probability_given_near_miss=0.001, seed=0)

        assert sooner is not None
        # `later` may be None (never reached) or a larger day count -- both
        # satisfy "no sooner than `sooner`".
        assert later is None or later >= sooner

    def test_reports_none_rather_than_a_fabricated_day_when_never_reached(self):
        series = generate_cumulative_near_miss_series(DANGEROUS_PROFILE, seed=0, days=30)
        result = simulate_irad_crash_threshold(
            series, crash_probability_given_near_miss=1e-6, seed=0, horizon_days=30
        )
        assert result is None

    def test_the_quiet_scenario_still_beats_irad_under_a_generous_assumption(self):
        """The headline comparison: even assuming a generous 1-in-20
        near-miss-to-crash conversion rate, and even at a quiet, lightly
        trafficked location, near-miss discovery must not be slower than
        iRAD's reactive crash-count threshold."""
        quiet_profile = dataclasses.replace(DANGEROUS_PROFILE, daily_passes=10)

        discovery = run_simulation(seed=0, horizon_days=120, dangerous_profile=quiet_profile)
        series = generate_cumulative_near_miss_series(quiet_profile, seed=0, days=365 * 3)
        irad_day = simulate_irad_crash_threshold(series, crash_probability_given_near_miss=0.05, seed=0)

        assert discovery.blackspot_lead_time_days is not None
        assert irad_day is not None
        assert discovery.blackspot_lead_time_days < irad_day


class TestGenerateCumulativeSeries:
    def test_matches_the_near_miss_only_wrapper(self):
        """generate_cumulative_near_miss_series must delegate to the new
        function rather than drift into its own separate implementation."""
        near_misses, _ = generate_cumulative_series(DANGEROUS_PROFILE, seed=0, days=30)
        assert near_misses == generate_cumulative_near_miss_series(DANGEROUS_PROFILE, seed=0, days=30)

    def test_exposure_is_monotonically_non_decreasing(self):
        _, exposure = generate_cumulative_series(DANGEROUS_PROFILE, seed=0, days=60)
        assert exposure == sorted(exposure)

    def test_exposure_accumulates_at_least_the_daily_mean(self):
        """Sanity check on the Poisson sampling: over enough days, cumulative
        exposure should land in the right ballpark of daily_passes * days."""
        _, exposure = generate_cumulative_series(DANGEROUS_PROFILE, seed=0, days=100)
        expected = DANGEROUS_PROFILE.daily_passes * 100
        assert 0.5 * expected < exposure[-1] < 1.5 * expected


class TestFindNominationDay:
    def test_finds_the_day_both_thresholds_are_met(self):
        near_misses = [0, 2, 4, 5, 6, 7]
        exposure = [10, 20, 30, 40, 50, 60]
        assert find_nomination_day(near_misses, exposure, min_near_misses=5, min_exposure=30) == 3

    def test_exposure_can_be_the_later_binding_constraint(self):
        """Low daily traffic can hold near-misses above the bar for days
        before exposure catches up -- the exact case a near-miss-only check
        would get wrong."""
        near_misses = [5, 6, 7, 8]  # crosses 5 immediately on day 0
        exposure = [3, 6, 9, 35]  # exposure only clears 30 on day 3
        assert find_nomination_day(near_misses, exposure, min_near_misses=5, min_exposure=30) == 3

    def test_near_misses_can_be_the_later_binding_constraint(self):
        near_misses = [0, 1, 2, 5]
        exposure = [40, 45, 50, 55]  # exposure clears 30 immediately
        assert find_nomination_day(near_misses, exposure, min_near_misses=5, min_exposure=30) == 3

    def test_returns_none_when_never_satisfied(self):
        assert find_nomination_day([0, 1, 2], [40, 45, 50], min_near_misses=5, min_exposure=30) is None
