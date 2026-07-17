"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

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
type IconProps = { className?: string };

const ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  overview: ({ className }) => (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <rect x="2" y="2" width="5" height="5" rx="1" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" strokeWidth="1.4" />
    </svg>
  ),
  live: ({ className }) => (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M1.5 8.5h3l1.5-5 3 9 1.5-4h4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  vehicles: ({ className }) => (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M2 10V8.2a1 1 0 01.55-.9l1.2-.6L4.8 4h6.4l1.05 2.7 1.2.6a1 1 0 01.55.9V10" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2 10h12v1.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V11h-8v.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V10z" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="4.5" cy="10" r="1" strokeWidth="1.1" />
      <circle cx="11.5" cy="10" r="1" strokeWidth="1.1" />
    </svg>
  ),
  traffic: ({ className }) => (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M3 13V6M8 13V3M13 13v8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  history: ({ className }) => (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <circle cx="8" cy="8" r="6" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.5 1.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  blackspots: ({ className }) => (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path d="M8 14s5-4.2 5-8a5 5 0 00-10 0c0 3.8 5 8 5 8z" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="6" r="1.6" strokeWidth="1.3" />
    </svg>
  ),
  settings: ({ className }) => (
    <svg className={className} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <circle cx="8" cy="8" r="2.2" strokeWidth="1.4" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.1 3.9l-1.1 1.1M5 11l-1.1 1.1M12.1 12.1L11 11M5 5 3.9 3.9" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
};

const SECTIONS = [
  { href: "/dashboard", label: "Overview", exact: true, icon: "overview" },
  { href: "/dashboard/live", label: "Live Risk", exact: false, icon: "live" },
  { href: "/dashboard/vehicles", label: "Vehicle Intelligence", exact: false, icon: "vehicles" },
  { href: "/dashboard/traffic", label: "Traffic Analytics", exact: false, icon: "traffic" },
  { href: "/dashboard/history", label: "Risk History", exact: false, icon: "history" },
  { href: "/dashboard/blackspots", label: "Black Spots", exact: false, icon: "blackspots" },
  { href: "/dashboard/settings", label: "Settings", exact: false, icon: "settings" },
] as const;

function NavLink({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: keyof typeof ICONS }) {
  const Icon = ICONS[icon];
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
        active ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
      }`}
    >
      <Icon className={active ? "text-sky-400" : "text-slate-600"} />
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
