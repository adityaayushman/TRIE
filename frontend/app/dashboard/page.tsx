"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRiskStream } from "@/lib/useRiskStream";
import { hasLiveDetail, riskLevelOf } from "@/lib/types";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskTimeline } from "@/components/RiskTimeline";
import { Card, PageHeader, SectionTitle } from "@/components/ui";

/** Overview / command centre. Every figure is derived from real data the API
 * returns — recent events and the live snapshot — not seeded constants. When
 * the database is empty the cards read zero, which is the truth, rather than a
 * fabricated fleet count. */
const STAT_TONES = {
  neutral: { glow: "rgba(56,189,248,0.14)", bar: "#38bdf8", value: "from-white to-sky-200" },
  danger: { glow: "rgba(239,68,68,0.16)", bar: "#f87171", value: "from-white to-red-300" },
  good: { glow: "rgba(52,211,153,0.14)", bar: "#34d399", value: "from-white to-emerald-200" },
} as const;

function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: keyof typeof STAT_TONES;
  hint?: string;
}) {
  const t = STAT_TONES[tone];
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-linear-to-b from-slate-900/90 to-slate-950/60 p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] transition-all hover:-translate-y-0.5 hover:border-slate-700"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: t.glow, opacity: 0.7 }}
      />
      <span aria-hidden className="absolute left-0 top-4 h-8 w-0.5 rounded-full" style={{ backgroundColor: t.bar }} />
      <p className="relative text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`relative mt-2 bg-linear-to-br ${t.value} bg-clip-text text-3xl font-bold tabular-nums text-transparent`}>
        {value}
      </p>
      {hint && <p className="relative mt-1 text-[0.65rem] text-slate-600">{hint}</p>}
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
      <PageHeader
        icon="overview"
        title="Overview"
        subtitle="Live figures from recent telemetry. Empty means an empty database, not a mock."
        right={<ConnectionBadge status={status} />}
      />

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
