"use client";

import { useEffect, useRef, useState } from "react";
import { DemoClipData, DemoFrame, DemoManifestEntry, fetchDemoClip, nearestFrame } from "@/lib/demo";
import { Badge } from "./ui";

// Categorical palette for the road-user classes, shared by the camera overlays,
// the Vehicle-Intelligence legend and the Traffic flow chart. Re-stepped to pass
// the dataviz CVD + normal-vision gates (validate_palette, dark surface): a
// danger-red pedestrian and a caution-yellow two-wheeler stay distinct even
// under deuteranopia, where the previous red/amber pair collapsed.
export const BOX_COLOR: Record<string, string> = {
  vehicle: "#3987e5",
  two_wheeler: "#fbbf24",
  pedestrian: "#ef4444",
};

/** Helmet-detector rider classes get their own palette, keyed by the danger they
 * carry: a bare head reads red, a helmet green, an overloaded bike amber. */
export const RIDER_COLOR: Record<string, string> = {
  without_helmet: "#ef4444",
  with_helmet: "#34d399",
  triple_riding: "#f59e0b",
};
const RIDER_LABEL: Record<string, string> = {
  without_helmet: "no helmet",
  with_helmet: "helmet",
  triple_riding: "triple",
};
const FACTOR_TEXT: Record<string, string> = {
  no_helmet: "no helmet",
  triple_riding: "triple riding",
};

// Past this many boxes in one frame, per-box text labels turn into visual
// noise faster than they inform -- outlines alone still show the count.
const MAX_LABELLED_BOXES = 6;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement, frame: DemoFrame | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = video.clientWidth;
  const height = video.clientHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;

  type Kind = "vehicle" | "two_wheeler" | "pedestrian";
  const all: { kind: Kind; item: DemoFrame["vehicles"][number] }[] = [
    ...frame.vehicles.map((item) => ({ kind: "vehicle" as const, item })),
    ...frame.two_wheelers.map((item) => ({ kind: "two_wheeler" as const, item })),
    ...frame.pedestrians.map((item) => ({ kind: "pedestrian" as const, item })),
  ].sort((a, b) => b.item.confidence - a.item.confidence);

  ctx.lineWidth = 2;
  ctx.font = "600 11px ui-sans-serif, system-ui";

  all.forEach(({ kind, item }, index) => {
    const color = BOX_COLOR[kind];
    const [x1, y1, x2, y2] = item.bbox;
    const bx = x1 * width;
    const by = y1 * height;
    const bw = (x2 - x1) * width;
    const bh = (y2 - y1) * height;

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    roundedRect(ctx, bx, by, bw, bh, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (index < MAX_LABELLED_BOXES) {
      const label = `${item.label} ${Math.round(item.confidence * 100)}%`;
      const textWidth = ctx.measureText(label).width;
      const labelY = Math.max(0, by - 15);
      ctx.fillStyle = color;
      roundedRect(ctx, bx, labelY, textWidth + 8, 15, 3);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.fillText(label, bx + 4, labelY + 11);
    }
  });

  if (all.length > MAX_LABELLED_BOXES) {
    const more = `+${all.length - MAX_LABELLED_BOXES} more`;
    ctx.font = "600 10px ui-sans-serif, system-ui";
    const textWidth = ctx.measureText(more).width;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    roundedRect(ctx, width - textWidth - 14, height - 22, textWidth + 8, 15, 3);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(more, width - textWidth - 10, height - 11);
  }

  // Rider vulnerability pass — only when the helmet detector has annotated this
  // clip. Drawn on top of the two-wheeler boxes, dashed, so it reads as a second
  // layer of judgement about the *same* rider rather than a duplicate detection.
  const riders = (frame.riders ?? []).filter((r) => r.label in RIDER_COLOR);
  if (riders.length > 0) {
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 2.5;
    riders.forEach((r) => {
      const color = RIDER_COLOR[r.label];
      const [x1, y1, x2, y2] = r.bbox;
      const bx = x1 * width;
      const by = y1 * height;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      roundedRect(ctx, bx, by, (x2 - x1) * width, (y2 - y1) * height, 5);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const label = RIDER_LABEL[r.label];
      const tw = ctx.measureText(label).width;
      const ly = Math.max(0, by - 16);
      ctx.fillStyle = color;
      roundedRect(ctx, bx, ly, tw + 8, 15, 3);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.fillText(label, bx + 4, ly + 11);
    });
    ctx.setLineDash([]);
  }
}

export interface LiveCounts {
  vehicles: number;
  twoWheelers: number;
  pedestrians: number;
  congestion: number;
}

export function CameraTile({
  clip,
  onLiveUpdate,
}: {
  clip: DemoManifestEntry;
  onLiveUpdate?: (name: string, counts: LiveCounts) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<DemoClipData | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastReportRef = useRef(0);
  const [live, setLive] = useState<DemoFrame | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDemoClip(clip.detections).then((data) => {
      if (cancelled) return;
      dataRef.current = data;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [clip.detections]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;

    const tick = (now: number) => {
      const data = dataRef.current;
      if (data) {
        const frame = nearestFrame(data.frames, video.currentTime);
        drawFrame(canvas, video, frame);
        setLive(frame);
        // Throttled: the parent aggregates across up to a handful of tiles,
        // so this doesn't need to run at full animation-frame rate.
        if (frame && now - lastReportRef.current > 200) {
          lastReportRef.current = now;
          onLiveUpdate?.(clip.name, {
            vehicles: frame.vehicles.length,
            twoWheelers: frame.two_wheelers.length,
            pedestrians: frame.pedestrians.length,
            congestion: frame.traffic.congestion_level,
          });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const vehicleCount = live ? live.vehicles.length : 0;
  const twoWheelerCount = live ? live.two_wheelers.length : 0;
  const pedestrianCount = live ? live.pedestrians.length : 0;
  const congestion = live?.traffic.congestion_level ?? 0;
  const vuln = live?.vulnerability;
  const showVuln = !!vuln && vuln.multiplier > 1;

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.6)] transition-colors hover:border-slate-700">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={clip.video}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          autoPlay
          loop
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-linear-to-b from-black/50 to-transparent" />
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-red-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          Rec
        </div>
        <div className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[0.65rem] font-medium tabular-nums text-slate-200">
          {(congestion * 100).toFixed(0)}% congestion
        </div>
        {showVuln && vuln && (
          <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-red-950/80 px-2 py-1 text-[0.65rem] font-semibold text-red-200 ring-1 ring-red-500/40 backdrop-blur-sm">
            <span aria-hidden>⚠</span>
            <span className="tabular-nums">×{vuln.multiplier.toFixed(2)} risk</span>
            <span className="uppercase tracking-wide text-red-300/90">
              {FACTOR_TEXT[vuln.dominant_factor] ?? vuln.dominant_factor}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-200">{clip.title}</p>
          <p className="text-[0.65rem] text-slate-600">recorded footage · real detector output</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Badge>{vehicleCount} veh</Badge>
          <Badge tone="warn">{twoWheelerCount} 2w</Badge>
          {pedestrianCount > 0 && <Badge tone="danger">{pedestrianCount} ped</Badge>}
        </div>
      </div>
    </div>
  );
}
