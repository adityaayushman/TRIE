"use client";

import { useMemo, useState } from "react";
import { RiskLevel } from "@/lib/types";
import { RiskGauge } from "./RiskGauge";
import { FactorBreakdown } from "./FactorBreakdown";

/** Interactive twin of ai/trie/risk_fusion.py, in the browser: the SAME additive
 * weights, the SAME redistribution of an unobserved factor's weight, and the
 * SAME sensor-driven uncertainty band — so dragging a slider or turning a sensor
 * off shows the real engine's behaviour, not a mock. Turn the camera off and the
 * band widens because the score genuinely knows less. */

// From ai/trie/risk_fusion.py — kept in sync by construction (values, not logic).
const PERCEPTION_WEIGHTS: Record<string, number> = {
  driver_distraction: 0.28,
  speed: 0.22,
  vru_exposure: 0.2,
  road_quality: 0.13,
  lane_drift: 0.09,
  traffic_congestion: 0.08,
};
const LOW_LIGHT_WEIGHT = 0.1;
const BASE: Record<string, number> = {
  ...Object.fromEntries(
    Object.entries(PERCEPTION_WEIGHTS).map(([k, w]) => [k, w * (1 - LOW_LIGHT_WEIGHT)])
  ),
  low_light: LOW_LIGHT_WEIGHT,
};

type FKey = keyof typeof BASE | "low_light";
const FACTORS: { key: string; label: string; hint: string; sensor: "telemetry" | "clock" | "camera" }[] = [
  { key: "speed", label: "Speed", hint: "telemetry", sensor: "telemetry" },
  { key: "driver_distraction", label: "Driver distraction", hint: "cabin camera", sensor: "camera" },
  { key: "vru_exposure", label: "VRU exposure", hint: "road camera", sensor: "camera" },
  { key: "road_quality", label: "Road hazard", hint: "road camera", sensor: "camera" },
  { key: "lane_drift", label: "Lane drift", hint: "lane markings", sensor: "camera" },
  { key: "traffic_congestion", label: "Congestion", hint: "road camera", sensor: "camera" },
  { key: "low_light", label: "Low light", hint: "clock (free)", sensor: "clock" },
];

const PRESETS: { name: string; observed: (f: (typeof FACTORS)[number]) => boolean }[] = [
  { name: "Full sensor suite", observed: () => true },
  { name: "No camera", observed: (f) => f.sensor !== "camera" },
  { name: "Telemetry only", observed: (f) => f.sensor === "telemetry" },
];

function levelOf(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

export function FusionPlayground() {
  const [mag, setMag] = useState<Record<string, number>>({
    speed: 0.55, driver_distraction: 0.5, vru_exposure: 0.45,
    road_quality: 0.3, lane_drift: 0.2, traffic_congestion: 0.4, low_light: 0.35,
  });
  const [observed, setObserved] = useState<Record<string, boolean>>(
    Object.fromEntries(FACTORS.map((f) => [f.key, true]))
  );

  const { score, level, lower, upper, factors } = useMemo(() => {
    const obs = FACTORS.filter((f) => observed[f.key]).map((f) => f.key);
    const total = obs.reduce((s, k) => s + BASE[k as FKey], 0);
    const contrib: Record<string, number> = {};
    obs.forEach((k) => {
      const redist = total > 0 ? BASE[k as FKey] / total : 0;
      contrib[k] = mag[k] * redist;
    });
    const sc = Math.round(obs.reduce((s, k) => s + contrib[k], 0) * 100 * 10) / 10;
    const raw = obs.reduce((s, k) => s + mag[k] * BASE[k as FKey], 0);
    const unobserved = Math.max(0, 1 - total);
    return {
      score: sc,
      level: levelOf(sc),
      lower: Math.round(raw * 100 * 10) / 10,
      upper: Math.round(Math.min(1, raw + unobserved) * 100 * 10) / 10,
      factors: contrib,
    };
  }, [mag, observed]);

  const applyPreset = (p: (typeof PRESETS)[number]) =>
    setObserved(Object.fromEntries(FACTORS.map((f) => [f.key, p.observed(f)])));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* controls */}
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[0.7rem] font-medium text-slate-300 transition hover:border-sky-500/50 hover:text-white"
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          {FACTORS.map((f) => {
            const on = observed[f.key];
            return (
              <div key={f.key} className={`rounded-lg border px-3 py-2 transition ${on ? "border-slate-800 bg-slate-950/40" : "border-slate-800/50 bg-slate-950/20 opacity-55"}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setObserved((o) => ({ ...o, [f.key]: !o[f.key] }))}
                      className="h-3 w-3 accent-sky-500"
                    />
                    {f.label}
                    <span className="text-[0.6rem] text-slate-600">{f.hint}</span>
                  </label>
                  <span className="font-mono text-[0.7rem] tabular-nums text-slate-500">
                    {on ? `${Math.round(mag[f.key] * 100)}%` : "unobserved"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(mag[f.key] * 100)}
                  disabled={!on}
                  onChange={(e) => setMag((m) => ({ ...m, [f.key]: Number(e.target.value) / 100 }))}
                  className="mt-1.5 h-1 w-full cursor-pointer accent-sky-500 disabled:cursor-not-allowed"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* live output — the real dashboard gauge + factor bars */}
      <div className="flex flex-col items-center">
        <RiskGauge score={score} level={level} lower={lower} upper={upper} />
        <p className="mt-2 text-center text-[0.7rem] leading-relaxed text-slate-500">
          Uncertainty band <span className="tabular-nums text-slate-400">{lower.toFixed(0)}–{upper.toFixed(0)}%</span>{" "}
          — it widens as you turn sensors off, because the unmeasured factors&apos; weight is redistributed,
          not assumed safe.
        </p>
        <div className="mt-3 w-full">
          <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-slate-600">
            Contributing factors (sum to the score)
          </p>
          <FactorBreakdown factors={factors} />
        </div>
      </div>
    </div>
  );
}
