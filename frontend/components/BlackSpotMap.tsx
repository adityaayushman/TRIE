"use client";

import { useMemo, useState } from "react";
import { BlackSpot } from "@/lib/types";
import { Legend } from "./ui";

/** Intervention → colour, matching the badge tones used elsewhere so a marker
 * and its list badge read as the same thing. */
const INTERVENTION_COLOR: Record<BlackSpot["intervention"], string> = {
  engineering: "#38bdf8",
  enforcement: "#f59e0b",
  education: "#a78bfa",
};

const INTERVENTION_LABEL: Record<BlackSpot["intervention"], string> = {
  engineering: "Engineering",
  enforcement: "Enforcement",
  education: "Education",
};

const VIEW_W = 720;
const VIEW_H = 440;
const PAD = 34;

const DEG_LAT_M = 111_320; // metres per degree of latitude

function radiusFor(nearMisses: number, maxNearMisses: number): number {
  // sqrt keeps a 200-near-miss spot from dwarfing a 30-near-miss one while
  // still ranking them by area, which reads as "how much evidence."
  const t = Math.sqrt(nearMisses) / Math.sqrt(Math.max(maxNearMisses, 1));
  return 6 + t * 16;
}

export function BlackSpotMap({
  spots,
  selected,
  onSelect,
}: {
  spots: BlackSpot[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const layout = useMemo(() => {
    if (spots.length === 0) return null;

    const lats = spots.map((s) => s.latitude);
    const lons = spots.map((s) => s.longitude);
    const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
    const cosLat = Math.cos((latMid * Math.PI) / 180);

    // Metric-ish coordinates (metres) so the plot is not longitude-stretched.
    const mx = (lon: number) => (lon - Math.min(...lons)) * cosLat * DEG_LAT_M;
    const my = (lat: number) => (lat - Math.min(...lats)) * DEG_LAT_M;

    // A minimum span (600m) stops a single point or a tight cluster from
    // zooming to infinity — the map stays a sensible neighbourhood scale.
    const spanX = Math.max(mx(Math.max(...lons)), 600);
    const spanY = Math.max(my(Math.max(...lats)), 600);

    const plotW = VIEW_W - PAD * 2;
    const plotH = VIEW_H - PAD * 2;
    const scale = Math.min(plotW / spanX, plotH / spanY); // px per metre
    const offX = PAD + (plotW - spanX * scale) / 2;
    const offY = PAD + (plotH - spanY * scale) / 2;

    const project = (s: BlackSpot) => ({
      x: offX + mx(s.longitude) * scale,
      y: offY + (spanY - my(s.latitude)) * scale, // invert: north is up
    });

    // Scale-bar: a round distance (1 km, or 200 m if the scene is small).
    const targetM = spanX > 1500 ? 1000 : 200;
    const barPx = targetM * scale;

    return { project, scale, barPx, barLabel: targetM >= 1000 ? "1 km" : `${targetM} m` };
  }, [spots]);

  const maxNearMisses = useMemo(
    () => Math.max(1, ...spots.map((s) => s.near_miss_count)),
    [spots]
  );

  if (!layout) return null;

  const active = hovered ?? selected;
  const activeSpot = active !== null ? spots[active] : null;

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="img"
          aria-label={`Map of ${spots.length} nominated black spots across the surveyed area, coloured by required intervention.`}
        >
          <defs>
            <radialGradient id="bs-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#bs-glow)" />

          {/* faint reference grid for spatial context */}
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f} stroke="#1e293b" strokeWidth={1}>
              <line x1={PAD + f * (VIEW_W - PAD * 2)} y1={PAD} x2={PAD + f * (VIEW_W - PAD * 2)} y2={VIEW_H - PAD} />
              <line x1={PAD} y1={PAD + f * (VIEW_H - PAD * 2)} x2={VIEW_W - PAD} y2={PAD + f * (VIEW_H - PAD * 2)} />
            </g>
          ))}

          {/* scale bar */}
          <g>
            <line x1={PAD} y1={VIEW_H - 16} x2={PAD + layout.barPx} y2={VIEW_H - 16} stroke="#64748b" strokeWidth={2} />
            <line x1={PAD} y1={VIEW_H - 19} x2={PAD} y2={VIEW_H - 13} stroke="#64748b" strokeWidth={2} />
            <line x1={PAD + layout.barPx} y1={VIEW_H - 19} x2={PAD + layout.barPx} y2={VIEW_H - 13} stroke="#64748b" strokeWidth={2} />
            <text x={PAD + layout.barPx + 6} y={VIEW_H - 12} className="fill-slate-500 text-[10px]">{layout.barLabel}</text>
          </g>

          {spots.map((spot, i) => {
            const { x, y } = layout.project(spot);
            const r = radiusFor(spot.near_miss_count, maxNearMisses);
            const color = INTERVENTION_COLOR[spot.intervention];
            const isActive = active === i;
            return (
              <g
                key={`${spot.latitude},${spot.longitude}`}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect(selected === i ? null : i)}
              >
                {/* pulse ring on the active/most-recent marker */}
                {isActive && <circle cx={x} cy={y} r={r + 6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />}
                <circle cx={x} cy={y} r={r} fill={color} fillOpacity={isActive ? 0.9 : 0.55} stroke={color} strokeWidth={1.5} />
                <circle cx={x} cy={y} r={2} fill="#0f172a" />
              </g>
            );
          })}
        </svg>

        {activeSpot && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[16rem] rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-lg">
            <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold" style={{ color: INTERVENTION_COLOR[activeSpot.intervention] }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: INTERVENTION_COLOR[activeSpot.intervention] }} />
              {INTERVENTION_LABEL[activeSpot.intervention]}
            </p>
            <p className="mt-1 font-mono text-[0.7rem] text-slate-300">
              {activeSpot.latitude.toFixed(4)}, {activeSpot.longitude.toFixed(4)}
            </p>
            <p className="mt-1 text-[0.7rem] text-slate-400">{activeSpot.dominant_cause}</p>
            <div className="mt-1.5 flex gap-3 text-[0.65rem] text-slate-500">
              <span><span className="tabular-nums text-slate-300">{activeSpot.near_miss_count}</span> near-misses</span>
              <span><span className="tabular-nums text-slate-300">{(activeSpot.confidence * 100).toFixed(1)}%</span> conf.</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={(["engineering", "enforcement", "education"] as const).map((k) => ({
            color: INTERVENTION_COLOR[k],
            label: INTERVENTION_LABEL[k],
          }))}
        />
        <p className="text-[0.65rem] text-slate-600">Marker size ∝ near-misses · hover or tap a spot</p>
      </div>
    </div>
  );
}
