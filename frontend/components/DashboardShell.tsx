"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

/** Only sections backed by a real endpoint appear here.
 *
 * The product spec also calls for Live Monitoring (camera feeds), Vehicle /
 * Driver / Traffic Intelligence, and an Edge Devices page. Those are absent
 * deliberately: the deployed API has no camera attached, so a Driver page
 * would read `face_detected: false` on every load and an Edge page would have
 * no Jetson to poll. They arrive when the data does — see the honest status
 * table in docs/ARCHITECTURE.md.
 */
const SECTIONS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/live", label: "Live Risk" },
  { href: "/dashboard/history", label: "Risk History" },
  { href: "/dashboard/blackspots", label: "Black Spots" },
  { href: "/dashboard/settings", label: "Settings" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-xs font-medium transition ${
        active ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
      }`}
    >
      {label}
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
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
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

      <div className="mx-auto flex max-w-[1400px]">
        <aside
          className={`${
            open ? "block" : "hidden"
          } w-full shrink-0 border-r border-slate-800/80 p-3 lg:block lg:w-56`}
        >
          <nav className="space-y-0.5">
            {SECTIONS.map((section) => (
              <NavLink
                key={section.href}
                href={section.href}
                label={section.label}
                active={isActive(section.href, section.exact)}
              />
            ))}
          </nav>

          <p className="mt-6 px-3 text-[0.65rem] leading-relaxed text-slate-700">
            Camera, driver and edge-device sections appear once real hardware feeds this API.
            The JSON endpoint carries telemetry only.
          </p>
        </aside>

        <main className={`${open ? "hidden" : "block"} min-w-0 flex-1 p-5 lg:block`}>
          {children}
        </main>
      </div>
    </div>
  );
}
