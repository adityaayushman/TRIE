"use client";

import { useEffect, useState } from "react";
import { DemoManifestEntry, fetchDemoManifest } from "@/lib/demo";
import { CameraTile } from "@/components/CameraTile";
import { Card, EmptyState, SectionTitle, Stat } from "@/components/ui";

export default function VehicleIntelligencePage() {
  const [clips, setClips] = useState<DemoManifestEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDemoManifest()
      .then(setClips)
      .catch((cause) => setError((cause as Error).message));
  }, []);

  const totalPeak = clips?.reduce((sum, c) => sum + c.peak_vehicle_count, 0) ?? 0;
  const avgCongestion = clips && clips.length > 0
    ? clips.reduce((sum, c) => sum + c.avg_congestion_level, 0) / clips.length
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Vehicle Intelligence</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          The real YOLOv11 perception engine, run on recorded street footage.
        </p>
      </div>

      <Card>
        <SectionTitle hint="research demo, not a live camera">What this is</SectionTitle>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
          The deployed API has no camera attached, so there is nothing live to point a
          Vehicle Intelligence page at. There is, however, a real perception model
          (<span className="font-mono text-slate-500">ai/perception</span>, YOLOv11,
          COCO-pretrained) that has never had anywhere to run in production. This page
          runs that same model, frame by frame, over real licensed street-traffic
          recordings, and replays the detections in sync with the footage —
          genuine model output on real video, not fabricated numbers. Each tile is
          labelled &quot;Rec&quot; because it is a recording, not a live feed.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 sm:grid-cols-3">
          <Stat label="Feeds" value={clips?.length ?? "—"} />
          <Stat label="Peak road users seen" value={clips ? totalPeak : "—"} title="Sum of each feed's peak simultaneous vehicles/two-wheelers" />
          <Stat label="Avg congestion" value={clips ? `${(avgCongestion * 100).toFixed(0)}` : "—"} unit="%" />
        </div>
      </Card>

      {error ? (
        <EmptyState title="Could not load the demo feeds" body={error} />
      ) : clips === null ? (
        <EmptyState title="Loading recorded feeds…" body="Fetching clip manifest and detections." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <CameraTile key={clip.name} clip={clip} />
          ))}
        </div>
      )}
    </div>
  );
}
