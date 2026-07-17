"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DemoManifestEntry, fetchDemoManifest } from "@/lib/demo";
import { BOX_COLOR, CameraTile, LiveCounts } from "@/components/CameraTile";
import { Card, EmptyState, Legend, SectionTitle, Stat } from "@/components/ui";

const LEGEND_ITEMS = [
  { color: BOX_COLOR.vehicle, label: "Vehicle" },
  { color: BOX_COLOR.two_wheeler, label: "Two-wheeler" },
  { color: BOX_COLOR.pedestrian, label: "Pedestrian" },
];

export default function VehicleIntelligencePage() {
  const [clips, setClips] = useState<DemoManifestEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveByClip, setLiveByClip] = useState<Record<string, LiveCounts>>({});

  useEffect(() => {
    fetchDemoManifest()
      .then(setClips)
      .catch((cause) => setError((cause as Error).message));
  }, []);

  const handleLiveUpdate = useCallback((name: string, counts: LiveCounts) => {
    setLiveByClip((prev) => ({ ...prev, [name]: counts }));
  }, []);

  const live = useMemo(() => {
    const values = Object.values(liveByClip);
    if (values.length === 0) return null;
    return {
      vehicles: values.reduce((sum, v) => sum + v.vehicles, 0),
      twoWheelers: values.reduce((sum, v) => sum + v.twoWheelers, 0),
      pedestrians: values.reduce((sum, v) => sum + v.pedestrians, 0),
      avgCongestion: values.reduce((sum, v) => sum + v.congestion, 0) / values.length,
    };
  }, [liveByClip]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Vehicle Intelligence</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            The real YOLOv11 perception engine, run on recorded street footage.
          </p>
        </div>
        {clips && clips.length > 0 && (
          <span className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {clips.length} feeds monitoring
          </span>
        )}
      </div>

      <Card className="bg-gradient-to-br from-sky-950/40 via-slate-900/80 to-slate-900/60">
        <SectionTitle hint="combined across every feed below, updating as they play">
          Live now
        </SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Vehicles" value={live?.vehicles ?? 0} size="lg" accent="sky" live />
          <Stat label="Two-wheelers" value={live?.twoWheelers ?? 0} size="lg" accent="amber" live />
          <Stat label="Pedestrians" value={live?.pedestrians ?? 0} size="lg" accent="red" live />
          <Stat
            label="Avg congestion"
            value={live ? Math.round(live.avgCongestion * 100) : 0}
            unit="%"
            size="lg"
            accent="emerald"
            live
          />
        </div>
      </Card>

      <Card delay={0.05}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <SectionTitle hint="research demo, not a live camera">What this is</SectionTitle>
          <Legend items={LEGEND_ITEMS} />
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
          The deployed API has no camera attached, so there is nothing live to point a
          Vehicle Intelligence page at. There is, however, a real perception model
          (<span className="font-mono text-slate-500">ai/perception</span>, YOLOv11,
          COCO-pretrained) that has never had anywhere to run in production. This page
          runs that same model, frame by frame, over real licensed street-traffic
          recordings, and replays the detections in sync with the footage — genuine
          model output on real video, not fabricated numbers. Each tile is labelled
          &quot;Rec&quot; because it is a recording, not a live feed.
        </p>
      </Card>

      {error ? (
        <EmptyState title="Could not load the demo feeds" body={error} />
      ) : clips === null ? (
        <EmptyState title="Loading recorded feeds…" body="Fetching clip manifest and detections." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <CameraTile key={clip.name} clip={clip} onLiveUpdate={handleLiveUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
