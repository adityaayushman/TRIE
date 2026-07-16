export type RiskLevel = "low" | "moderate" | "high" | "critical";

/** Risk-level thresholds from ai/trie/risk_fusion.py. Kept here so the
 * timeline can draw the same bands the engine scores against. */
export const RISK_THRESHOLDS: { level: RiskLevel; min: number }[] = [
  { level: "critical", min: 80 },
  { level: "high", min: 55 },
  { level: "moderate", min: 30 },
  { level: "low", min: 0 },
];

export const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

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
  latitude: number | null;
  longitude: number | null;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  /** [x1, y1, x2, y2], normalized 0-1 to the source frame. */
  bbox: [number, number, number, number];
}

/** Live payload broadcast over /alerts/ws.
 * Matches backend/app/schemas/risk.py RiskAssessmentResponse. */
export interface RiskAssessment extends RiskSnapshot {
  future_risk_score: number;
  time_to_risk_s: number | null;
  collision_probability: number;
  /** Factors with no sensor behind them, dropped from the score rather than
   * measured. Distinct from a factor measured *as* zero. */
  unobserved_factors: string[];
  /** Real-time road hazard detail from ai/road_intelligence/. Live-only: not
   * persisted, so absent from RiskEvent / GET /risk/events. */
  potholes: DetectedObject[];
  cracks: DetectedObject[];
  is_waterlogged: boolean;
  surface_quality_score: number;
}

/** A persisted assessment from GET /risk/events.
 * Matches backend/app/schemas/risk.py RiskEventRead. The temporal forecast,
 * road-hazard detail and unobserved-factor list are not persisted, so they
 * are absent here — see hasLiveDetail(). */
export interface RiskEvent extends RiskSnapshot {
  id: string;
  created_at: string;
}

export type Snapshot = RiskAssessment | RiskEvent;

/** Whether a snapshot came from the live websocket (and so carries the
 * forecast, unobserved factors and road-surface detail) rather than from the
 * persisted-history seed. */
export function hasLiveDetail(snapshot: Snapshot): snapshot is RiskAssessment {
  return "collision_probability" in snapshot;
}

/** A nominated dangerous road stretch from GET /risk/blackspots.
 * Matches backend/app/schemas/risk.py BlackSpotRead. */
export interface BlackSpot {
  latitude: number;
  longitude: number;
  near_miss_count: number;
  exposure: number;
  incident_rate: number;
  confidence: number;
  dominant_cause: string;
  cause_breakdown: Record<string, number>;
  intervention: "engineering" | "enforcement" | "education";
  radius_m: number;
  qualifies_under_irad: boolean;
  first_seen: string;
  last_seen: string;
}

export function riskLevelOf(score: number): RiskLevel {
  return RISK_THRESHOLDS.find((t) => score >= t.min)!.level;
}
