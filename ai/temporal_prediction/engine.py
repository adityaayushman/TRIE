"""Temporal Prediction Engine — projects risk forward in time.

Real implementation: an LSTM or temporal Transformer trained on sequences of
past RiskAssessment scores to forecast near-future risk and time-to-collision.
This stub keeps a short rolling history in memory and extrapolates linearly,
which is enough to exercise the rest of the pipeline end-to-end.
"""
from __future__ import annotations

from collections import deque

from ai.common.types import RiskAssessment, TemporalForecast


class TemporalPredictionEngine:
    def __init__(self, history_len: int = 10) -> None:
        self._history: deque[float] = deque(maxlen=history_len)

    def predict(self, risk: RiskAssessment) -> TemporalForecast:
        self._history.append(risk.risk_score)

        if len(self._history) < 2:
            trend = 0.0
        else:
            trend = self._history[-1] - self._history[0]

        future_risk = max(0.0, min(100.0, risk.risk_score + trend))
        collision_probability = round(future_risk / 100.0, 3)
        time_to_risk_s = None
        if trend > 0:
            time_to_risk_s = round(max(1.0, (100.0 - risk.risk_score) / max(trend, 0.1)), 1)

        return TemporalForecast(
            future_risk_score=round(future_risk, 1),
            time_to_risk_s=time_to_risk_s,
            collision_probability=collision_probability,
        )
