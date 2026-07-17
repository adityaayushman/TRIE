"use client";

import { useEffect, useRef, useState } from "react";
import { DemoClipData, DemoFrame, DemoManifestEntry, fetchDemoClip, nearestFrame } from "@/lib/demo";
import { Badge } from "./ui";

const BOX_COLOR: Record<string, string> = {
  vehicle: "#3987e5",
  two_wheeler: "#f59e0b",
  pedestrian: "#ef4444",
};

function drawFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement, frame: DemoFrame | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = video.clientWidth;
  const height = video.clientHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;

  const draw = (kind: "vehicle" | "two_wheeler" | "pedestrian", items: DemoFrame["vehicles"]) => {
    ctx.strokeStyle = BOX_COLOR[kind];
    ctx.lineWidth = 2;
    ctx.font = "11px ui-sans-serif, system-ui";
    for (const item of items) {
      const [x1, y1, x2, y2] = item.bbox;
      const bx = x1 * width;
      const by = y1 * height;
      const bw = (x2 - x1) * width;
      const bh = (y2 - y1) * height;
      ctx.strokeRect(bx, by, bw, bh);
      const label = `${item.label} ${Math.round(item.confidence * 100)}%`;
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = BOX_COLOR[kind];
      ctx.fillRect(bx, Math.max(0, by - 14), textWidth + 6, 14);
      ctx.fillStyle = "#0f172a";
      ctx.fillText(label, bx + 3, Math.max(10, by - 3));
    }
  };

  draw("vehicle", frame.vehicles);
  draw("two_wheeler", frame.two_wheelers);
  draw("pedestrian", frame.pedestrians);
}

export function CameraTile({ clip }: { clip: DemoManifestEntry }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<DemoClipData | null>(null);
  const rafRef = useRef<number | null>(null);
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

    const tick = () => {
      const data = dataRef.current;
      if (data) {
        const frame = nearestFrame(data.frames, video.currentTime);
        drawFrame(canvas, video, frame);
        setLive(frame);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready]);

  const vehicleCount = live ? live.vehicles.length : 0;
  const twoWheelerCount = live ? live.two_wheelers.length : 0;
  const pedestrianCount = live ? live.pedestrians.length : 0;
  const congestion = live?.traffic.congestion_level ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950">
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={clip.video}
          className="h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-red-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          Rec
        </div>
        <div className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[0.65rem] text-slate-300">
          congestion {(congestion * 100).toFixed(0)}%
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-200">{clip.title}</p>
          <p className="text-[0.65rem] text-slate-600">recorded footage · real detector output</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Badge tone={vehicleCount > 0 ? "neutral" : "neutral"}>{vehicleCount} veh</Badge>
          <Badge tone="warn">{twoWheelerCount} 2w</Badge>
          {pedestrianCount > 0 && <Badge tone="danger">{pedestrianCount} ped</Badge>}
        </div>
      </div>
    </div>
  );
}
