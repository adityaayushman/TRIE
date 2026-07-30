"use client";

import { BlackSpotPanel } from "@/components/BlackSpotPanel";
import { PageHeader } from "@/components/ui";

export default function BlackSpotsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="blackspots"
        title="Black-Spot Intelligence"
        subtitle="Dangerous stretches nominated from near-misses, before a crash record exists."
      />
      <BlackSpotPanel />
    </div>
  );
}
