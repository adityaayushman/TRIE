import { RiskEvent } from "./types";

/** Base URL of the backend's v1 API, e.g. http://localhost:8000/api/v1.
 * Set via NEXT_PUBLIC_API_URL (see docker-compose.yml). */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Websocket endpoint for live risk broadcasts.
 * Mounted by app/api/routes/alerts.py under the same v1 prefix, without the
 * /risk segment. */
export function alertsSocketUrl(): string {
  return `${API_URL.replace(/^http/, "ws")}/alerts/ws`;
}

export async function fetchRecentEvents(limit = 50): Promise<RiskEvent[]> {
  const response = await fetch(`${API_URL}/risk/events?limit=${limit}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GET /risk/events failed: ${response.status}`);
  }
  return response.json();
}
