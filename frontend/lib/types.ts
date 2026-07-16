export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface RiskAssessment {
  vehicle_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  contributing_factors: Record<string, number>;
  future_risk_score: number;
  time_to_risk_s: number | null;
  collision_probability: number;
  primary_cause: string;
  secondary_causes: string[];
  predicted_event: string;
  recommended_actions: string[];
  explanation: string;
}
