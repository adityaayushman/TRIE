"use client";

import { TrafficAnalyticsPanel } from "@/components/TrafficAnalyticsPanel";
import { Card, PageHeader, SectionTitle } from "@/components/ui";

export default function TrafficAnalyticsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="traffic"
        title="Traffic Analytics"
        subtitle="Congestion, density and flow, derived from real perception on recorded footage."
      />

      <Card>
        <SectionTitle hint="same engine, aggregated">What this is</SectionTitle>
        <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
          <span className="font-mono text-slate-500">ai/traffic_intelligence</span> derives
          congestion, density and vehicle count from the perception engine&apos;s detections —
          two-wheelers count as road users here, unlike car-only Western traffic models, since
          a lane full of motorcycles reads as congested and dangerous even when no car is
          present. Run on the same recorded clips as Vehicle Intelligence, not a live feed.
        </p>
      </Card>

      <TrafficAnalyticsPanel />
    </div>
  );
}
