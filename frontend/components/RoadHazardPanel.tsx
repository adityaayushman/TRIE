"use client";

import { motion } from "framer-motion";
import { RiskAssessment, RiskEvent } from "@/lib/types";

/** Live-only: potholes/cracks/waterlogging exist on the websocket payload
 * (RiskAssessment) but are not persisted, so a GET /risk/events seed
 * (RiskEvent) won't have them until the first live broadcast arrives. */
function hasRoadHazardData(
  snapshot: RiskAssessment | RiskEvent
): snapshot is RiskAssessment {
  return "potholes" in snapshot;
}

export function RoadHazardPanel({ snapshot }: { snapshot: RiskAssessment | RiskEvent }) {
  if (!hasRoadHazardData(snapshot)) return null;

  const { potholes, cracks, is_waterlogged, surface_quality_score } = snapshot;
  const hasHazards = potholes.length > 0 || cracks.length > 0 || is_waterlogged;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mx-auto max-w-5xl px-8 pb-8"
    >
      <div className="rounded-2xl bg-slate-900 p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">
            Road Surface — Live
          </h2>
          <span className="text-sm text-slate-400">
            Quality {Math.round(surface_quality_score * 100)}%
          </span>
        </div>

        {hasHazards ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {potholes.map((p, i) => (
              <li
                key={`pothole-${i}`}
                className="rounded-full bg-red-950 px-3 py-1 text-xs text-red-300"
              >
                Pothole ({Math.round(p.confidence * 100)}%)
              </li>
            ))}
            {cracks.map((c, i) => (
              <li
                key={`crack-${i}`}
                className="rounded-full bg-amber-950 px-3 py-1 text-xs text-amber-300"
              >
                Crack ({Math.round(c.confidence * 100)}%)
              </li>
            ))}
            {is_waterlogged && (
              <li className="rounded-full bg-sky-950 px-3 py-1 text-xs text-sky-300">
                Waterlogged
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">No surface hazards detected.</p>
        )}
      </div>
    </motion.div>
  );
}
