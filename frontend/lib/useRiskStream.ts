"use client";

import { useEffect, useRef, useState } from "react";
import { alertsSocketUrl, fetchRecentEvents } from "./api";
import { RiskAssessment, RiskSnapshot } from "./types";

export type StreamStatus = "loading" | "live" | "reconnecting" | "error";

const MAX_RECONNECT_DELAY_MS = 15_000;

export interface RiskStream {
  /** Most recent assessment: seeded from history, then updated live. */
  snapshot: RiskSnapshot | null;
  status: StreamStatus;
  /** Set when the initial history fetch failed — the backend is unreachable. */
  error: string | null;
}

/** Seeds from GET /risk/events, then keeps the latest assessment current from
 * the /alerts/ws broadcast. Reconnects with exponential backoff. */
export function useRiskStream(): RiskStream {
  const [snapshot, setSnapshot] = useState<RiskSnapshot | null>(null);
  const [status, setStatus] = useState<StreamStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    fetchRecentEvents(1)
      .then((events) => {
        if (cancelled) return;
        setError(null);
        // No events yet is normal on a cold database; the websocket will
        // deliver the first one as soon as POST /risk/assess is called.
        if (events.length > 0) setSnapshot(events[0]);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message);
        setStatus("error");
      });

    const connect = () => {
      if (cancelled) return;
      const socket = new WebSocket(alertsSocketUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setStatus("live");
        setError(null);
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          setSnapshot(JSON.parse(event.data) as RiskAssessment);
        } catch {
          // A malformed frame shouldn't tear down a working stream.
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setStatus("reconnecting");
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      // onclose always follows onerror, so reconnection is handled there.
      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  return { snapshot, status, error };
}
