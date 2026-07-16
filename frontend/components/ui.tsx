"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/** Shared primitives. Every panel composes these rather than repeating raw
 * utility strings, so spacing, surface and type scale stay consistent as
 * panels are added. */

export function Card({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6 backdrop-blur ${className}`}
    >
      {children}
    </motion.section>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {children}
      {hint && (
        <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-600">
          {hint}
        </span>
      )}
    </h2>
  );
}

/** A single figure with its label. `muted` marks a value the backend could
 * not compute — rendered as an em dash rather than a zero, because "unknown"
 * and "zero" are different claims. */
export function Stat({
  label,
  value,
  unit,
  muted = false,
  title,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  muted?: boolean;
  title?: string;
}) {
  return (
    <div title={title}>
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${muted ? "text-slate-600" : "text-slate-100"}`}>
        {value === null ? "—" : value}
        {value !== null && unit && (
          <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>
        )}
      </p>
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-slate-800 text-slate-300 ring-slate-700",
  engineering: "bg-sky-950 text-sky-300 ring-sky-900",
  enforcement: "bg-amber-950 text-amber-300 ring-amber-900",
  education: "bg-violet-950 text-violet-300 ring-violet-900",
  danger: "bg-red-950 text-red-300 ring-red-900",
  warn: "bg-amber-950 text-amber-300 ring-amber-900",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}
