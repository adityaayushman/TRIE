"use client";

import { Snapshot, hasLiveDetail } from "@/lib/types";
import { Card, SectionTitle, Stat } from "./ui";

/** ai/temporal_prediction/ output. Live-only: the forecast is not persisted,
 * so a page seeded from GET /risk/events has no forecast until the first
 * websocket message arrives — shown as em dashes rather than zeros. */
export function ForecastPanel({ snapshot, delay = 0 }: { snapshot: Snapshot; delay?: number }) {
  const live = hasLiveDetail(snapshot) ? snapshot : null;
  const trend = live ? live.future_risk_score - live.risk_score : 0;

  return (
    <Card delay={delay}>
      <SectionTitle hint={live ? undefined : "awaiting live data"}>
        Temporal Forecast
      </SectionTitle>
      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="Projected risk"
          value={live ? live.future_risk_score.toFixed(1) : null}
          unit="%"
          muted={!live}
          title="Risk extrapolated from this vehicle's own recent trend"
        />
        <Stat
          label="Time to risk"
          value={live && live.time_to_risk_s !== null ? live.time_to_risk_s.toFixed(1) : null}
          unit="s"
          muted={!live || live.time_to_risk_s === null}
          title="Only estimated while risk is rising; null when flat or falling"
        />
        <Stat
          label="Collision prob."
          value={live ? (live.collision_probability * 100).toFixed(1) : null}
          unit="%"
          muted={!live}
        />
      </div>

      {live && (
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          {trend > 0.05 ? (
            <>
              Risk is <span className="text-amber-400">rising</span> — projected{" "}
              {trend.toFixed(1)} points higher on this vehicle&apos;s current trend.
            </>
          ) : trend < -0.05 ? (
            <>
              Risk is <span className="text-emerald-400">falling</span> —{" "}
              {Math.abs(trend).toFixed(1)} points lower on current trend.
            </>
          ) : (
            <>
              Risk is steady. A time-to-risk estimate only appears while the trend is
              rising.
            </>
          )}
        </p>
      )}
    </Card>
  );
}
