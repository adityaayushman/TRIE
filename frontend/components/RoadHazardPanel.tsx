"use client";

import { Snapshot, hasLiveDetail } from "@/lib/types";
import { Badge, Card, SectionTitle, Stat } from "./ui";

/** ai/road_intelligence/ output. Live-only: potholes/cracks/waterlogging ride
 * the websocket payload but are not persisted, so a page seeded from
 * GET /risk/events has none until the first broadcast arrives. */
export function RoadHazardPanel({ snapshot }: { snapshot: Snapshot }) {
  const live = hasLiveDetail(snapshot) ? snapshot : null;

  if (!live) return null;

  const { potholes, cracks, is_waterlogged, surface_quality_score } = live;
  const hasHazards = potholes.length > 0 || cracks.length > 0 || is_waterlogged;

  return (
    <Card delay={0.2}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <SectionTitle hint="classical CV, not a learned detector">
          Road Surface
        </SectionTitle>
        <div className="mb-3">
          <Stat label="Quality" value={(surface_quality_score * 100).toFixed(0)} unit="%" />
        </div>
      </div>

      {hasHazards ? (
        <ul className="flex flex-wrap gap-1.5">
          {potholes.map((pothole, index) => (
            <li key={`pothole-${index}`}>
              <Badge tone="danger">Pothole {Math.round(pothole.confidence * 100)}%</Badge>
            </li>
          ))}
          {cracks.map((crack, index) => (
            <li key={`crack-${index}`}>
              <Badge tone="warn">Crack {Math.round(crack.confidence * 100)}%</Badge>
            </li>
          ))}
          {is_waterlogged && (
            <li>
              <Badge tone="engineering">Waterlogged</Badge>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">
          No surface hazards detected. With no camera attached to the JSON API there is no
          image to inspect, so this reports a clean surface — the edge pipeline
          (<span className="font-mono text-slate-600">ai/cli.py</span>) is where real frames
          are analysed.
        </p>
      )}
    </Card>
  );
}
