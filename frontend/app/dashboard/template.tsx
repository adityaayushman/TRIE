"use client";

import { PageTransition } from "@/components/PageTransition";

/** A Next.js template re-mounts on every navigation, unlike a layout — so this
 * fires a fresh enter animation each time you switch dashboard tabs, while the
 * sidebar/header in dashboard/layout.tsx stays put. Uses the shared
 * PageTransition so every tab switch feels identical to a full-page navigation.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
