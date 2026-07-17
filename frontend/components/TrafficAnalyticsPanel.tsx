"use client";

import { useEffect, useMemo, useState } from "react";
import { DemoClipData, DemoManifestEntry, fetchDemoClip, fetchDemoManifest } from "@/lib/demo";
import { BOX_COLOR } from "./CameraTile";
import { Card, EmptyState, Legend, SectionTitle, Stat } from "./ui";

const WIDTH = 760;
const HEIGHT = 240;
const PAD = { left: 34, right: 14, top: 14, bottom: 24 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

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
    const midX = (px + cx) / 2;
    const midY = (py + cy) / 2;
    d += ` Q${px},${py} ${midX},${midY}`;
  }
  const [lx, ly] = points[points.length - 1];
  d += ` L${lx},${ly}`;
  return d;
}

function LineChart({ data }: { data: DemoClipData }) {
  const frames = data.frames;
  const maxCount = Math.max(1, ...frames.map((f) => f.vehicles.length + f.two_wheelers.length + f.pedestrians.length));

  const x = (t: number) => PAD.left + (t / data.duration_s) * PLOT_W;
  const yCount = (count: number) => PAD.top + PLOT_H - (count / maxCount) * PLOT_H;
  const yCongestion = (level: number) => PAD.top + PLOT_H - level * PLOT_H;

  const vehiclePath = smoothPath(frames.map((f) => [x(f.t), yCount(f.vehicles.length)]));
  const twoWheelerPath = smoothPath(frames.map((f) => [x(f.t), yCount(f.two_wheelers.length)]));
  const pedestrianPath = smoothPath(frames.map((f) => [x(f.t), yCount(f.pedestrians.length)]));
  const congestionPath = smoothPath(frames.map((f) => [x(f.t), yCongestion(f.traffic.congestion_level)]));

  const areaPath = frames.length > 1
    ? `${vehiclePath} L${x(data.duration_s)},${yCount(0)} L${x(0)},${yCount(0)} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[480px]" role="img" aria-label="Vehicle, two-wheeler and pedestrian count, and congestion, over the clip's duration">
      <defs>
        <linearGradient id="traffic-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BOX_COLOR.vehicle} stopOpacity={0.25} />
          <stop offset="100%" stopColor={BOX_COLOR.vehicle} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line key={frac} x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + PLOT_H * frac} y2={PAD.top + PLOT_H * frac} stroke="#1e293b" strokeWidth={1} />
      ))}
      {areaPath && <path d={areaPath} fill="url(#traffic-area)" stroke="none" />}
      <path d={pedestrianPath} fill="none" stroke={BOX_COLOR.pedestrian} strokeWidth={1.5} strokeLinejoin="round" opacity={0.85} />
      <path d={twoWheelerPath} fill="none" stroke={BOX_COLOR.two_wheeler} strokeWidth={1.5} strokeLinejoin="round" opacity={0.85} />
      <path d={vehiclePath} fill="none" stroke={BOX_COLOR.vehicle} strokeWidth={2.5} strokeLinejoin="round" />
      <path d={congestionPath} fill="none" stroke={CONGESTION_COLOR} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
      <text x={PAD.left} y={HEIGHT - 6} className="fill-slate-600 text-[9px]">0s</text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" className="fill-slate-600 text-[9px]">{data.duration_s.toFixed(0)}s</text>
    </svg>
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
          <LineChart data={data} />
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
