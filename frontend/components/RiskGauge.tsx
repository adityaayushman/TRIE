"use client";

import { motion } from "framer-motion";
import { RiskLevel } from "@/lib/types";

const COLOR_BY_LEVEL: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};
// A lighter tint per level for the arc gradient's leading edge, so the ring
// reads with depth rather than as a flat stroke.
const TINT_BY_LEVEL: Record<RiskLevel, string> = {
  low: "#86efac",
  moderate: "#fde047",
  high: "#fdba74",
  critical: "#fca5a5",
};

/** Radial risk gauge with an optional uncertainty band.
 *
 * `lower`/`upper` bound the score given unmeasured factors (see
 * ai/trie/risk_fusion.py). When they straddle the score the ring shows a faint
 * band from lower→upper behind the solid 0→score arc, so "the true value is
 * somewhere in here" is visible, not just a falsely precise point. Omit them
 * (or pass an equal pair) and the gauge renders exactly as before — persisted
 * history events carry no band. */
export function RiskGauge({
  score,
  level,
  lower,
  upper,
}: {
  score: number;
  level: RiskLevel;
  lower?: number;
  upper?: number;
}) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = COLOR_BY_LEVEL[level];
  const tint = TINT_BY_LEVEL[level];

  const hasBand =
    lower !== undefined && upper !== undefined && upper - lower > 0.5;
  const bandDash = hasBand
    ? `${((upper! - lower!) / 100) * circumference} ${circumference}`
    : undefined;
  const bandOffset = hasBand ? -(lower! / 100) * circumference : undefined;
  const width = hasBand ? Math.round(upper! - lower!) : 0;
  const confidence = width >= 30 ? "low confidence" : width >= 12 ? "moderate confidence" : "high confidence";

  // 20 ticks around the ring (every 5%), brighter at the quarter marks — a
  // precision cue that lifts the gauge from a plain donut to an instrument.
  const ticks = Array.from({ length: 20 }, (_, i) => i);

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      {/* soft ambient halo under the ring, tinted by level */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-40 w-40 rounded-full blur-2xl"
        style={{ background: color, opacity: 0.14 }}
      />
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        <defs>
          <linearGradient id={`arc-${level}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={tint} />
          </linearGradient>
          <filter id="arc-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* tick ring */}
        {ticks.map((i) => {
          const a = (i / 20) * 2 * Math.PI;
          const outer = 96;
          const inner = i % 5 === 0 ? 88 : 91;
          return (
            <line
              key={i}
              x1={100 + outer * Math.cos(a)}
              y1={100 + outer * Math.sin(a)}
              x2={100 + inner * Math.cos(a)}
              y2={100 + inner * Math.sin(a)}
              stroke={i % 5 === 0 ? "#475569" : "#334155"}
              strokeWidth={i % 5 === 0 ? 1.5 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* track */}
        <circle cx="100" cy="100" r={radius} stroke="#1e293b" strokeWidth="14" fill="none" />

        {/* uncertainty band: faint arc from lower→upper, drawn behind the score */}
        {hasBand && (
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke={color}
            strokeOpacity={0.26}
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={bandDash}
            strokeDashoffset={bandOffset}
          />
        )}

        <motion.circle
          cx="100"
          cy="100"
          r={radius}
          stroke={`url(#arc-${level})`}
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          filter="url(#arc-glow)"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>
          {score}%
        </span>
        <span className="text-sm uppercase tracking-wide text-slate-400">{level}</span>
        {hasBand && (
          <span className="mt-1.5 text-center text-[0.65rem] leading-tight text-slate-500">
            <span className="tabular-nums text-slate-400">{lower!.toFixed(0)}–{upper!.toFixed(0)}%</span>
            <br />
            {confidence}
          </span>
        )}
      </div>
    </div>
  );
}
