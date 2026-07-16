"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRiskStream } from "@/lib/useRiskStream";
import { hasLiveDetail, riskLevelOf } from "@/lib/types";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskTimeline } from "@/components/RiskTimeline";
import { Card, SectionTitle } from "@/components/ui";

/** Overview / command centre. Every figure is derived from real data the API
 * returns — recent events and the live snapshot — not seeded constants. When
 * the database is empty the cards read zero, which is the truth, rather than a
 * fabricated fleet count. */
function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "danger" | "good";
  hint?: string;
}) {
  const valueColor =
    tone === "danger" ? "text-red-400" : tone === "good" ? "text-emerald-400" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {hint && <p className="mt-1 text-[0.65rem] text-slate-600">{hint}</p>}
    </div>
  );
}

export default function OverviewPage() {
  const { snapshot, events, status } = useRiskStream();

  const stats = useMemo(() => {
    const vehicles = new Set(events.map((e) => e.vehicle_id));
    const highRisk = events.filter((e) => {
      const level = riskLevelOf(e.risk_score);
      return level === "high" || level === "critical";
    });
    const withGps = events.filter((e) => e.latitude !== null);
    return {
      assessments: events.length,
      vehicles: vehicles.size,
      highRisk: highRisk.length,
      geoTagged: withGps.length,
    };
  }, [events]);

  const live = snapshot && hasLiveDetail(snapshot) ? snapshot : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Overview</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Live figures from recent telemetry. Empty means an empty database, not a mock.
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assessments" value={stats.assessments} hint="in recent history" />
        <StatCard label="Vehicles seen" value={stats.vehicles} hint="distinct IDs" />
        <StatCard
          label="High-risk events"
          value={stats.highRisk}
          tone={stats.highRisk > 0 ? "danger" : "neutral"}
          hint="≥ 55% risk"
        />
        <StatCard label="Geo-tagged" value={stats.geoTagged} hint="feed black-spot discovery" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <RiskTimeline events={events} />

        <Card>
          <SectionTitle>Latest assessment</SectionTitle>
          {snapshot ? (
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-100">
                  {snapshot.risk_score.toFixed(1)}
                  <span className="ml-1 text-sm font-normal text-slate-500">%</span>
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {snapshot.risk_level} · {snapshot.vehicle_id}
                </p>
              </div>
              <div className="border-t border-slate-800 pt-3">
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-600">
                  Primary cause
                </p>
                <p className="mt-0.5 text-sm text-slate-200">{snapshot.primary_cause}</p>
              </div>
              {live && (
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-[0.65rem] uppercase tracking-wide text-slate-600">
                    Projected
                  </p>
                  <p className="mt-0.5 text-sm text-slate-200">
                    {live.future_risk_score.toFixed(1)}%
                    <span className="ml-2 text-xs text-slate-500">
                      {(live.collision_probability * 100).toFixed(0)}% collision prob.
                    </span>
                  </p>
                </div>
              )}
              <Link
                href="/dashboard/live"
                className="mt-2 inline-block text-xs font-medium text-sky-400 transition hover:text-sky-300"
              >
                Open live view →
              </Link>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No assessments yet.{" "}
              <Link href="/dashboard/live" className="text-sky-400 hover:text-sky-300">
                Run one →
              </Link>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
