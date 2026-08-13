"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBlackSpots } from "@/lib/api";
import { fetchSampleBlackSpots } from "@/lib/demo";
import { BlackSpot, RiskLevel } from "@/lib/types";
import { BlackSpotMap } from "./BlackSpotMap";
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

type Source = "sample" | "live";

function factorLabel(key: string): string {
  return key
    .split("_")
    .map((w) => (w === "vru" ? "VRU" : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function BlackSpotCard({
  spot,
  rank,
  selected,
  onSelect,
  cardRef,
}: {
  spot: BlackSpot;
  rank: number;
  selected: boolean;
  onSelect: () => void;
  cardRef?: (el: HTMLLIElement | null) => void;
}) {
  const topCauses = Object.entries(spot.cause_breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <li
      ref={cardRef}
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border bg-slate-950/50 p-5 transition ${
        selected ? "border-sky-600/70 ring-1 ring-sky-600/40" : "border-slate-800 hover:border-slate-700"
      }`}
    >
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
  const [source, setSource] = useState<Source>("sample");
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
  const [selected, setSelected] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    try {
      const next =
        source === "sample"
          ? await fetchSampleBlackSpots()
          : await fetchBlackSpots({ minExposure, minNearMisses, nearMissLevel });
      setSpots(next);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [source, minExposure, minNearMisses, nearMissLevel]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectFromMap = useCallback((index: number | null) => {
    setSelected(index);
    if (index !== null) {
      cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle hint="predictive, from near-misses">Black-Spot Discovery</SectionTitle>
          <div className="flex rounded-lg border border-slate-800 p-0.5 text-[0.7rem]">
            {(["sample", "live"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  source === s ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {s === "sample" ? "Illustrative sample" : "Live telemetry"}
              </button>
            ))}
          </div>
        </div>

        <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
          India&apos;s iRAD/e-DAR flags a 500m stretch only after{" "}
          <span className="text-slate-300">five fatal or grievous crashes, or ten deaths,
          in three years</span> — a location must kill people before it earns the label.
          This nominates the same unit of road from near-misses instead, exposure-normalised
          and ranked by a Wilson lower bound, so a stretch can be flagged before anyone dies.
        </p>

        {source === "sample" ? (
          <p className="mt-4 rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2 text-[0.7rem] leading-relaxed text-slate-400">
            <span className="font-semibold text-sky-300">Illustrative sample.</span> The real{" "}
            <code className="rounded-sm bg-slate-800 px-1 py-0.5 text-[0.65rem] text-slate-300">BlackSpotEngine</code>{" "}
            run on a seeded multi-location NCR scenario (the live API only ever receives demo
            telemetry at one point). The engine is real; the near-miss telemetry it aggregates
            is authored — the same honesty as the recorded-footage feeds. Switch to{" "}
            <span className="text-slate-300">Live telemetry</span> for what the deployed API
            actually holds.
          </p>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-end gap-5 border-t border-slate-800 pt-4">
              <label className="text-xs text-slate-500">
                <span className="block mb-1">Min exposure: <span className="text-slate-300 tabular-nums">{minExposure}</span></span>
                <input type="range" min={1} max={100} value={minExposure} onChange={(e) => setMinExposure(Number(e.target.value))} className="w-40 accent-sky-500" />
              </label>
              <label className="text-xs text-slate-500">
                <span className="block mb-1">Min near-misses: <span className="text-slate-300 tabular-nums">{minNearMisses}</span></span>
                <input type="range" min={1} max={20} value={minNearMisses} onChange={(e) => setMinNearMisses(Number(e.target.value))} className="w-40 accent-sky-500" />
              </label>
              <label className="text-xs text-slate-500">
                <span className="mb-1 block">Near-miss level</span>
                <select
                  value={nearMissLevel}
                  onChange={(e) => setNearMissLevel(e.target.value as RiskLevel)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-hidden focus:border-sky-600"
                >
                  {NEAR_MISS_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-600">
              Min exposure is what excludes a barely-seen cell — the Wilson bound alone cannot,
              since 1 near-miss in 1 pass scores higher than 40 in 200. With no camera attached,
              speed is the only live factor and risk tops out near 35%, so the level defaults to{" "}
              <span className="text-slate-500">moderate</span>; at{" "}
              <span className="text-slate-500">high</span> nothing this API records could qualify.
            </p>
          </>
        )}
      </Card>

      {error ? (
        <EmptyState title="Could not load black spots" body={error} />
      ) : spots === null || loading ? (
        <EmptyState title="Aggregating telemetry…" body="Replaying geo-tagged near-misses through the black-spot engine." />
      ) : spots.length === 0 ? (
        <EmptyState
          title="No stretch clears the evidence thresholds yet"
          body={`Nominating a black spot needs at least ${minExposure} vehicle passes and ${minNearMisses} near-misses through the same 500m cell. A public demo has little geo-tagged telemetry — lower the thresholds, switch to the illustrative sample, or run assessments at one location from the Live tab.`}
        />
      ) : (
        <>
          <Card>
            <SectionTitle hint={`${spots.length} stretch${spots.length === 1 ? "" : "es"} nominated`}>
              Where they are
            </SectionTitle>
            <BlackSpotMap spots={spots} selected={selected} onSelect={selectFromMap} />
          </Card>

          <ul className="space-y-3">
            {spots.map((spot, index) => (
              <BlackSpotCard
                key={`${spot.latitude},${spot.longitude}`}
                spot={spot}
                rank={index + 1}
                selected={selected === index}
                onSelect={() => setSelected(selected === index ? null : index)}
                cardRef={(el) => {
                  cardRefs.current[index] = el;
                }}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
