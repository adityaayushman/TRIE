"""Regression guards for the reproducible studies behind the Research page.

Each study's *headline claim* is asserted here at reduced size, so the numbers
the site presents cannot silently drift if a generative model or engine is
edited. These are qualitative-direction checks (learned beats rule, linear is
worse than persistence, the true interactions rank top, detection is perfect on
the controlled benchmark), not exact-value pins — the exact figures live in each
module and its own `python -m …` reproduction.
"""
import numpy as np

from ai.blackspot.evaluate import evaluate
from ai.temporal_prediction.forecast_study import (
    _errors,
    _linear_forecast,
    _make_sequence,
    _persistence_forecast,
    _windows,
)
from ai.trie.fusion_study import run_study
from ai.trie.interaction_analysis import run_analysis


class TestFusionStudy:
    def test_learning_beats_the_hand_set_rule(self):
        result = run_study(n=8000, seed=0)
        models = result["models"]
        rule = models["rule_fixed_linear"]["roc_auc"]
        assert models["learned_linear"]["roc_auc"] > rule
        assert models["learned_gbm"]["roc_auc"] > rule
        # Compounding ground truth -> the non-linear model should not trail the
        # linear one.
        assert models["learned_gbm"]["roc_auc"] >= models["learned_linear"]["roc_auc"] - 0.01


class TestInteractionAnalysis:
    def test_true_interactions_rank_at_the_top(self):
        result = run_analysis(n=8000, sample=90, seed=0)
        top3 = result["ranked_pairs"][:3]
        # All three authored couplings should surface in the top three; allow a
        # one-slot slip for the smaller sample used here.
        assert sum(p["is_true_interaction"] for p in top3) >= 2
        assert result["ranked_pairs"][0]["is_true_interaction"]


class TestForecastStudy:
    def test_linear_extrapolation_is_worse_than_doing_nothing(self):
        """The self-critical finding: at a 6-step horizon, projecting the trend
        straight ahead overshoots turning points, beating even persistence is
        not guaranteed — it is in fact worse."""
        rng = np.random.default_rng(0)
        sequences = [_make_sequence(rng) for _ in range(400)]
        windows, targets = _windows(sequences)
        linear = _errors(_linear_forecast(windows), targets)
        persistence = _errors(_persistence_forecast(windows), targets)
        assert linear["mae"] > persistence["mae"]


class TestBlackspotEvaluation:
    def test_detection_and_specificity_on_the_controlled_benchmark(self):
        result = evaluate(seeds=4)
        busy = result["by_volume"]["busy_junction"]
        assert busy["detection_rate"] == 1.0
        assert busy["false_positive_rate"] == 0.0
