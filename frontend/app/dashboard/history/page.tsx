"use client";

import { useRiskStream } from "@/lib/useRiskStream";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskTimeline } from "@/components/RiskTimeline";

export default function HistoryPage() {
  const { events, status } = useRiskStream();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Risk History</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Per-vehicle risk trend against the engine&apos;s own thresholds.
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>
      <RiskTimeline events={events} />
    </div>
  );
}
