"use client";

import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRiskStream } from "@/lib/useRiskStream";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskDashboard } from "@/components/RiskDashboard";
import { TelemetryControls } from "@/components/TelemetryControls";
import { EmptyState, PageHeader } from "@/components/ui";
import Link from "next/link";

export default function LivePage() {
  const { snapshot, status, error, refresh } = useRiskStream();
  const { account } = useAuth();

  return (
    <div className="space-y-5">
      <PageHeader
        icon="live"
        title="Live Risk"
        subtitle="Real-time fusion, causal attribution and forecast over the websocket."
        right={<ConnectionBadge status={status} />}
      />

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
