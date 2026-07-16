"""Explainable AI Engine — turns risk + causal output into human-readable guidance.

Real implementation: SHAP values computed against the TRIE fusion model for
feature_importance, plus a rule-based recommendation library. This stub
derives feature_importance directly from TRIE's contributing_factors (which
is itself already a transparent, additive score) and maps causes to actions.
"""
from __future__ import annotations

from ai.common.types import CausalExplanation, Recommendation, RiskAssessment

_ACTIONS_BY_CAUSE = {
    "Driver Distraction": ["Alert driver", "Suggest rest stop"],
    "High Speed": ["Reduce speed", "Increase following distance"],
    "Lane Drift": ["Maintain lane position", "Alert driver"],
    "Poor Road Surface": ["Reduce speed", "Increase following distance"],
    "Heavy Traffic": ["Increase following distance", "Suggest alternate route"],
}


class ExplainableAIEngine:
    def explain(self, risk: RiskAssessment, causal: CausalExplanation) -> Recommendation:
        total = sum(risk.contributing_factors.values()) or 1.0
        feature_importance = {
            factor: round(value / total, 3) for factor, value in risk.contributing_factors.items()
        }

        actions = _ACTIONS_BY_CAUSE.get(causal.primary_cause, ["Reduce speed", "Increase following distance"])
        explanation = (
            f"Risk is {risk.risk_score}% ({risk.risk_level.value}), primarily driven by "
            f"{causal.primary_cause.lower()}"
            + (f", with {', '.join(causal.secondary_causes).lower()} as contributing factors" if causal.secondary_causes else "")
            + f". Predicted event if unaddressed: {causal.predicted_event}."
        )

        return Recommendation(
            actions=actions,
            feature_importance=feature_importance,
            explanation=explanation,
        )
