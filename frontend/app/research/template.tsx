"use client";

import { PageTransition } from "@/components/PageTransition";

/** Enter animation for the research page, scoped so it fires on navigation to
 * /research without a root template re-mounting the persistent dashboard shell.
 * Shares PageTransition with every other route for one consistent motion. */
export default function ResearchTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
