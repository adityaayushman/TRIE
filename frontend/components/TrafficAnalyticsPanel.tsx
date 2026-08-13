"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DemoClipData, DemoFrame, DemoManifestEntry, fetchDemoClip, fetchDemoManifest } from "@/lib/demo";
import { BOX_COLOR } from "./CameraTile";
import { Card, EmptyState, Legend, SectionTitle, Stat } from "./ui";

const WIDTH = 760;
// Two stacked plots sharing one x-axis (never one plot with two y-scales): road-
// user counts on top, the 0–100% congestion index in its own strip below. This
// is the dual-axis fix — counts and a 0–1 index have no common scale.
const PAD = { left: 38, right: 58, top: 12 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const COUNTS_TOP = 12;
const COUNTS_H = 150;
const CONG_TOP = 196;
const CONG_H = 58;
const HEIGHT = 286;

// Congestion is a magnitude in its own strip (a lone series), so one hue; the
// three count series use the shared, CVD-validated categorical palette.
const CONGESTION_COLOR = "#a78bfa";

const LEGEND_ITEMS = [
  { color: BOX_COLOR.vehicle, label: "Vehicles" },
  { color: BOX_COLOR.two_wheeler, label: "Two-wheelers" },
  { color: BOX_COLOR.pedestrian, label: "Pedestrians" },
  { color: CONGESTION_COLOR, label: "Congestion index" },
];

/** Quadratic-through-midpoints smoothing -- cheap, dependency-free, and
 * visually close enough to a real spline for a handful of samples/sec. */
function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    d += ` Q${px},${py} ${(px + cx) / 2},${(py + cy) / 2}`;
  }
  const [lx, ly] = points[points.length - 1];
  d += ` L${lx},${ly}`;
  return d;
}

function usersOf(f: DemoFrame) {
  return f.vehicles.length + f.two_wheelers.length + f.pedestrians.length;
}

