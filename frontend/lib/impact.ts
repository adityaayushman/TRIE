"use client";

/** A tiny, dependency-free event bus so the hero's 3D collision (inside a
 * react-three-fiber Canvas, which owns its own render loop) can tell the rest
 * of the page — a plain DOM component — "the impact just happened," without
 * threading a prop down through the Canvas tree. One event, no payload: every
 * listener reacts the same way regardless of which vehicles collided. */
const IMPACT_EVENT = "trie:impact";

export function triggerImpact(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(IMPACT_EVENT));
}

export function onImpact(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(IMPACT_EVENT, handler);
  return () => window.removeEventListener(IMPACT_EVENT, handler);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
