"use client";

import { useEffect, useMemo, useState } from "react";
import { DemoClipData, DemoManifestEntry, fetchDemoClip, fetchDemoManifest } from "@/lib/demo";
import { Card, EmptyState, SectionTitle, Stat } from "./ui";

const WIDTH = 760;
const HEIGHT = 220;
const PAD = { left: 34, right: 14, top: 12, bottom: 24 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

function LineChart({ data }: { data: DemoClipData }) {
  const frames = data.frames;
  const maxCount = Math.max(1, ...frames.map((f) => f.traffic.vehicle_count));

  const x = (t: number) => PAD.left + (t / data.duration_s) * PLOT_W;
  const yCount = (count: number) => PAD.top + PLOT_H - (count / maxCount) * PLOT_H;
  const yCongestion = (level: number) => PAD.top + PLOT_H - level * PLOT_H;

  const countPath = frames.map((f, i) => `${i === 0 ? "M" : "L"}${x(f.t)},${yCount(f.traffic.vehicle_count)}`).join(" ");
  const congestionPath = frames.map((f, i) => `${i === 0 ? "M" : "L"}${x(f.t)},${yCongestion(f.traffic.congestion_level)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[480px]" role="img" aria-label="Vehicle count and congestion over the clip's duration">
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line key={frac} x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + PLOT_H * frac} y2={PAD.top + PLOT_H * frac} stroke="#1e293b" strokeWidth={1} />
      ))}
      <path d={countPath} fill="none" stroke="#3987e5" strokeWidth={2} strokeLinejoin="round" />
      <path d={congestionPath} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" strokeLinejoin="round" />
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
        <SectionTitle hint="vehicle count and congestion, from recorded footage">Flow over time</SectionTitle>
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
          <div className="mt-3 flex items-center gap-4 text-[0.7rem] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Vehicle count</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Congestion index</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-800 pt-4">
            <Stat label="Peak vehicles" value={data.peak_vehicle_count} />
            <Stat label="Avg congestion" value={(data.avg_congestion_level * 100).toFixed(0)} unit="%" />
            <Stat label="Duration" value={data.duration_s.toFixed(0)} unit="s" />
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">Loading {activeClip?.title}…</p>
      )}
    </Card>
  );
}
