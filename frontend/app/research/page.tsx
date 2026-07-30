import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Research & Methodology — Smart Road Guardian AI X",
  description:
    "How the system works, what prior work it improves on, and the evidence — a predictive, VRU-first, explainable transportation risk platform for Indian roads.",
};

/** Research / methodology page.
 *
 * The rule for every line here is the same as the landing page: each claim is
 * one the repo can defend. Prior-work descriptions are the published rules
 * (iRAD's crash threshold, MoRTH's black-spot definition); every number is
 * either a cited MoRTH figure or a measured output reproducible from the repo
 * (`ai.blackspot.report`, `train_road_damage --evaluate`). The road-damage
 * detector is positioned as a working component with a measured mAP, NOT as a
 * benchmark winner — overclaiming there would be the fastest way to lose a
 * reviewer. The limitations section is deliberately prominent: stating what is
 * rule-based, simulated, or unfinished is a research strength, not a weakness.
 */

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="text-sm font-bold tracking-tight text-slate-50">
          Smart Road Guardian <span className="text-sky-400">AI X</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/" className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200">
            Home
          </Link>
          <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200">
            Live dashboard
          </Link>
          <a href="https://github.com/adityaayushman/TRIE" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100">
            Source
          </a>
        </nav>
      </div>
    </header>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-400">{children}</p>;
}

/** A contribution: what exists today, what this does differently, the evidence. */
function Contribution({
  index,
  title,
  claim,
  prior,
  approach,
  evidence,
  caveat,
}: {
  index: string;
  title: string;
  claim: string;
  prior: string;
  approach: string;
  evidence: React.ReactNode;
  caveat?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-900/50 p-6 sm:p-7">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-sky-400">{index}</span>
        <h3 className="text-lg font-semibold text-slate-50">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{claim}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Prior work</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{prior}</p>
        </div>
        <div className="rounded-xl border border-sky-900/50 bg-sky-950/20 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-sky-400">This system</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{approach}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-400">Evidence</p>
        <div className="mt-1.5 text-xs leading-relaxed text-slate-400">{evidence}</div>
      </div>

      {caveat && (
        <p className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[0.7rem] leading-relaxed text-amber-200/80">
          <span className="font-semibold">Honest limit:</span> {caveat}
        </p>
      )}
    </div>
  );
}

const PERCEPTION_ROWS = [
  {
    module: "Road-damage detection",
    model: "YOLOv11s, fine-tuned on RDD2022 India",
    measured: "mAP50 33.0% (alligator crack 57.7%, pothole 44.3%)",
    honesty: "A working, measured detector — not a benchmark winner. Positioned as a component.",
  },
  {
    module: "Road-user perception",
    model: "YOLOv11, COCO-pretrained",
    measured: "Vehicles / two-wheelers / pedestrians, kept as separate classes",
    honesty: "COCO has no auto-rickshaw class; a real baseline, run on recorded Indian footage.",
  },
  {
    module: "Driver monitoring",
    model: "MediaPipe FaceLandmarker",
    measured: "EAR / PERCLOS drowsiness, head-pose distraction",
    honesty: "Runs only where a cabin camera exists — dropped, not assumed, otherwise.",
  },
];

const LIMITATIONS = [
  {
    label: "Risk fusion is rule-based",
    detail: "The TRIE fusion is a transparent weighted model, not a learned one. A learned replacement is the clearest next step — but the rules are auditable, which a black box is not.",
  },
  {
    label: "Black-spot lead-time is simulated",
    detail: "The 7-day-vs-iRAD result is simulated against iRAD's own published rule, not yet validated against MoRTH's actual published black-spot list. That retrospective validation is the highest-value next experiment.",
  },
  {
    label: "Road-damage detector is a component, not SOTA",
    detail: "mAP50 33.0%, and training stopped at epoch 55/60 while still improving. The CRDDC'2022 challenge scored on F1, so numbers aren't directly comparable; this is a working detector, not a claim to beat the leaderboard.",
  },
  {
    label: "Risk scores are point estimates",
    detail: "No calibrated uncertainty yet. Adding confidence bands — especially reflecting unobserved factors — is a planned, reviewer-relevant upgrade.",
  },
];

