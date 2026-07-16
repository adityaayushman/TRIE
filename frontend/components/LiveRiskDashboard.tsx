"use client";

import { API_URL } from "@/lib/api";
import { StreamStatus, useRiskStream } from "@/lib/useRiskStream";
import { RiskDashboard } from "./RiskDashboard";

const STATUS_LABEL: Record<StreamStatus, string> = {
  loading: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  error: "Offline",
};

const STATUS_COLOR: Record<StreamStatus, string> = {
  loading: "bg-slate-500",
  live: "bg-emerald-400",
  reconnecting: "bg-amber-400",
  error: "bg-red-500",
};

function ConnectionBadge({ status }: { status: StreamStatus }) {
  return (
    <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
      <span
        className={`h-2 w-2 rounded-full ${STATUS_COLOR[status]} ${
          status === "live" ? "animate-pulse" : ""
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-lg font-semibold text-slate-100">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
      </div>
    </div>
  );
}

export function LiveRiskDashboard() {
  const { snapshot, status, error } = useRiskStream();

  return (
    <>
      <div className="flex justify-end px-8 pt-4">
        <ConnectionBadge status={status} />
      </div>

      {snapshot ? (
        <RiskDashboard assessment={snapshot} />
      ) : error ? (
        <Notice
          title="Cannot reach the backend"
          body={`${error}. Check that the API is running at ${API_URL}.`}
        />
      ) : (
        <Notice
          title="Waiting for the first assessment"
          body="No risk events recorded yet. POST to /risk/assess and this dashboard will update live."
        />
      )}
    </>
  );
}
