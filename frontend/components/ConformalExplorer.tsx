"use client";

import { useState } from "react";

/** Interactive read of ai/trie/conformal_validation.py: every number below is
 * the real result on 128k STATS19 casualties, precomputed across a grid of
 * coverage targets x sensor regimes. Pick a target and a regime; the guarantee
 * (fatal-coverage >= target) always holds, and the alarm-rate cost is what
 * moves — up as you demand more coverage, up as you remove sensors. */

type Cell = { cov: number; alarm: number };
const GRID: Record<number, Record<string, Cell>> = {
  80: { full: { cov: 81.0, alarm: 51.1 }, no_camera: { cov: 81.0, alarm: 54.6 }, telemetry: { cov: 94.8, alarm: 83.5 } },
  90: { full: { cov: 92.8, alarm: 68.3 }, no_camera: { cov: 96.5, alarm: 88.5 }, telemetry: { cov: 94.8, alarm: 83.5 } },
  95: { full: { cov: 99.5, alarm: 94.4 }, no_camera: { cov: 96.5, alarm: 88.5 }, telemetry: { cov: 100.0, alarm: 100.0 } },
};
const TARGETS = [80, 90, 95];
const REGIMES = [
  { key: "full", label: "Full suite", sub: "camera + telemetry + clock" },
  { key: "no_camera", label: "No camera", sub: "telemetry + clock" },
  { key: "telemetry", label: "Telemetry only", sub: "speed" },
];

function Seg<T extends string | number>({
  value, options, onChange, render,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950/50 p-0.5">
      {options.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          className={`rounded-md px-3 py-1.5 text-[0.72rem] font-medium transition ${
            o === value ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function ConformalExplorer() {
  const [target, setTarget] = useState(90);
  const [regime, setRegime] = useState("full");
  const cell = GRID[target][regime];
  const meets = cell.cov >= target - 0.05;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Coverage target</p>
          <Seg value={target} options={TARGETS} onChange={setTarget} render={(t) => `${t}%`} />
        </div>
        <div>
          <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Sensor regime</p>
          <Seg value={regime} options={REGIMES.map((r) => r.key)} onChange={setRegime} render={(k) => REGIMES.find((r) => r.key === k)!.label} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* the guarantee */}
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-400">
            The guarantee {meets ? "holds ✓" : ""}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-300">{cell.cov.toFixed(1)}%</p>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-400">
            of truly <span className="text-slate-200">fatal</span> crashes fall in the &ldquo;cannot
            rule out fatal&rdquo; set — at or above your {target}% target, distribution-free.
          </p>
        </div>
        {/* the cost */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">The cost (alarm rate)</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-200">{cell.alarm.toFixed(1)}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-amber-400/80" style={{ width: `${cell.alarm}%` }} />
          </div>
          <p className="mt-1.5 text-[0.7rem] leading-relaxed text-slate-400">
            of all cases get flagged &ldquo;possibly fatal.&rdquo; It rises as you demand more
            coverage or remove sensors — the price of the guarantee.
          </p>
        </div>
      </div>
      <p className="mt-3 text-[0.7rem] text-slate-400">
        Real STATS19 result across the grid ·{" "}
        <code className="rounded-sm bg-slate-800 px-1 py-0.5 text-[0.65rem] text-slate-400">python -m ai.trie.conformal_validation --alpha {((100 - target) / 100).toFixed(2)}</code>
      </p>
    </div>
  );
}
