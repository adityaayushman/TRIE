"use client";

import { useRiskStream } from "@/lib/useRiskStream";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskTimeline } from "@/components/RiskTimeline";
import { PageHeader } from "@/components/ui";

export default function HistoryPage() {
  const { events, status } = useRiskStream();

  return (
    <div className="space-y-5">
      <PageHeader
        icon="history"
        title="Risk History"
        subtitle="Per-vehicle risk trend against the engine's own thresholds."
        right={<ConnectionBadge status={status} />}
      />
      <RiskTimeline events={events} />
    </div>
  );
}
