"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { ICONS, IconName } from "./icons";

/** Sections backed by either a real endpoint or a real model's output.
 *
 * Vehicle Intelligence and Traffic Analytics run the real perception and
 * traffic-intelligence engines against recorded street footage — genuine
 * model output, since the deployed API has no live camera to point them at.
 * Driver Intelligence and an Edge Devices page still don't exist: driver
 * monitoring needs a cabin-facing recording we don't have a license to use,
 * and there is no Jetson to poll. They arrive when the data does — see the
 * honest status table in docs/ARCHITECTURE.md.
 */
const SECTIONS = [
  { href: "/dashboard", label: "Overview", exact: true, icon: "overview" },
  { href: "/dashboard/live", label: "Live Risk", exact: false, icon: "live" },
  { href: "/dashboard/vehicles", label: "Vehicle Intelligence", exact: false, icon: "vehicles" },
  { href: "/dashboard/traffic", label: "Traffic Analytics", exact: false, icon: "traffic" },
  { href: "/dashboard/history", label: "Risk History", exact: false, icon: "history" },
  { href: "/dashboard/blackspots", label: "Black Spots", exact: false, icon: "blackspots" },
  { href: "/dashboard/settings", label: "Settings", exact: false, icon: "settings" },
] as const;

function NavLink({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: IconName }) {
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        active ? "text-white" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {active && (
        <motion.span
          layoutId="dash-nav-active"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-lg border border-sky-500/25 bg-gradient-to-r from-sky-500/20 to-sky-500/5"
        />
      )}
      <span className={`relative z-10 ${active ? "text-sky-300" : "text-slate-600"}`}>
        <Icon />
      </span>
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { account, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="relative min-h-screen">
      {/* the animated near-black backdrop is provided site-wide by
          AmbientBackground in the root layout; this page is transparent over it */}
      <header className="sticky top-0 z-20 border-b border-slate-800/70 bg-[#05070c]/70 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle navigation"
              className="rounded-lg p-1.5 text-slate-500 transition hover:text-slate-300 lg:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                <path d="M2 4h12M2 8h12M2 12h12" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <Link href="/" className="text-sm font-bold tracking-tight text-slate-50">
              Smart Road Guardian <span className="text-sky-400">AI X</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {loading ? null : account ? (
              <>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {account.email}
                  {account.organisation && (
                    <span className="ml-1.5 text-slate-600">· {account.organisation}</span>
                  )}
                </span>
                <button
                  onClick={signOut}
                  className="rounded-lg border border-slate-800 px-2.5 py-1 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <span className="hidden text-xs text-slate-600 sm:inline">Viewing anonymously</span>
                <Link
                  href="/login"
                  className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-500"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-[1400px]">
        <aside
          className={`${
            open ? "block" : "hidden"
          } w-full shrink-0 border-r border-slate-800/70 p-3 lg:sticky lg:top-[57px] lg:block lg:h-[calc(100vh-57px)] lg:w-56`}
        >
          <nav className="space-y-0.5">
            {SECTIONS.map((section) => (
              <NavLink
                key={section.href}
                href={section.href}
                label={section.label}
                icon={section.icon}
                active={isActive(section.href, section.exact)}
              />
            ))}
          </nav>

          <p className="mt-6 px-3 text-[0.65rem] leading-relaxed text-slate-700">
            Vehicle Intelligence and Traffic Analytics run on recorded footage, not a live
            camera. Driver monitoring and edge-device sections appear once real hardware
            feeds this API.
          </p>
        </aside>

        <main className={`${open ? "hidden" : "block"} min-w-0 flex-1 p-5 lg:block`}>
          {children}
        </main>
      </div>
    </div>
  );
}
