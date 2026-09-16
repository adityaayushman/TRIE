"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { alertsSocketUrl, fetchRecentEvents } from "./api";
import { RiskAssessment, RiskEvent, Snapshot } from "./types";

export type StreamStatus = "loading" | "live" | "reconnecting" | "error";

const MAX_RECONNECT_DELAY_MS = 15_000;
const HISTORY_LIMIT = 50;
// The backend runs on a free tier that sleeps after idle and takes ~50s to
// wake. Rather than strand the first visitor on a hard error that needs a
// manual refresh, retry the history fetch a few times with backoff so the
// dashboard self-heals the moment the server is up.
const HISTORY_MAX_RETRIES = 8;

export interface RiskStream {
  /** Most recent assessment: seeded from history (RiskEvent, no live-only
   * fields), then replaced by live websocket payloads (RiskAssessment). */
  snapshot: Snapshot | null;
  /** Persisted history, newest-first, for the timeline. */
  events: RiskEvent[];
  status: StreamStatus;
  /** Set when the history fetch failed — the backend is unreachable. */
  error: string | null;
  /** Re-fetch history. The websocket keeps `snapshot` current on its own, but
   * a new assessment is only *persisted* history after a round trip. */
  refresh: () => void;
}

/** `locationId`: scope both the persisted history (a real query-param filter)
 * and the live websocket snapshot (client-side — the broadcast is global, so
 * a payload for a different site is simply not accepted as this hook's
 * snapshot) to one registered site. Omit for the unscoped, whole-platform
 * stream (the original, still-default behaviour). */
export function useRiskStream(locationId?: string): RiskStream {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const historyAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadHistory = useCallback(async () => {
    try {
      const history = await fetchRecentEvents(HISTORY_LIMIT, locationId);
      if (cancelledRef.current) return;
      historyAttemptRef.current = 0;
      setEvents(history);
      setError(null);
      // Only seed the snapshot from history if the websocket has not already
      // delivered something fresher — a live payload carries the forecast and
      // road-surface detail that persisted history does not.
      setSnapshot((current) => current ?? history[0] ?? null);
    } catch (cause) {
      if (cancelledRef.current) return;
      // Likely the free-tier backend waking from idle. Auto-retry with backoff
      // and hold a non-error "loading" status so the UI reads as connecting,
      // not broken; only surface a hard error once retries are exhausted.
      historyAttemptRef.current += 1;
      if (historyAttemptRef.current <= HISTORY_MAX_RETRIES) {
        setStatus((s) => (s === "live" ? s : "loading"));
        const delay = Math.min(2000 * historyAttemptRef.current, 8000);
        retryTimerRef.current = setTimeout(() => void loadHistory(), delay);
      } else {
        setError((cause as Error).message);
        setStatus("error");
      }
    }
  }, [locationId]);

  useEffect(() => {
    cancelledRef.current = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | null = null;
    let attempt = 0;

    void loadHistory();

    const connect = () => {
      if (cancelledRef.current) return;
      socket = new WebSocket(alertsSocketUrl());

      socket.onopen = () => {
        if (cancelledRef.current) return;
        attempt = 0;
        setStatus("live");
        setError(null);
      };

      socket.onmessage = (event) => {
        if (cancelledRef.current) return;
        try {
          const assessment = JSON.parse(event.data) as RiskAssessment;
          // The broadcast is global (every connected client gets every
          // assessment); a scoped stream only accepts one tagged to its own
          // site, so a location's live view never flashes another site's
          // reading. Untagged assessments (location_id: null) never match a
          // scoped stream either — correct, since they are not this site's.
          if (!locationId || assessment.location_id === locationId) {
            setSnapshot(assessment);
          }
          // The broadcast is not a persisted row, so pull history again to
          // keep the timeline honest rather than synthesising an entry. Scoped
          // reload of the RIGHT history regardless of whose assessment this
          // was, since another site's new event doesn't change this one's —
          // but reloading is cheap and correctness matters more here.
          void loadHistory();
        } catch {
          // A malformed frame shouldn't tear down a working stream.
        }
      };

      socket.onclose = () => {
        if (cancelledRef.current) return;
        setStatus("reconnecting");
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      // onclose always follows onerror, so reconnection is handled there.
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      cancelledRef.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      socket?.close();
    };
    // loadHistory's own identity already changes with locationId (it's in
    // its useCallback deps above), so this effect already re-runs on a scope
    // change; locationId is listed explicitly too since it's referenced
    // directly in the onmessage handler above.
  }, [loadHistory, locationId]);

  return { snapshot, events, status, error, refresh: loadHistory };
}
