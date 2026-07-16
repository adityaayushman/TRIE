"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";
import { StreamStatus, useRiskStream } from "@/lib/useRiskStream";
import { BlackSpotPanel } from "./BlackSpotPanel";
import { RiskDashboard } from "./RiskDashboard";
import { RiskTimeline } from "./RiskTimeline";
import { TelemetryControls } from "./TelemetryControls";
import { EmptyState } from "./ui";

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

const TABS = [
  { id: "live", label: "Live Risk" },
  { id: "history", label: "Risk History" },
  { id: "blackspots", label: "Black Spots" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ConnectionBadge({ status }: { status: StreamStatus }) {
  return (
    <span className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
      <span
        className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]} ${
          status === "live" ? "animate-pulse" : ""
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function LiveRiskDashboard() {
  const { snapshot, events, status, error, refresh } = useRiskStream();
  const [tab, setTab] = useState<TabId>("live");

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16">
      <div className="sticky top-0 z-10 -mx-5 mb-5 border-b border-slate-800/80 bg-slate-950/85 px-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <nav className="flex gap-1" role="tablist">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  tab === id
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <ConnectionBadge status={status} />
        </div>
      </div>

      {tab === "live" && (
        <div className="space-y-5">
          <TelemetryControls onAssessed={refresh} />
          {snapshot ? (
            <RiskDashboard assessment={snapshot} />
          ) : error ? (
            <EmptyState
              title="Cannot reach the backend"
              body={`${error}. The API at ${API_URL} may be waking from idle — a free-tier instance sleeps after inactivity and can take ~50s on the first request.`}
            />
          ) : (
            <EmptyState
              title="Waiting for the first assessment"
              body="No risk events recorded yet. Run an assessment above and this dashboard updates live over the websocket."
            />
          )}
        </div>
      )}

      {tab === "history" && <RiskTimeline events={events} />}

      {tab === "blackspots" && <BlackSpotPanel />}
    </div>
  );
}
