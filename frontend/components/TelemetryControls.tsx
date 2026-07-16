"use client";

import { useState } from "react";
import { postAssessment } from "@/lib/api";
import { Card, SectionTitle } from "./ui";

/** A stretch of NH48 near Gurugram — the same coordinates
 * ai/blackspot/simulation.py uses, so repeated assessments here accumulate
 * into one 500m cell and can actually nominate a black spot. */
const DEMO_LAT = 28.4595;
const DEMO_LON = 77.0266;

/** Drives POST /risk/assess, whose response the backend broadcasts to every
 * websocket client — so the dashboard updates from the stream, not from this
 * call's return value. This is what makes the platform demonstrable: move the
 * speed and watch fusion, causal attribution and the forecast respond.
 */
export function TelemetryControls({ onAssessed }: { onAssessed?: () => void }) {
  const [speed, setSpeed] = useState(95);
  const [vehicleId, setVehicleId] = useState("VEH-DEMO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await postAssessment({
        vehicle_id: vehicleId,
        speed_kmh: speed,
        latitude: DEMO_LAT,
        longitude: DEMO_LON,
      });
      onAssessed?.();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle hint="drives the live pipeline">Run an Assessment</SectionTitle>

      <div className="flex flex-wrap items-end gap-5">
        <label className="text-xs text-slate-500">
          <span className="mb-1.5 block">Vehicle</span>
          <input
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value || "VEH-DEMO")}
            className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-sky-600"
          />
        </label>

        <label className="text-xs text-slate-500">
          <span className="mb-1.5 block">
            Speed <span className="tabular-nums text-slate-300">{speed}</span> km/h
          </span>
          <input
            type="range"
            min={0}
            max={160}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-56 accent-sky-500"
          />
        </label>

        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Assessing…" : "Run assessment"}
        </button>
      </div>

      <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-600">
        Posts telemetry to the live API at {DEMO_LAT}, {DEMO_LON}. No camera is attached to
        the JSON API, so driver distraction and lane drift report as{" "}
        <span className="text-slate-500">not observed</span> and are dropped from the score
        rather than assumed safe — speed is the live input. Repeated runs at this location
        accumulate toward a black-spot nomination.
      </p>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </Card>
  );
}
