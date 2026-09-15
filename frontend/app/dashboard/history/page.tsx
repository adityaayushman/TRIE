"use client";

import { useState } from "react";
import { fetchRecentEvents } from "@/lib/api";
import { downloadCsv, eventsToCsv } from "@/lib/csv";
import { useRiskStream } from "@/lib/useRiskStream";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { RiskTimeline } from "@/components/RiskTimeline";
import { PageHeader } from "@/components/ui";

// Bulk pull for the export — independent of the live stream's 50-row display
// cap, so "export history" means the real recent history, not just what's on
// screen. GET /risk/events is a public read (see app/api/routes/risk.py), so
// this needs no sign-in, matching the rest of the page.
const EXPORT_LIMIT = 5000;

export default function HistoryPage() {
  const { events, status, refresh } = useRiskStream();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const rows = await fetchRecentEvents(EXPORT_LIMIT);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadCsv(`trie-risk-events-${stamp}.csv`, eventsToCsv(rows));
    } catch (cause) {
      setExportError((cause as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="history"
        title="Risk History"
        subtitle="Per-vehicle risk trend against the engine's own thresholds."
        right={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Download every persisted risk event as CSV"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <ConnectionBadge status={status} />
          </div>
        }
      />
      {exportError && <p className="text-xs text-red-400">Export failed: {exportError}</p>}
      <RiskTimeline events={events} onDeleted={refresh} />
    </div>
  );
}
