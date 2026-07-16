"use client";

import { BlackSpotPanel } from "@/components/BlackSpotPanel";

export default function BlackSpotsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Black-Spot Intelligence</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Dangerous stretches nominated from near-misses, before a crash record exists.
        </p>
      </div>
      <BlackSpotPanel />
    </div>
  );
}
