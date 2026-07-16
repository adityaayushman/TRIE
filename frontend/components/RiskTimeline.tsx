"use client";

import { useMemo, useState } from "react";
import { RISK_THRESHOLDS, RiskEvent } from "@/lib/types";
import { Card, EmptyState, SectionTitle } from "./ui";

/** One series (risk over time), so one hue and no legend — the title names
 * the measure. Validated ≥3:1 against the slate-900 card surface. */
const LINE_COLOR = "#3987e5";

const WIDTH = 760;
const HEIGHT = 240;
const PAD = { left: 30, right: 14, top: 12, bottom: 26 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** The engine's own thresholds, drawn as reference lines so a reading can be
 * placed against the band that produced its label. Skips `low` (min 0), which
 * is the baseline. */
const REFERENCE_LINES = RISK_THRESHOLDS.filter((t) => t.min > 0);

export function RiskTimeline({ events }: { events: RiskEvent[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  /** Per-vehicle, not fleet-wide: ai/temporal_prediction/ keys its trend by
   * vehicle_id, and joining two vehicles' scores into one line would draw a
   * continuity that does not exist. */
  const vehicleId = events[0]?.vehicle_id;
  const series = useMemo(
    () =>
      events
        .filter((e) => e.vehicle_id === vehicleId)
        .slice()
        .reverse(), // API returns newest-first; a timeline reads oldest-first
    [events, vehicleId]
  );

  if (series.length === 0) {
    return (
      <Card>
        <SectionTitle>Risk History</SectionTitle>
        <EmptyState
          title="No history yet"
          body="Run assessments from the Live tab and each one lands here, building this vehicle's risk trend over time."
        />
      </Card>
    );
  }

  const x = (i: number) =>
    PAD.left + (series.length === 1 ? PLOT_W / 2 : (i / (series.length - 1)) * PLOT_W);
  const y = (score: number) => PAD.top + PLOT_H - (score / 100) * PLOT_H;

  const linePath = series
    .map((e, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(e.risk_score)}`)
    .join(" ");
  const areaPath =
    series.length > 1
      ? `${linePath} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
      : "";

  const active = hovered !== null ? series[hovered] : null;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle hint={`vehicle ${vehicleId}`}>Risk History</SectionTitle>
        <span className="mb-3 text-[0.7rem] text-slate-600">
          {series.length} assessment{series.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full min-w-[520px]"
          role="img"
          aria-label={`Risk score over ${series.length} assessments for vehicle ${vehicleId}, ranging ${Math.min(
            ...series.map((e) => e.risk_score)
          ).toFixed(1)} to ${Math.max(...series.map((e) => e.risk_score)).toFixed(1)} percent.`}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="#1e293b"
                strokeWidth={1}
              />
              <text x={PAD.left - 7} y={y(v) + 3} textAnchor="end" className="fill-slate-600 text-[9px]">
                {v}
              </text>
            </g>
          ))}

          {REFERENCE_LINES.map((t) => (
            <g key={t.level}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(t.min)}
                y2={y(t.min)}
                stroke="#475569"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text x={WIDTH - PAD.right} y={y(t.min) - 4} textAnchor="end" className="fill-slate-600 text-[9px]">
                {t.level}
              </text>
            </g>
          ))}

          {areaPath && <path d={areaPath} fill={LINE_COLOR} fillOpacity={0.1} />}
          <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinejoin="round" />

          {series.map((event, i) => (
            <circle
              key={event.id}
              cx={x(i)}
              cy={y(event.risk_score)}
              r={hovered === i ? 5 : 3}
              fill={LINE_COLOR}
              stroke="#0f172a"
              strokeWidth={1.5}
            />
          ))}

          {/* Hit targets wider than the marks, so hovering is forgiving. */}
          {series.map((event, i) => (
            <rect
              key={`hit-${event.id}`}
              x={x(i) - PLOT_W / (series.length * 2 || 1) - 6}
              y={PAD.top}
              width={PLOT_W / (series.length || 1) + 12}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {active && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-lg">
            <span className="font-semibold tabular-nums text-slate-100">
              {active.risk_score.toFixed(1)}%
            </span>
            <span className="ml-1.5 text-slate-400">{active.risk_level}</span>
            <span className="ml-2 text-slate-600">
              {new Date(active.created_at).toLocaleTimeString()}
            </span>
            <span className="ml-2 text-slate-500">{active.primary_cause}</span>
          </div>
        )}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[0.7rem] text-slate-600 hover:text-slate-400">
          View as table
        </summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-[0.65rem] uppercase tracking-wide text-slate-600">
                <th className="py-1.5 pr-3 font-medium">Time</th>
                <th className="py-1.5 pr-3 font-medium">Risk</th>
                <th className="py-1.5 pr-3 font-medium">Level</th>
                <th className="py-1.5 font-medium">Primary cause</th>
              </tr>
            </thead>
            <tbody className="text-slate-400">
              {series
                .slice()
                .reverse()
                .map((event) => (
                  <tr key={event.id} className="border-t border-slate-800/70">
                    <td className="py-1.5 pr-3 tabular-nums">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums text-slate-200">
                      {event.risk_score.toFixed(1)}
                    </td>
                    <td className="py-1.5 pr-3">{event.risk_level}</td>
                    <td className="py-1.5">{event.primary_cause}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
