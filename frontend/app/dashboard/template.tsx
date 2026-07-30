"use client";

import { motion } from "framer-motion";

/** A Next.js template re-mounts on every navigation, unlike a layout — so this
 * fires a fresh enter animation each time you switch dashboard tabs, while the
 * sidebar/header in dashboard/layout.tsx stays put. Enter-only (no blocking
 * exit) and transform/opacity only, so tab switches stay snappy. */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
