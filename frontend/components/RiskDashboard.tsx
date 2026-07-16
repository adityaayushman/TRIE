"use client";

import { motion } from "framer-motion";
import { RiskAssessment } from "@/lib/types";
import { RiskGauge } from "./RiskGauge";

export function RiskDashboard({ assessment }: { assessment: RiskAssessment }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-8 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-900 p-8"
      >
        <RiskGauge score={assessment.risk_score} level={assessment.risk_level} />
        <p className="text-center text-sm text-slate-400">
          Vehicle <span className="font-mono text-slate-200">{assessment.vehicle_id}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-8"
      >
        <section>
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Primary Cause</h2>
          <p className="text-lg font-semibold text-slate-100">{assessment.primary_cause}</p>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Contributing Factors</h2>
          <ul className="mt-1 flex flex-wrap gap-2">
            {assessment.secondary_causes.map((cause) => (
              <li key={cause} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {cause}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Predicted Event</h2>
          <p className="text-lg font-semibold text-slate-100">{assessment.predicted_event}</p>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Recommended Actions</h2>
          <ul className="mt-1 space-y-1">
            {assessment.recommended_actions.map((action) => (
              <li key={action} className="flex items-center gap-2 text-sm text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {action}
              </li>
            ))}
          </ul>
        </section>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-slate-900 p-8 md:col-span-2"
      >
        <h2 className="text-xs uppercase tracking-wide text-slate-500">Explanation</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{assessment.explanation}</p>
      </motion.div>
    </div>
  );
}
