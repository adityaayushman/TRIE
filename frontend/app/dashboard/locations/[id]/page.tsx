"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteLocation, fetchLocation } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRiskStream } from "@/lib/useRiskStream";
import { LocationSummary } from "@/lib/types";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskDashboard } from "@/components/RiskDashboard";
import { RiskTimeline } from "@/components/RiskTimeline";
import { Card, EmptyState, PageHeader } from "@/components/ui";

/** One registered site's own scoped view — its live snapshot and its own
 * history only, not the whole platform's. Reuses RiskDashboard/RiskTimeline
 * exactly as /dashboard/live and /dashboard/history do; the only difference
 * is useRiskStream(locationId) instead of useRiskStream(). */
export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { account } = useAuth();
  const [location, setLocation] = useState<LocationSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { snapshot, events, status, refresh } = useRiskStream(params.id);

  useEffect(() => {
    fetchLocation(params.id)
      .then(setLocation)
      .catch((cause) => setLoadError((cause as Error).message));
  }, [params.id]);

  async function handleDelete() {
    if (!location) return;
    if (!window.confirm(`Delete "${location.name}"? Its events keep their telemetry — they just lose this label.`)) return;
    setDeleting(true);
    try {
      await deleteLocation(location.id);
      router.push("/dashboard/locations");
    } catch (cause) {
      window.alert((cause as Error).message);
      setDeleting(false);
    }
  }

  if (loadError) {
    return <EmptyState title="Could not load this site" body={loadError} />;
  }
  if (!location) {
    return <EmptyState title="Loading…" body="Fetching this site's details." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="locations"
        title={location.name}
        subtitle={location.description || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
        right={<ConnectionBadge status={status} />}
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-slate-500">Coordinates</dt>
              <dd className="mt-0.5 font-mono text-slate-300">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Registered</dt>
              <dd className="mt-0.5 text-slate-300">{new Date(location.created_at).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Assessments</dt>
              <dd className="mt-0.5 tabular-nums text-slate-300">{location.event_count}</dd>
            </div>
          </dl>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/locations" className="text-slate-500 transition hover:text-slate-300">
              ← All locations
            </Link>
            {account?.role === "admin" && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-900/60 px-3 py-1.5 text-red-400 transition hover:border-red-700 hover:text-red-300 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete site"}
              </button>
            )}
          </div>
        </div>
      </Card>

      {snapshot ? (
        <RiskDashboard assessment={snapshot} />
      ) : (
        <EmptyState
          title="No assessments yet at this site"
          body="Tag a live or device-telemetry assessment with this site's id (see /dashboard/live) and it appears here."
        />
      )}

      <RiskTimeline events={events} onDeleted={refresh} />
    </div>
  );
}
