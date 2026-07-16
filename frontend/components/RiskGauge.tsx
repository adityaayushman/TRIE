"use client";

import { motion } from "framer-motion";
import { RiskLevel } from "@/lib/types";

const COLOR_BY_LEVEL: Record<RiskLevel, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = COLOR_BY_LEVEL[level];

  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={radius} stroke="#1e293b" strokeWidth="16" fill="none" />
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
      </div>
    </div>
  );
}
