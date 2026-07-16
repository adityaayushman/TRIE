import { BlackSpot, RiskAssessment, RiskEvent, RiskLevel } from "./types";

/** Base URL of the backend's v1 API, e.g. http://localhost:8000/api/v1.
 * Baked in at build time via NEXT_PUBLIC_API_URL — Next.js inlines
 * NEXT_PUBLIC_* into the client bundle during `next build`, so setting it at
 * runtime has no effect (see frontend/Dockerfile and the Vercel build
 * command). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Websocket endpoint for live risk broadcasts. `^http` -> `ws` upgrades
 * https to wss correctly, since "https" starts with "http". */
export function alertsSocketUrl(): string {
  return `${API_URL.replace(/^http/, "ws")}/alerts/ws`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }
  return response.json();
}

export function fetchRecentEvents(limit = 50): Promise<RiskEvent[]> {
  return getJson<RiskEvent[]>(`/risk/events?limit=${limit}`);
}

/** Nominated black spots. Thresholds are the study's knobs (see
 * ai/blackspot/engine.py) and are surfaced in the UI rather than fixed, so a
 * reviewer can see how the nomination rule responds. */
export function fetchBlackSpots(params: {
  minExposure?: number;
  minNearMisses?: number;
  nearMissLevel?: RiskLevel;
  days?: number;
} = {}): Promise<BlackSpot[]> {
  const query = new URLSearchParams({
    days: String(params.days ?? 90),
    min_exposure: String(params.minExposure ?? 30),
    min_near_misses: String(params.minNearMisses ?? 5),
    near_miss_level: params.nearMissLevel ?? "high",
  });
  return getJson<BlackSpot[]>(`/risk/blackspots?${query}`);
}

export interface Telemetry {
  vehicle_id: string;
  speed_kmh: number;
  latitude?: number;
  longitude?: number;
}

/** Run one assessment. The response is also broadcast to every connected
 * websocket client, so the dashboard updates from the stream rather than
 * from this return value. */
export async function postAssessment(telemetry: Telemetry): Promise<RiskAssessment> {
  const response = await fetch(`${API_URL}/risk/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telemetry),
  });
  if (!response.ok) {
    throw new Error(`POST /risk/assess failed: ${response.status}`);
  }
  return response.json();
}
