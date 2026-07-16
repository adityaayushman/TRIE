"use client";

import { Snapshot, hasLiveDetail } from "@/lib/types";
import { FactorBreakdown } from "./FactorBreakdown";
import { ForecastPanel } from "./ForecastPanel";
import { RiskGauge } from "./RiskGauge";
import { RoadHazardPanel } from "./RoadHazardPanel";
import { Badge, Card, SectionTitle } from "./ui";

function factorLabel(key: string): string {
  return key
    .split("_")
    .map((w) => (w === "vru" ? "VRU" : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function RiskDashboard({ assessment }: { assessment: Snapshot }) {
  const live = hasLiveDetail(assessment) ? assessment : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        <Card className="flex flex-col items-center justify-center gap-3">
          <RiskGauge score={assessment.risk_score} level={assessment.risk_level} />
          <p className="text-center text-xs text-slate-500">
            Vehicle <span className="font-mono text-slate-300">{assessment.vehicle_id}</span>
          </p>
          {assessment.latitude !== null && assessment.longitude !== null && (
            <p className="text-center font-mono text-[0.7rem] text-slate-600">
              {assessment.latitude.toFixed(4)}, {assessment.longitude.toFixed(4)}
            </p>
          )}
        </Card>

        <Card delay={0.05} className="flex flex-col gap-5">
          <section>
            <SectionTitle hint="risk points, summing to the gauge">
              Contributing Factors
            </SectionTitle>
            {/* The numeric breakdown, not `secondary_causes`: that field holds
                only the *names* of causes ranked below the primary one, so it
                is empty whenever one factor drives the whole score — which is
                every telemetry-only assessment, leaving a dangling heading. */}
            <FactorBreakdown factors={assessment.contributing_factors} />

            {live && live.unobserved_factors.length > 0 && (
              <div className="mt-4 border-t border-slate-800 pt-3">
                <p className="mb-2 text-[0.65rem] uppercase tracking-wide text-slate-600">
                  Not observed — no sensor, weight redistributed
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {live.unobserved_factors.map((factor) => (
                    <li key={factor}>
                      <Badge>{factorLabel(factor)}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card delay={0.1}>
          <SectionTitle>Causal Chain</SectionTitle>
          <div className="space-y-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-600">
                Primary cause
              </p>
              <p className="mt-0.5 text-lg font-semibold text-slate-100">
                {assessment.primary_cause}
              </p>
            </div>
            <div className="border-l-2 border-slate-800 pl-3">
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-600">
                Predicted event if unaddressed
              </p>
              <p className="mt-0.5 text-base font-medium text-amber-400">
                {assessment.predicted_event}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-slate-600">
                Recommended actions
              </p>
              <ul className="mt-1.5 space-y-1">
                {assessment.recommended_actions.map((action) => (
                  <li key={action} className="flex items-center gap-2 text-sm text-slate-200">
                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <ForecastPanel snapshot={assessment} delay={0.15} />
      </div>

      <RoadHazardPanel snapshot={assessment} />

      <Card delay={0.25}>
        <SectionTitle>Explanation</SectionTitle>
        <p className="text-sm leading-relaxed text-slate-300">{assessment.explanation}</p>
      </Card>
    </div>
  );
}
