export type RiskLevel = "low" | "moderate" | "high" | "critical";

/** The fields the dashboard renders. Both of the backend's risk payloads —
 * the REST `RiskEvent` and the live websocket `RiskAssessment` — are supersets
 * of this, so either can be handed to <RiskDashboard /> directly. */
export interface RiskSnapshot {
  vehicle_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  contributing_factors: Record<string, number>;
  primary_cause: string;
  secondary_causes: string[];
  predicted_event: string;
  recommended_actions: string[];
  explanation: string;
}

/** Live payload broadcast over /alerts/ws.
 * Matches backend/app/schemas/risk.py RiskAssessmentResponse. */
export interface RiskAssessment extends RiskSnapshot {
  future_risk_score: number;
  time_to_risk_s: number | null;
  collision_probability: number;
}

/** A persisted assessment from GET /risk/events.
 * Matches backend/app/schemas/risk.py RiskEventRead. The temporal forecast
 * fields on RiskAssessment are not persisted, so they are absent here. */
export interface RiskEvent extends RiskSnapshot {
  id: string;
  created_at: string;
}
