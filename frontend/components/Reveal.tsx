"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/** Scroll-in (or on-mount) reveal for landing-page content. Sections fade and
 * lift into place as they enter the viewport, so scrolling the marketing page
 * feels alive rather than static — while staying opacity + transform only, and
 * firing once, so it never re-runs or janks. Pass `immediate` for above-the-fold
 * content (the hero) that should animate on load instead of on scroll. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  immediate = false,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  immediate?: boolean;
  className?: string;
}) {
  const animateProps = immediate
    ? { animate: { opacity: 1, y: 0 } }
    : {
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-70px" },
      };

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      {...animateProps}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}
