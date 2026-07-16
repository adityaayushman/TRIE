"use client";

import { motion } from "framer-motion";

/** Bar hue. One series (contribution magnitude), so one colour: ranking by
 * colour would be wrong, and a legend is unnecessary — the heading names the
 * measure. Validated ≥3:1 against the slate-900 card surface. */
const BAR_COLOR = "#3987e5";

/** `vru` is an initialism; everything else title-cases from its snake_case
 * key. The keys themselves are the stable contract (ai/trie/risk_fusion.py
 * _BASE_WEIGHTS), so formatting here rather than shipping a label map that
 * could drift out of sync with the backend's own cause labels. */
function factorLabel(key: string): string {
  return key
    .split("_")
    .map((word) => (word === "vru" ? "VRU" : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

/** The weighted contributions from ai/trie/risk_fusion.py, which sum to
 * risk_score/100 — so a bar's width is literally its share of the gauge.
 *
 * Zero-valued factors are kept rather than filtered: "we measured traffic
 * congestion and it added nothing" is a different, and useful, claim from
 * "we could not measure it at all" (the latter appears in the explanation as
 * *not observed*, since risk fusion drops those factors entirely).
 */
export function FactorBreakdown({ factors }: { factors: Record<string, number> }) {
  const ranked = Object.entries(factors).sort(([, a], [, b]) => b - a);

  if (ranked.length === 0) {
    return <p className="mt-1 text-sm text-slate-400">No factors measured.</p>;
  }

  return (
    <ul className="mt-2 space-y-2">
      {ranked.map(([key, value], index) => {
        const points = value * 100;
        return (
          <li key={key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
            <span className="truncate text-xs text-slate-400" title={factorLabel(key)}>
              {factorLabel(key)}
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: BAR_COLOR }}
                initial={{ width: 0 }}
                animate={{ width: `${points}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 + index * 0.05 }}
              />
            </div>
            <span className="text-right font-mono text-xs tabular-nums text-slate-300">
              {points.toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