function FlowChart({ data }: { data: DemoClipData }) {
  const frames = data.frames;
  const [hi, setHi] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const maxCount = Math.max(1, ...frames.map(usersOf));
  const x = (t: number) => PAD.left + (data.duration_s ? (t / data.duration_s) * PLOT_W : 0);
  const yCount = (c: number) => COUNTS_TOP + COUNTS_H - (c / maxCount) * COUNTS_H;
  const yCong = (l: number) => CONG_TOP + CONG_H - Math.max(0, Math.min(1, l)) * CONG_H;

  const series = [
    { key: "veh", color: BOX_COLOR.vehicle, w: 2.5, get: (f: DemoFrame) => f.vehicles.length },
    { key: "2w", color: BOX_COLOR.two_wheeler, w: 2, get: (f: DemoFrame) => f.two_wheelers.length },
    { key: "ped", color: BOX_COLOR.pedestrian, w: 2, get: (f: DemoFrame) => f.pedestrians.length },
  ];

  const areaPath =
    frames.length > 1
      ? `${smoothPath(frames.map((f) => [x(f.t), yCount(f.vehicles.length)]))} L${x(data.duration_s)},${yCount(0)} L${x(0)},${yCount(0)} Z`
      : "";
  const congPath = smoothPath(frames.map((f) => [x(f.t), yCong(f.traffic.congestion_level)]));
  const congArea =
    frames.length > 1
      ? `${congPath} L${x(data.duration_s)},${yCong(0)} L${x(0)},${yCong(0)} Z`
      : "";

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg || frames.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const frac = Math.max(0, Math.min(1, (px - PAD.left) / PLOT_W));
    setHi(Math.round(frac * (frames.length - 1)));
  };

  const active = hi !== null ? frames[hi] : null;
  const gridColor = "#1e293b";

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full min-w-[480px] touch-none"
        role="img"
        aria-label="Road-user counts and congestion index over the clip duration"
        onMouseMove={onMove}
        onMouseLeave={() => setHi(null)}
      >
        <defs>
          <linearGradient id="flow-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BOX_COLOR.vehicle} stopOpacity={0.22} />
            <stop offset="100%" stopColor={BOX_COLOR.vehicle} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cong-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CONGESTION_COLOR} stopOpacity={0.3} />
            <stop offset="100%" stopColor={CONGESTION_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* counts grid + y labels */}
        {[0, 0.5, 1].map((f) => {
          const val = Math.round(maxCount * f);
          return (
            <g key={`cg${f}`}>
              <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={yCount(val)} y2={yCount(val)} stroke={gridColor} strokeWidth={1} />
              <text x={PAD.left - 7} y={yCount(val) + 3} textAnchor="end" className="fill-slate-600 text-[9px] tabular-nums">{val}</text>
            </g>
          );
        })}
        <text x={PAD.left - 7} y={COUNTS_TOP - 2} textAnchor="end" className="fill-slate-500 text-[8px] uppercase tracking-wide">road users</text>

        {areaPath && <path d={areaPath} fill="url(#flow-area)" stroke="none" />}
        {series.map((s) => (
          <path key={s.key} d={smoothPath(frames.map((f) => [x(f.t), yCount(s.get(f))]))} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* direct end-labels (in addition to the legend) */}
        {frames.length > 0 && series.map((s) => (
          <text key={`lbl${s.key}`} x={PAD.left + PLOT_W + 5} y={yCount(s.get(frames[frames.length - 1])) + 3} className="text-[8.5px] font-semibold tabular-nums" fill={s.color}>
            {s.get(frames[frames.length - 1])}
          </text>
        ))}

        {/* congestion strip */}
        <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={yCong(0)} y2={yCong(0)} stroke={gridColor} strokeWidth={1} />
        {congArea && <path d={congArea} fill="url(#cong-area)" stroke="none" />}
        <path d={congPath} fill="none" stroke={CONGESTION_COLOR} strokeWidth={2} strokeLinejoin="round" />
        <text x={PAD.left - 7} y={CONG_TOP + 4} textAnchor="end" className="fill-slate-500 text-[8px] uppercase tracking-wide">100%</text>
        <text x={PAD.left - 7} y={yCong(0) + 3} textAnchor="end" className="fill-slate-600 text-[9px]">0</text>
        <text x={PAD.left + PLOT_W + 5} y={yCong(frames.length ? frames[frames.length - 1].traffic.congestion_level : 0) + 3} className="text-[8.5px] font-semibold tabular-nums" fill={CONGESTION_COLOR}>
          {frames.length ? Math.round(frames[frames.length - 1].traffic.congestion_level * 100) : 0}%
        </text>

        {/* x axis */}
        <text x={PAD.left} y={HEIGHT - 4} className="fill-slate-600 text-[9px]">0s</text>
        <text x={PAD.left + PLOT_W} y={HEIGHT - 4} textAnchor="end" className="fill-slate-600 text-[9px]">{data.duration_s.toFixed(0)}s</text>

        {/* crosshair + markers */}
        {active && (
          <g pointerEvents="none">
            <line x1={x(active.t)} x2={x(active.t)} y1={COUNTS_TOP} y2={yCong(0)} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={`m${s.key}`} cx={x(active.t)} cy={yCount(s.get(active))} r={3.5} fill={s.color} stroke="#0b1220" strokeWidth={1.5} />
            ))}
            <circle cx={x(active.t)} cy={yCong(active.traffic.congestion_level)} r={3.5} fill={CONGESTION_COLOR} stroke="#0b1220" strokeWidth={1.5} />
          </g>
        )}
      </svg>

      {active && (
        <div className="pointer-events-none absolute right-2 top-1 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-[0.7rem] shadow-lg">
          <p className="mb-1 tabular-nums text-slate-500">{active.t.toFixed(1)}s</p>
          <div className="space-y-0.5">
            {[
              { c: BOX_COLOR.vehicle, l: "Vehicles", v: active.vehicles.length },
              { c: BOX_COLOR.two_wheeler, l: "Two-wheelers", v: active.two_wheelers.length },
              { c: BOX_COLOR.pedestrian, l: "Pedestrians", v: active.pedestrians.length },
            ].map((r) => (
              <p key={r.l} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.c }} />
                <span className="text-slate-400">{r.l}</span>
                <span className="ml-auto pl-3 font-semibold tabular-nums text-slate-100">{r.v}</span>
              </p>
            ))}
            <p className="flex items-center gap-1.5 border-t border-slate-800 pt-0.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CONGESTION_COLOR }} />
              <span className="text-slate-400">Congestion</span>
              <span className="ml-auto pl-3 font-semibold tabular-nums text-slate-100">{Math.round(active.traffic.congestion_level * 100)}%</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrafficAnalyticsPanel() {
  const [clips, setClips] = useState<DemoManifestEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<DemoClipData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const manifest = await fetchDemoManifest();
        setClips(manifest);
        if (manifest.length > 0) setSelected(manifest[0].name);
      } catch (cause) {
        setError((cause as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!clips || !selected) return;
    const clip = clips.find((c) => c.name === selected);
    if (!clip) return;
    setData(null);
    fetchDemoClip(clip.detections).then(setData).catch((cause) => setError((cause as Error).message));
  }, [clips, selected]);

  const activeClip = useMemo(() => clips?.find((c) => c.name === selected) ?? null, [clips, selected]);

  if (error) return <EmptyState title="Could not load traffic data" body={error} />;
  if (clips === null) return <EmptyState title="Loading recorded feeds…" body="Fetching clip manifest." />;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle hint="per-class flow and congestion, from recorded footage">Flow over time</SectionTitle>
        <div className="mb-3 flex gap-1.5">
          {clips.map((clip) => (
            <button
              key={clip.name}
              onClick={() => setSelected(clip.name)}
              className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-medium transition ${
                selected === clip.name ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {clip.title.split(",")[0]}
            </button>
          ))}
        </div>
      </div>

      {data ? (
        <>
          <FlowChart data={data} />
          <div className="mt-3">
            <Legend items={LEGEND_ITEMS} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-800 pt-4">
            <Stat label="Peak vehicles" value={data.peak_vehicle_count} accent="sky" />
            <Stat label="Avg congestion" value={(data.avg_congestion_level * 100).toFixed(0)} unit="%" accent="emerald" />
            <Stat label="Duration" value={data.duration_s.toFixed(0)} unit="s" />
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">Loading {activeClip?.title}…</p>
      )}
    </Card>
  );
}
