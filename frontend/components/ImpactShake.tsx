"use client";

import { useEffect, useRef, useState } from "react";
import { onImpact, prefersReducedMotion } from "@/lib/impact";

const SHAKE_MS = 650;
const MAX_OFFSET_PX = 14;
const MAX_ROTATE_DEG = 1.1;

/**
 * Wraps the whole page so the hero's 3D collision (HeroScene) can make the
 * actual DOM shake, not just the canvas — "the webpage reacts to the crash,"
 * not just a video playing inside it. A single `trie:impact` event (lib/
 * impact.ts) drives both: this component only knows "something hit," not
 * what — same reaction regardless of source.
 *
 * Two effects, both time-boxed and one-shot per event (never a looping
 * jump-scare): a quick, hard-decaying positional/rotational jolt on the
 * wrapper itself, and a soft dark-red vignette flash. The jolt is skipped
 * entirely under prefers-reduced-motion (a11y: sudden large translation is
 * exactly what that setting exists to suppress); the flash — a plain
 * opacity fade, not a strobe — still plays, since it carries the narrative
 * beat ("this is the moment of impact") without the vestibular risk.
 */
export function ImpactShake({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    const unsubscribe = onImpact(() => {
      setFlashKey((k) => k + 1);
      if (prefersReducedMotion()) return;

      const start = performance.now();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const tick = (now: number) => {
        const elapsed = now - start;
        const el = wrapRef.current;
        if (!el || elapsed >= SHAKE_MS) {
          if (el) el.style.transform = "";
          rafRef.current = null;
          return;
        }
        // Quadratic falloff reads as a hard jolt that settles fast, closer
        // to a real impact than a smooth sinusoidal wobble.
        const decay = (1 - elapsed / SHAKE_MS) ** 2;
        const dx = (Math.random() * 2 - 1) * MAX_OFFSET_PX * decay;
        const dy = (Math.random() * 2 - 1) * MAX_OFFSET_PX * 0.6 * decay;
        const rot = (Math.random() * 2 - 1) * MAX_ROTATE_DEG * decay;
        el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      unsubscribe();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={wrapRef} className="will-change-transform">
      {children}
      {flashKey > 0 && (
        <div
          key={flashKey}
          aria-hidden
          // opacity-0 is the resting state; the animation only overrides it
          // while running. Without this, a CSS animation with no
          // animation-fill-mode reverts to the element's base style the
          // instant it finishes — which, with no base opacity set, is CSS's
          // default of 1, leaving a permanent red tint over the whole site.
          className="pointer-events-none fixed inset-0 z-999 animate-[impact-flash_550ms_ease-out] opacity-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(239,68,68,0.28) 0%, rgba(239,68,68,0.08) 45%, transparent 75%)",
          }}
        />
      )}
    </div>
  );
}
