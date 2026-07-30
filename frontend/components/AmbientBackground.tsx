"use client";

import { useEffect, useRef } from "react";

/** A single, site-wide animated backdrop: slow-drifting nodes on a near-black
 * field, linked when close — evoking the platform's own subject (moving road
 * users, discovered risk points) without any 3D. It lives in the root layout so
 * it is created once and persists across every navigation (no re-init, so tab
 * switches never stutter), runs one requestAnimationFrame loop, pauses when the
 * tab is hidden, and is deliberately light (~52 nodes, capped DPR). */
export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const context = cv.getContext("2d", { alpha: true });
    if (!context) return;
    // Non-null locals so the nested rAF closures type-check cleanly.
    const canvas: HTMLCanvasElement = cv;
    const ctx: CanvasRenderingContext2D = context;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    let nodes: Node[] = [];

    const LINK_DIST = 150;

    function seed() {
      // Density scales with area, but is capped so a big monitor stays smooth.
      const target = Math.min(58, Math.round((width * height) / 26000));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() < 0.16 ? 1.8 : 1.1,
      }));
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function frame() {
      ctx.clearRect(0, 0, width, height);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        else if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        else if (n.y > height + 20) n.y = -20;
      }

      // links first, so nodes sit on top
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.14;
            ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.r > 1.5 ? "rgba(125,211,252,0.55)" : "rgba(148,163,184,0.4)";
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    let raf = 0;
    function start() {
      if (!raf && !document.hidden && !prefersReduced) raf = requestAnimationFrame(frame);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    resize();
    if (prefersReduced) {
      // Draw one static frame so the field still reads as "there".
      frame();
      stop();
    } else {
      start();
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* near-black base with a faint cool vignette, then the moving field */}
      <div className="absolute inset-0 bg-[#05070c]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60rem 45rem at 78% -8%, rgba(30,58,95,0.28), transparent 60%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
