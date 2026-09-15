"use client";

import { useEffect, useRef, useState } from "react";
import { postAssessment } from "@/lib/api";
import { Card, SectionTitle } from "./ui";

// A stable per-tab id so repeated real-device runs are attributable to one
// "vehicle" in GET /risk/events, the same way TelemetryControls' VEH-DEMO is.
function deviceId(): string {
  if (typeof window === "undefined") return "DEVICE";
  const key = "trie.device_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `DEVICE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

const POST_INTERVAL_MS = 5000;

type Status = "idle" | "requesting" | "live" | "denied" | "unsupported" | "error";

/**
 * The real counterpart to TelemetryControls' slider demo: this reads this
 * browser's own GPS (Geolocation.watchPosition — coords.speed, coords.heading)
 * and motion sensor (DeviceMotionEvent — coords.acceleration) and posts *that*
 * real telemetry to POST /risk/assess on a fixed interval, same endpoint, same
 * pipeline. Genuinely real data — not a simulated feed — but honestly scoped:
 * one real device, not population-scale near-miss telemetry (see
 * ROADMAP.md 2.1 / docs/DATASHEETS.md for that distinction).
 */
export function LiveDeviceTelemetry({ onAssessed }: { onAssessed?: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [reading, setReading] = useState<{ speedKmh: number | null; headingDeg: number | null; accelMs2: number | null; lat: number | null; lon: number | null }>({
    speedKmh: null,
    headingDeg: null,
    accelMs2: null,
    lat: null,
    lon: null,
  });
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const latestRef = useRef(reading);
  latestRef.current = reading;
  const motionHandlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (motionHandlerRef.current) {
      window.removeEventListener("devicemotion", motionHandlerRef.current);
      motionHandlerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus("idle");
  }

  useEffect(() => stop, []); // clean up watchers/listeners/interval on unmount

  async function start() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");

    // iOS 13+ Safari gates DeviceMotion behind an explicit permission prompt,
    // which must be requested from a user gesture — this button click is one.
    // Other browsers have no such API and expose motion data directly.
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
    if (typeof DME?.requestPermission === "function") {
      try {
        const result = await DME.requestPermission();
        if (result !== "granted") {
          // Acceleration stays null (honestly "not observed") but GPS speed
          // alone is still real telemetry worth sending — don't hard-fail.
          setError("Motion-sensor permission denied — continuing with GPS speed only.");
        }
      } catch {
        // requestPermission threw (not actually supported despite existing) —
        // same graceful degrade as above.
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { speed, heading, latitude, longitude } = position.coords;
        setReading((prev) => ({
          ...prev,
          // coords.speed is metres/second, or null with no fix yet.
          speedKmh: speed != null ? Math.max(0, speed * 3.6) : prev.speedKmh,
          headingDeg: heading ?? prev.headingDeg,
          lat: latitude,
          lon: longitude,
        }));
        setStatus("live");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.acceleration; // gravity-compensated linear acceleration, m/s^2
      if (a && (a.x != null || a.y != null || a.z != null)) {
        const magnitude = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
        setReading((prev) => ({ ...prev, accelMs2: magnitude }));
      }
    };
    motionHandlerRef.current = onMotion;
    window.addEventListener("devicemotion", onMotion);

    intervalRef.current = setInterval(async () => {
      const r = latestRef.current;
      if (r.speedKmh === null && r.lat === null) return; // no fix yet — nothing real to send
      try {
        await postAssessment({
          vehicle_id: deviceId(),
          speed_kmh: r.speedKmh ?? 0,
          acceleration_ms2: r.accelMs2 ?? undefined,
          heading_deg: r.headingDeg ?? undefined,
          latitude: r.lat ?? undefined,
          longitude: r.lon ?? undefined,
        });
        setLastSentAt(Date.now());
        onAssessed?.();
      } catch (cause) {
        setError((cause as Error).message);
      }
    }, POST_INTERVAL_MS);
  }

  const copy: Record<Status, string> = {
    idle: "Off. Streams this device's own GPS speed/heading and motion-sensor acceleration into the live pipeline — genuinely real telemetry, not a simulated feed.",
    requesting: "Requesting location/motion permission…",
    live: "Live — reading this device's own sensors.",
    denied: "Location permission denied. Enable it in your browser's site settings to use this.",
    unsupported: "This browser has no Geolocation API.",
    error: "Something went wrong sending an assessment.",
  };

  return (
    <Card>
      <SectionTitle hint="your device's own sensors, not a simulated feed">Live device telemetry</SectionTitle>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={status === "idle" || status === "denied" || status === "unsupported" ? start : stop}
          disabled={status === "requesting"}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            status === "live"
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-sky-600 text-white hover:bg-sky-500"
          }`}
        >
          {status === "live" ? "Stop" : status === "requesting" ? "Requesting…" : "Start live telemetry"}
        </button>

        {status === "live" && (
          <dl className="flex w-full flex-col gap-1 text-[0.7rem] sm:w-auto sm:flex-row sm:flex-wrap sm:gap-x-5">
            <div className="flex justify-between gap-3 sm:justify-start">
              <dt className="text-slate-600">Speed</dt>
              <dd className="tabular-nums text-slate-300">
                {reading.speedKmh !== null ? `${reading.speedKmh.toFixed(1)} km/h` : "waiting for GPS fix…"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:justify-start">
              <dt className="text-slate-600">Heading</dt>
              <dd className="tabular-nums text-slate-300">{reading.headingDeg !== null ? `${reading.headingDeg.toFixed(0)}°` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:justify-start">
              <dt className="text-slate-600">Accel.</dt>
              <dd className="tabular-nums text-slate-300">
                {reading.accelMs2 !== null ? `${reading.accelMs2.toFixed(2)} m/s²` : "not observed (no motion permission)"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:justify-start">
              <dt className="text-slate-600">Last sent</dt>
              <dd className="tabular-nums text-slate-300">
                {lastSentAt ? `${Math.round((Date.now() - lastSentAt) / 1000)}s ago` : "sending on first GPS fix…"}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-600">{copy[status]}</p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-3 border-t border-slate-800 pt-3 text-[0.7rem] leading-relaxed text-slate-600">
        Honest scope: this is <span className="text-slate-400">one real device</span> (yours),
        not population-scale near-miss telemetry — the black-spot engine needs many vehicles
        passing the same stretch to nominate it. It is nonetheless a genuine, live sensor feed
        through the exact production pipeline, not a slider-driven simulation.
      </p>
    </Card>
  );
}
