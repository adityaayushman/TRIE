"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ICONS, IconName } from "./icons";

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "how-it-works", label: "How it works", icon: "live" },
  { id: "explore", label: "Live capabilities", icon: "vehicles" },
  { id: "evidence", label: "Evidence", icon: "blackspots" },
];

/**
 * The site's smart, categorized navigation for the long-scroll landing page —
 * a sticky tab bar that takes over once the hero scrolls away, so a visitor
 * three sections deep never loses their place or their way back to sign-in.
 * Active tab tracks scroll position via IntersectionObserver rather than a
 * click-only state, so it stays honest whether the visitor clicked a tab or
 * just scrolled.
 */
export function SectionTabs() {
  const [active, setActive] = useState<string>(TABS[0].id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sections = TABS.map((tab) => document.getElementById(tab.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top of the viewport among those
        // currently intersecting — reads correctly even when a section is
        // taller than the viewport, unlike "first intersecting entry."
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        setActive(top.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="sticky top-0 z-30 border-b border-slate-800/70 bg-[#05070c]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5">
        <nav
          className="flex items-center gap-0.5 overflow-x-auto py-2.5"
          // A fade at each edge, not a hard clip, so a visitor on a narrow
          // screen sees "there's more this way" rather than a tab silently
          // cut off mid-label (the exact gap the mobile screenshot caught:
          // "Evidence" had no affordance it was scrollable to reach).
          style={{
            maskImage: "linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)",
          }}
        >
          {TABS.map((tab) => {
            const Icon = ICONS[tab.icon];
            const isActive = active === tab.id;
            return (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-sky-500/10 text-sky-300" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </a>
            );
          })}
        </nav>
        <Link
          href="/register"
          className="hidden shrink-0 rounded-lg bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_-4px_rgba(56,189,248,0.7)] transition hover:bg-sky-600 sm:inline-block"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}