const REFERENCES = [
  {
    cite: "Ministry of Road Transport & Highways (MoRTH), Government of India.",
    work: "Road Accidents in India — annual report.",
    note: "Fatality counts, VRU share (two-wheelers, pedestrians), and the national black-spot programme.",
  },
  {
    cite: "MoRTH / NIC.",
    work: "iRAD (integrated Road Accident Database) & e-DAR (electronic Detailed Accident Report).",
    note: "The reactive black-spot rule: a ~500m stretch flagged after 5 fatal/grievous crashes or 10 fatalities in 3 years.",
  },
  {
    cite: "Arya, Maeda, Kumar Ghosh, Toshniwal, Sekimoto, et al. (2022).",
    work: "RDD2022: A multi-national road damage dataset for automatic road-damage detection.",
    note: "The Indian split and D00/D10/D20/D40 damage taxonomy used to fine-tune the detector.",
  },
  {
    cite: "Wilson, E. B. (1927).",
    work: "Probable inference, the law of succession, and statistical inference.",
    note: "The Wilson score lower bound used to rank black-spot candidates so a thinly-observed cell cannot top a well-attested one.",
  },
];

export default function ResearchPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Header />

      {/* Thesis */}
      <section className="mx-auto max-w-5xl px-5 pb-14 pt-16">
        <Kicker>Research & methodology</Kicker>
        <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-4xl">
          A predictive, VRU-first, explainable risk system for the road India actually has
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-400">
          The contribution is not a better object detector — it is a different system design.
          Conventional road-safety tooling is <span className="text-slate-200">reactive</span>{" "}
          (it acts after crashes), <span className="text-slate-200">occupant-centric</span>{" "}
          (it scores the person in the car), and <span className="text-slate-200">opaque</span>{" "}
          (a single number). On Indian roads — unmarked lanes, two-wheelers outnumbering cars,
          and the exposed outnumbering the enclosed — all three assumptions fail. This system
          inverts each one, and every claim below is either a cited figure or a measured output
          reproducible from the open-source repository.
        </p>
      </section>

      {/* The problem */}
      <section className="border-y border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <Kicker>The gap</Kicker>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">
            Three structural mismatches in existing work
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              {
                n: "1,77,175",
                l: "road deaths in India, 2024 (MoRTH)",
                b: "Reactive systems flag danger only after a body count accrues. Prevention needs a leading indicator, not a lagging one.",
              },
              {
                n: "66.8%",
                l: "were two-wheeler riders (46.2%) or pedestrians (20.6%) — MoRTH",
                b: "ADAS scores risk to the occupant. Two-thirds of the dead have no metal around them at all.",
              },
              {
                n: "13,795",
                l: "black spots identified 2016–22; ~5,036 treated (MoRTH)",
                b: "Identification is slow and crash-driven. The backlog is a direct cost of a reactive definition.",
              },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
                <p className="text-3xl font-bold tabular-nums text-slate-50">{s.n}</p>
                <p className="mt-1.5 text-[0.7rem] leading-snug text-slate-500">{s.l}</p>
                <p className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contributions */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <Kicker>What is new</Kicker>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">Three contributions</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          Each is stated as what prior work does, what this system does differently, and the
          evidence — with the honest limit named where one exists.
        </p>

        <div className="mt-8 space-y-5">
          <Contribution
            index="01"
            title="Predictive black-spot discovery"
            claim="Flag a dangerous stretch of road before it produces a crash record, instead of after."
            prior="India's iRAD/e-DAR flags a ~500m stretch only after five fatal or grievous crashes, or ten fatalities, in three years. A location must kill people before it earns the label — the identification is fundamentally reactive."
            approach="The same 500m unit is nominated from near-misses, not crashes: exposure-normalised (every vehicle pass is the denominator) and ranked by a Wilson score lower bound, so a stretch can be flagged before anyone dies and a barely-observed cell cannot outrank a well-attested one."
            evidence={
              <>
                Simulated against iRAD&apos;s own rule using the real discovery engine, median of 15 runs:{" "}
                <span className="text-slate-200">7 days to discovery</span> versus{" "}
                <span className="text-slate-200">170 days</span> for iRAD under a generous
                1-in-20 near-miss-to-crash rate, and <span className="text-slate-200">never</span>{" "}
                (within the 3-year window) at 1-in-1000. Reproducible with{" "}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">python -m ai.blackspot.report</code>.
              </>
            }
            caveat="Validated against iRAD's rule, not yet against MoRTH's published black-spot list. That retrospective test is the next experiment."
          />

          <Contribution
            index="02"
            title="VRU-first risk weighting"
            claim="Weight risk by who is actually exposed, not by who is enclosed in the vehicle."
            prior="Conventional ADAS and collision-warning systems model risk to the occupant — time-to-collision for the car, the driver's alertness, the ego-vehicle's trajectory."
            approach="Two-wheeler riders and pedestrians are treated as first-class, weighted for their exposure. A car moving through a crowd of motorcycles reads as dangerous however alert its driver is, because the people most likely to die are the ones the ego-centric model never scores."
            evidence={
              <>
                Perception keeps two-wheelers a separate class from cars end-to-end (COCO
                classes are remapped onto a VRU-aware taxonomy in{" "}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">ai/perception</code>),
                and the fusion applies the exposure weighting the MoRTH fatality split
                (66.8% VRU) justifies. Visible live on the Traffic Analytics and Vehicle
                Intelligence pages, where a motorcycle-packed lane reads as congested and
                lethal rather than empty.
              </>
            }
          />

          <Contribution
            index="03"
            title="Explainability that adapts to the road"
            claim="Every score decomposes into named, auditable factors — and a factor with no sensor is dropped, never scored as safe."
            prior="Risk is typically a single opaque number, and missing inputs are implicitly treated as benign (no lane-departure signal reads as 'in lane'), which silently understates risk on exactly the roads that lack markings."
            approach="The fusion is a transparent additive model: the score decomposes into per-factor shares (a causal chain, not a black box), and an unobserved factor — lane drift where there are no lane markings, distraction where there is no cabin camera — is removed and its weight redistributed across what is observed, rather than assumed absent."
            evidence={
              <>
                The dashboard renders the contributing-factor breakdown, the primary cause, the
                predicted event, and the list of factors explicitly marked{" "}
                <span className="text-slate-200">not observed</span> for every assessment. The
                same status is documented, not hidden, in the Settings model table.
              </>
            }
            caveat="The fusion weights are a rule-based model today, not learned. Auditable by design, but a learned replacement is the clearest rigor upgrade."
          />
        </div>
      </section>

      {/* Benchmarks */}
      <section className="border-y border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <Kicker>Evidence in one place</Kicker>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">Benchmarks</h2>

          {/* Lead-time comparison */}
          <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
            <p className="text-sm font-semibold text-slate-200">Black-spot discovery: time to flag a dangerous stretch</p>
            <p className="mt-1 text-xs text-slate-500">Lower is better. Simulated against iRAD&apos;s published rule.</p>
            <div className="mt-5 space-y-3">
              {[
                { label: "This system (near-miss discovery)", days: 7, display: "7 days", tone: "sky", pct: 4 },
                { label: "iRAD, 1-in-20 crash conversion", days: 170, display: "170 days", tone: "slate", pct: 55 },
                { label: "iRAD, 1-in-1000 conversion", days: 1096, display: "never (within 3 yrs)", tone: "slate", pct: 100 },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div>
                    <p className="mb-1 text-xs text-slate-400">{row.label}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full ${row.tone === "sky" ? "bg-sky-500" : "bg-slate-600"}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-right text-xs font-semibold tabular-nums ${row.tone === "sky" ? "text-sky-400" : "text-slate-400"}`}>
                    {row.display}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Road damage per-class */}
          <div className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
            <p className="text-sm font-semibold text-slate-200">Road-damage detector: measured mAP on held-out Indian images</p>
            <p className="mt-1 text-xs text-slate-500">
              YOLOv11s fine-tuned on RDD2022 India, 1,542 val images. Stated as a component metric, not a leaderboard claim.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-wide text-slate-600">
                    <th className="pb-2 font-medium">Damage class</th>
                    <th className="pb-2 pr-3 text-right font-medium">Val instances</th>
                    <th className="pb-2 text-right font-medium">mAP@50</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { c: "Alligator crack", n: 394, m: 57.7 },
                    { c: "Pothole", n: 634, m: 44.3 },
                    { c: "Longitudinal crack", n: 295, m: 28.0 },
                    { c: "Transverse crack", n: 17, m: 1.9 },
                    { c: "Overall", n: 1340, m: 33.0, bold: true },
                  ].map((r) => (
                    <tr key={r.c} className={`border-t border-slate-800/70 ${r.bold ? "font-semibold text-slate-100" : "text-slate-300"}`}>
                      <td className="py-1.5">{r.c}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">{r.n}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.m.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
              Alligator cracks and potholes — the damage that actually threatens a two-wheeler —
              detect well; transverse cracks barely register because the split holds only 17 of
              them. COCO-pretrained weights have no pothole class at all, so this is the
              difference between guessing and detecting. Reproduce with{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">python -m ai.training.train_road_damage --evaluate</code>.
            </p>
          </div>
        </div>
      </section>

      {/* Perception components */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <Kicker>The stack, stated honestly</Kicker>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">Perception components</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          These are real models doing real inference. None of them is claimed to be
          state-of-the-art; each is a defensible baseline that feeds the system-level
          contributions above.
        </p>
        <div className="mt-6 space-y-3">
          {PERCEPTION_ROWS.map((row) => (
            <div key={row.module} className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-100">{row.module}</p>
                <p className="font-mono text-[0.7rem] text-sky-400/80">{row.model}</p>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">{row.measured}</p>
              <p className="mt-1 text-[0.7rem] text-slate-500">{row.honesty}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Limitations */}
      <section className="border-y border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <Kicker>Where it is honest about itself</Kicker>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">Limitations & future work</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
            Naming these is deliberate. A system that hides what is rule-based, simulated, or
            unfinished cannot be trusted on what it claims to have measured.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {LIMITATIONS.map((lim) => (
              <div key={lim.label} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {lim.label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{lim.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reproducibility */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <Kicker>Reproducibility</Kicker>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">Every number is runnable</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          The figures on this page are not screenshots of a claim; they regenerate from the
          open-source code.
        </p>
        <div className="mt-6 space-y-2.5 font-mono text-xs">
          {[
            { cmd: "python -m ai.blackspot.report", what: "black-spot lead-time vs iRAD" },
            { cmd: "python -m ai.training.train_road_damage --evaluate", what: "per-class road-damage mAP" },
            { cmd: "python -m ai.demo.build_traffic_demo", what: "perception + traffic on recorded footage" },
          ].map((c) => (
            <div key={c.cmd} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5">
              <span className="text-sky-300">$ {c.cmd}</span>
              <span className="text-slate-600">— {c.what}</span>
            </div>
          ))}
        </div>
      </section>

      {/* References */}
      <section className="border-t border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <Kicker>References</Kicker>
          <ol className="mt-5 space-y-3">
            {REFERENCES.map((ref, i) => (
              <li key={ref.work} className="flex gap-3 text-xs leading-relaxed">
                <span className="font-mono text-slate-600">[{i + 1}]</span>
                <span className="text-slate-400">
                  <span className="text-slate-300">{ref.cite}</span> <span className="italic">{ref.work}</span>{" "}
                  <span className="text-slate-500">{ref.note}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA footer */}
      <footer className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-10">
          <div>
            <p className="text-sm font-semibold text-slate-200">See it running</p>
            <p className="mt-1 text-xs text-slate-500">The live dashboard renders every claim above against real data.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard" className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500">
              Open the dashboard
            </Link>
            <a href="https://github.com/adityaayushman/TRIE" className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100">
              Read the source
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
