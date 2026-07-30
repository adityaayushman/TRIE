"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/** The one enter-animation every top-level route shares, so navigating between
 * the landing, dashboard, research and auth all feels like one product. Kept to
 * opacity + translate + a whisker of scale — all GPU-composited transforms, no
 * per-frame blur or layout — so even a heavy page slides in without a stutter.
 * Enter-only (no blocking exit) so a tab switch never waits on an out animation.
 */
export function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: "transform, opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
