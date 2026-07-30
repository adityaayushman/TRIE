"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/** Enter animation for the top-level pages (landing, research, auth) that have
 * no shared persistent shell. Mounting on navigation plays it. Kept to opacity
 * + a small lift so it is GPU-cheap and never janks. */
export function PageTransition({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
