"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBlackSpots } from "@/lib/api";
import { BlackSpot, RiskLevel } from "@/lib/types";
import { Badge, Card, EmptyState, SectionTitle, Stat } from "./ui";

const NEAR_MISS_LEVELS: RiskLevel[] = ["moderate", "high", "critical"];

/** Which arm of MoRTH's 4E framework a nomination routes to. Emergency Care
 * is absent by construction — it responds to crashes that already happened,
 * which is what this engine exists to pre-empt. */
const INTERVENTION_COPY: Record<BlackSpot["intervention"], string> = {
  engineering: "Public works — resurface, signage, crossing",
  enforcement: "Policing — speed control",
  education: "Driver behaviour",
};

function factorLabel(key: string): string {
  return key
    .split("_")
    .map((w) => (w === "vru" ? "VRU" : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function BlackSpotCard({ spot, rank }: { spot: BlackSpot; rank: number }) {
  const topCauses = Object.entries(spot.cause_breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-600">#{rank}</span>
            <span className="font-mono text-sm text-slate-200">
              {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {spot.dominant_cause} · {INTERVENTION_COPY[spot.intervention]}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={spot.intervention}>{spot.intervention}</Badge>
          {!spot.qualifies_under_irad && <Badge tone="warn">Below iRAD threshold</Badge>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat
          label="Confidence"
          value={(spot.confidence * 100).toFixed(1)}
          unit="%"
          title="Wilson lower bound on the incident rate — the ranking key, so a thinly-observed cell cannot top a well-attested one"
        />
        <Stat
          label="Near misses"
          value={spot.near_miss_count}
          title="Each vehicle pass contributes at most one, so an idling vehicle cannot manufacture a hotspot"
        />
        <Stat
          label="Exposure"
          value={spot.exposure}
          unit=" passes"
          title="The denominator: every vehicle through this cell, not just the ones in trouble"
        />
        <Stat label="Rate" value={(spot.incident_rate * 100).toFixed(1)} unit="%" />
      </div>

      {topCauses.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {topCauses.map(([key, share]) => (
            <li key={key} className="rounded-md bg-slate-800/70 px-2 py-1 text-[0.7rem] text-slate-400">
              {factorLabel(key)} {(share * 100).toFixed(0)}%
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function BlackSpotPanel() {
  const [spots, setSpots] = useState<BlackSpot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minExposure, setMinExposure] = useState(30);
  const [minNearMisses, setMinNearMisses] = useState(5);
  /** Defaults to `moderate`, not the engine's own `high`: this deployment has
   * no camera, so speed is the only live factor and risk tops out near 35% —
   * at `high` nothing the live API records could ever qualify and this panel
   * would always be empty. The control is exposed so that trade-off is
   * visible rather than hidden behind a default. */
  const [nearMissLevel, setNearMissLevel] = useState<RiskLevel>("moderate");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSpots(await fetchBlackSpots({ minExposure, minNearMisses, nearMissLevel }));
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [minExposure, minNearMisses, nearMissLevel]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle hint="predictive, from near-misses">Black-Spot Discovery</SectionTitle>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
          India&apos;s iRAD/e-DAR flags a 500m stretch only after{" "}
          <span className="text-slate-300">five fatal or grievous crashes, or ten deaths,
          in three years</span> — a location must kill people before it earns the label.
          This nominates the same unit of road from near-misses instead, exposure-normalised
          and ranked by a Wilson lower bound, so a stretch can be flagged before anyone dies.
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-5 border-t border-slate-800 pt-4">
          <label className="text-xs text-slate-500">
            <span className="block mb-1">Min exposure: <span className="text-slate-300 tabular-nums">{minExposure}</span></span>
            <input
              type="range"
              min={1}
              max={100}
              value={minExposure}
              onChange={(e) => setMinExposure(Number(e.target.value))}
              className="w-40 accent-sky-500"
            />
          </label>
          <label className="text-xs text-slate-500">
            <span className="block mb-1">Min near-misses: <span className="text-slate-300 tabular-nums">{minNearMisses}</span></span>
            <input
              type="range"
              min={1}
              max={20}
              value={minNearMisses}
              onChange={(e) => setMinNearMisses(Number(e.target.value))}
              className="w-40 accent-sky-500"
            />
          </label>
          <label className="text-xs text-slate-500">
            <span className="mb-1 block">Near-miss level</span>
            <select
              value={nearMissLevel}
              onChange={(e) => setNearMissLevel(e.target.value as RiskLevel)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-600"
            >
              {NEAR_MISS_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-600">
          Min exposure is what excludes a barely-seen cell — the Wilson bound alone cannot,
          since 1 near-miss in 1 pass scores higher than 40 in 200. Near-miss level defaults
          to <span className="text-slate-500">moderate</span> here rather than the engine&apos;s
          own <span className="text-slate-500">high</span>: with no camera attached, speed is
          the only live factor and risk tops out near 35%, so at{" "}
          <span className="text-slate-500">high</span> nothing this API records could ever
          qualify. Real perception at the edge reaches the full range.
        </p>
      </Card>

      {error ? (
        <EmptyState title="Could not load black spots" body={error} />
      ) : spots === null || loading ? (
        <EmptyState title="Aggregating telemetry…" body="Replaying geo-tagged near-misses through the black-spot engine." />
      ) : spots.length === 0 ? (
        <EmptyState
          title="No stretch clears the evidence thresholds yet"
          body={`Nominating a black spot needs at least ${minExposure} vehicle passes and ${minNearMisses} near-misses through the same 500m cell. A public demo has little geo-tagged telemetry — lower the thresholds, or run assessments at one location from the Live tab, to see the engine nominate.`}
        />
      ) : (
        <ul className="space-y-3">
          {spots.map((spot, index) => (
            <BlackSpotCard key={`${spot.latitude},${spot.longitude}`} spot={spot} rank={index + 1} />
          ))}
        </ul>
      )}
    </div>
  );
}
