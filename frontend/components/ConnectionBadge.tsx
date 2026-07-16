"use client";

import { StreamStatus } from "@/lib/useRiskStream";

const LABEL: Record<StreamStatus, string> = {
  loading: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  error: "Offline",
};

const COLOR: Record<StreamStatus, string> = {
  loading: "bg-slate-500",
  live: "bg-emerald-400",
  reconnecting: "bg-amber-400",
  error: "bg-red-500",
};

export function ConnectionBadge({ status }: { status: StreamStatus }) {
  return (
    <span className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
      <span
        className={`h-1.5 w-1.5 rounded-full ${COLOR[status]} ${
          status === "live" ? "animate-pulse" : ""
        }`}
      />
      {LABEL[status]}
    </span>
  );
}
