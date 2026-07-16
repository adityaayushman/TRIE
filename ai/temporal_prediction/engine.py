"""Temporal Prediction Engine — projects risk forward in time.

Real implementation: an LSTM or temporal Transformer trained on sequences of
past RiskAssessment scores to forecast near-future risk and time-to-collision.
This stub keeps a short rolling history per vehicle in memory and extrapolates
linearly, which is enough to exercise the rest of the pipeline end-to-end.
"""
from __future__ import annotations

from collections import OrderedDict, deque

from ai.common.types import RiskAssessment, TemporalForecast

DEFAULT_VEHICLE_ID = "default"
# Vehicles tracked at once before the least-recently-seen is evicted. Bounds
# memory for a long-running process assessing many distinct vehicles; a
# deployment that needs more should back this with a store keyed by
# vehicle_id and a TTL rather than raising this further.
DEFAULT_MAX_TRACKED_VEHICLES = 10_000


class TemporalPredictionEngine:
    """Extrapolates each vehicle's own recent risk trend.

    Keyed by `vehicle_id`: one process serves every vehicle reporting
    telemetry, and a single shared rolling history would let one vehicle's
    trend read as another's. A delivery van idling in traffic (falling risk)
    and a motorcycle accelerating past it (rising risk) must not blend into
    one meaningless average.
    """

    def __init__(
        self,
        history_len: int = 10,
        max_tracked_vehicles: int = DEFAULT_MAX_TRACKED_VEHICLES,
    ) -> None:
        if max_tracked_vehicles < 1:
            raise ValueError(
                f"max_tracked_vehicles must be at least 1, got {max_tracked_vehicles}"
            )
        self.history_len = history_len
        self.max_tracked_vehicles = max_tracked_vehicles
        # OrderedDict as an LRU: move_to_end on access, evict from the front.
        self._histories: OrderedDict[str, deque[float]] = OrderedDict()

    def _history_for(self, vehicle_id: str) -> deque[float]:
        history = self._histories.get(vehicle_id)
        if history is None:
            history = deque(maxlen=self.history_len)
            self._histories[vehicle_id] = history
            if len(self._histories) > self.max_tracked_vehicles:
                self._histories.popitem(last=False)
        else:
            self._histories.move_to_end(vehicle_id)
        return history

    def predict(
        self, risk: RiskAssessment, vehicle_id: str = DEFAULT_VEHICLE_ID
    ) -> TemporalForecast:
        history = self._history_for(vehicle_id)
        history.append(risk.risk_score)

        if len(history) < 2:
            trend = 0.0
        else:
            trend = history[-1] - history[0]

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
