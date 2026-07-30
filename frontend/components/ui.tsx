"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ReactNode } from "react";
import { ICONS, IconName } from "./icons";

/** The unified dashboard page header: an icon chip, a gradient title, a
 * subtitle, and an optional right-hand slot (e.g. the connection badge). Every
 * dashboard page uses this, so headers read as one system. */
export function PageHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const Icon = ICONS[icon];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300">
          <Icon size={18} />
        </span>
        <div>
          <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 pt-1">{right}</div>}
    </div>
  );
}

/** Shared primitives. Every panel composes these rather than repeating raw
 * utility strings, so spacing, surface and type scale stay consistent as
 * panels are added. */

export function Card({
  children,
  className = "",
  delay = 0,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  interactive?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={interactive ? { y: -2, borderColor: "rgba(100,116,139,0.5)" } : undefined}
      className={`rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-900/60 p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur transition-colors ${className}`}
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

const ACCENT_COLORS: Record<string, string> = {
  sky: "#38bdf8",
  amber: "#f59e0b",
  red: "#f87171",
  emerald: "#34d399",
};

/** A single figure with its label. `muted` marks a value the backend could
 * not compute — rendered as an em dash rather than a zero, because "unknown"
 * and "zero" are different claims. `live` cross-fades on value change instead
 * of snapping, so a ticking counter reads as alive rather than glitchy. */
export function Stat({
  label,
  value,
  unit,
  muted = false,
  title,
  size = "md",
  accent,
  live = false,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  muted?: boolean;
  title?: string;
  size?: "md" | "lg";
  accent?: keyof typeof ACCENT_COLORS;
  live?: boolean;
}) {
  const valueSize = size === "lg" ? "text-3xl" : "text-xl";
  return (
    <div title={title} className="relative pl-3">
      {accent && (
        <span
          className="absolute left-0 top-0.5 h-[calc(100%-0.35rem)] w-0.5 rounded-full"
          style={{ backgroundColor: ACCENT_COLORS[accent] }}
        />
      )}
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 ${valueSize} font-semibold tabular-nums ${muted ? "text-slate-600" : "text-slate-100"}`}>
        {live ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={String(value)}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="inline-block"
            >
              {value === null ? "—" : value}
            </motion.span>
          </AnimatePresence>
        ) : value === null ? (
          "—"
        ) : (
          value
        )}
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

/** Colour-coded key for anything rendering class-coded marks (detection
 * boxes, chart series) elsewhere on the page — so a colour never has to be
 * memorised or guessed from the code. */
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4 text-[0.7rem] text-slate-500">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
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
