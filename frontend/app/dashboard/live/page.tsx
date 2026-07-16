"use client";

import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRiskStream } from "@/lib/useRiskStream";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskDashboard } from "@/components/RiskDashboard";
import { TelemetryControls } from "@/components/TelemetryControls";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

export default function LivePage() {
  const { snapshot, status, error, refresh } = useRiskStream();
  const { account } = useAuth();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Live Risk</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Real-time fusion, causal attribution and forecast over the websocket.
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {account ? (
        <TelemetryControls onAssessed={refresh} />
      ) : (
        <EmptyState
          title="Sign in to run an assessment"
          body="Reading the dashboard is open to everyone. Submitting telemetry writes to a shared database, so it needs an account."
        />
      )}

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
          body="No risk events recorded yet. Once an assessment is run, this updates live."
        />
      )}

      {!account && (
        <p className="text-center text-xs text-slate-600">
          <Link href="/register" className="text-sky-400 hover:text-sky-300">
            Create an account
          </Link>{" "}
          to submit telemetry.
        </p>
      )}
    </div>
  );
}
