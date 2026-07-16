import { RiskAssessment } from "./types";

// Matches backend/app/schemas/risk.py RiskAssessmentResponse.
// Used until the dashboard is wired to GET /api/v1/risk/events and the
// /api/v1/risk/alerts/ws websocket.
export const mockRiskAssessment: RiskAssessment = {
  vehicle_id: "VEH-001",
  risk_score: 91,
  risk_level: "critical",
  contributing_factors: {
    driver_distraction: 0.42,
    speed: 0.22,
    lane_drift: 0.14,
    road_quality: 0.12,
    traffic_congestion: 0.1,
  },
  future_risk_score: 95,
  time_to_risk_s: 4.2,
  collision_probability: 0.95,
  primary_cause: "Driver Distraction",
  secondary_causes: ["High Speed", "Lane Drift", "Poor Road Surface"],
  predicted_event: "Rear-End Collision",
  recommended_actions: ["Reduce Speed", "Increase Following Distance", "Maintain Lane Position"],
  explanation:
    "Risk is 91% (critical), primarily driven by driver distraction, with high speed, lane drift as contributing factors. Predicted event if unaddressed: Rear-End Collision.",
};
