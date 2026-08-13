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

export function useRiskStream(): RiskStream {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const historyAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadHistory = useCallback(async () => {
    try {
      const history = await fetchRecentEvents(HISTORY_LIMIT);
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
  }, []);

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
          setSnapshot(assessment);
          // The broadcast is not a persisted row, so pull history again to
          // keep the timeline honest rather than synthesising an entry.
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
  }, [loadHistory]);

  return { snapshot, events, status, error, refresh: loadHistory };
}
