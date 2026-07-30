"use client";

import { motion } from "framer-motion";
import { RiskLevel } from "@/lib/types";

const COLOR_BY_LEVEL: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
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

  const hasBand =
    lower !== undefined && upper !== undefined && upper - lower > 0.5;
  const bandDash = hasBand
    ? `${((upper! - lower!) / 100) * circumference} ${circumference}`
    : undefined;
  const bandOffset = hasBand ? -(lower! / 100) * circumference : undefined;
  const width = hasBand ? Math.round(upper! - lower!) : 0;
  const confidence = width >= 30 ? "low confidence" : width >= 12 ? "moderate confidence" : "high confidence";

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} stroke="#1e293b" strokeWidth="16" fill="none" />

        {/* uncertainty band: faint arc from lower→upper, drawn behind the score */}
        {hasBand && (
          <circle
            cx="100"
            cy="100"
            r={radius}
            stroke={color}
            strokeOpacity={0.28}
            strokeWidth="16"
            fill="none"
            strokeDasharray={bandDash}
            strokeDashoffset={bandOffset}
          />
        )}

        <motion.circle
          cx="100"
          cy="100"
          r={radius}
          stroke={color}
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold" style={{ color }}>
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
