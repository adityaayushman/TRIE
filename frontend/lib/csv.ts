import { RiskEvent } from "./types";

const COLUMNS: (keyof RiskEvent)[] = [
  "id",
  "vehicle_id",
  "created_at",
  "risk_score",
  "risk_level",
  "primary_cause",
  "secondary_causes",
  "predicted_event",
  "recommended_actions",
  "contributing_factors",
  "latitude",
  "longitude",
  "explanation",
];

/** RFC 4180 field quoting: wrap in quotes and escape embedded quotes whenever
 * a field could otherwise break the delimiting (a comma, a quote, or a
 * newline — `explanation` is free text and can contain any of these). */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Real historical-analytics export: every field the dashboard renders, as a
 * CSV a reviewer or an ops team can open in Excel/Sheets or feed to their own
 * analysis — not a mock download, the actual persisted risk_events rows. */
export function eventsToCsv(events: RiskEvent[]): string {
  const header = COLUMNS.join(",");
  const rows = events.map((event) => COLUMNS.map((col) => csvField(event[col])).join(","));
  return [header, ...rows].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
