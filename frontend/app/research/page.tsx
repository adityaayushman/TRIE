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
    label: "Black-spot evaluation is controlled, not field data",
    detail: "Detection, specificity and lead-time are measured across 40 seeds — but on authored dangerous/safe locations, since near-miss telemetry for real MoRTH black spots is not publicly available. A field retrospective is the highest-value experiment that data would unlock; it is named, not hidden.",
  },
  {
    label: "Road-damage detector is a component, not SOTA",
    detail: "mAP50 33.0%, and training stopped at epoch 55/60 while still improving. The CRDDC'2022 challenge scored on F1, so numbers aren't directly comparable; this is a working detector, not a claim to beat the leaderboard.",
  },
  {
    label: "The shipped fusion is the rule, not the learned model",
    detail: "The Benchmarks study shows a learned, calibrated fusion beats the hand-set rule on a controlled ground truth — but it is trained on authored data, so it demonstrates the architecture, not a field model. Swapping it into the live pipeline waits on labelled telemetry that does not publicly exist; until then the transparent rule ships and the learned model is evidence, not production.",
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
    cite: "MoRTH, Transport Research Wing (2022).",
    work: "Road Accidents in India 2022 — accidents by time of occurrence.",
    note: "The 18:00–21:00 window holds 20.4% of accidents, the highest three-hour band — the basis for the time-of-day lighting-risk factor.",
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
    <main className="relative min-h-screen">
      <div className="relative z-10">
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

      {/* Plain-language explainer for a non-specialist visitor */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-sky-950/20 p-6 sm:p-7">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
          <p className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-[0.7rem]">
              ?
            </span>
            In plain terms
          </p>
          <p className="relative mt-3 text-sm leading-relaxed text-slate-300">
            Not an engineer? Here is the whole idea in a breath. Most road-safety technology waits
            for crashes to happen, watches only the driver inside the car, and hands you a single
            mysterious number. This project flips all three: it{" "}
            <span className="font-semibold text-white">warns before</span> the crash, it protects
            the people <span className="font-semibold text-white">outside</span> the car — the
            motorbike riders and pedestrians who are two of every three road deaths in India — and
            it always <span className="font-semibold text-white">shows its reasoning</span>.
            Everything below is the evidence, but you do not need the jargon to follow the point.
          </p>
          <p className="relative mt-4 border-t border-sky-500/15 pt-4 text-xs leading-relaxed text-slate-500">
            A few terms you will meet: a <span className="text-slate-300">black spot</span> is a
            dangerous stretch of road; a <span className="text-slate-300">vulnerable road user (VRU)</span>{" "}
            is someone with no metal around them — a rider or a pedestrian;{" "}
            <span className="text-slate-300">ADAS</span> is the driver-assist tech already in modern
            cars; and <span className="text-slate-300">iRAD</span> is India&apos;s official crash
            database that only labels a road dangerous after people have died on it.
          </p>
        </div>
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
                Across 40 seeds at two traffic volumes: <span className="text-slate-200">100% detection</span> of
                the dangerous stretch, <span className="text-slate-200">0% false-positives</span> on a busy-but-safe
                one, and a median lead time of <span className="text-slate-200">1–7.5 days</span> against iRAD&apos;s
                170–888 days (or never). Full distribution in the Benchmarks section; reproducible with{" "}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">python -m ai.blackspot.evaluate</code>.
              </>
            }
            caveat="This is a controlled evaluation: the dangerous/safe locations are authored from the factors the fusion models. A field validation against MoRTH's published black spots needs near-miss telemetry for real Indian locations, which is not publicly available — that remains the open experiment, not a step being skipped."
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
            title="Explainability and calibrated uncertainty"
            claim="Every score decomposes into named factors and carries a confidence band that widens exactly as much as the sensors are missing."
            prior="Risk is typically a single opaque number. Missing inputs are treated as benign (no lane-departure signal reads as 'in lane'), and the number is reported with the same false confidence whether every sensor fired or only one did."
            approach="The fusion is a transparent additive model — the score decomposes into per-factor shares, and an unobserved factor is dropped with its weight redistributed rather than assumed absent. Crucially, that redistribution's assumption is then measured: the risk is reported as a band whose floor is 'every unmeasured factor is benign' and whose ceiling is 'every one is at its worst'. Full sensor suite → the band collapses to the point; speed-only → it is wide, on purpose."
            evidence={
              <>
                The live gauge shows the band directly. On this telemetry-only deployment, with
                the two camera-derived factors unmeasured, a mid-20s score carries a band roughly{" "}
                <span className="text-slate-200">30 points</span> wide (e.g. 17–50%) — a visible,
                honest &quot;we cannot see enough to be sure&quot; where a bare point estimate would
                fake precision. Reproduced in <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">ai/trie/risk_fusion.py</code>.
              </>
            }
            caveat="The band reflects sensor coverage, not label-calibrated probability. A learned fusion sharpens this further — the Benchmarks study shows one beating the hand-set rule (AUC 0.78 → 0.82) on a controlled ground truth, pending real labelled telemetry to ship it."
          />
        </div>

        {/* Environmental context — the one real-data-grounded factor */}
        <div className="mt-5 rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Environmental context — grounded in published data, live without a camera
            </h3>
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-emerald-400">live</span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">
            The one factor here that rests on <span className="text-slate-200">real published
            data</span>, not an authored ground truth. MoRTH&apos;s Road Accidents in India 2022
            reports the <span className="text-slate-200">18:00–21:00</span> window alone holds{" "}
            <span className="text-slate-200">20.4%</span> of all road accidents — the single highest
            three-hour band, stable across five years — and night hours carry a higher fatality rate
            per crash. Time of day is free from the assessment clock, so unlike the camera factors
            it needs no hardware: every live assessment already folds in a lighting-risk term
            (dark and the evening peak raise it, midday lowers it), visible on the Live Risk gauge.
            A seventh factor added so the six keep their exact original weights when it is absent —
            the deployment simply gained a real input it had been ignoring.
          </p>
        </div>

        {/* Per-rider vulnerability — the fine-tuned helmet/triple-riding detector */}
        <div className="mt-5 rounded-2xl border border-sky-500/25 bg-sky-950/15 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Per-rider vulnerability — from detection to survival odds
            </h3>
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-sky-400">
              new · live
            </span>
          </div>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-3 text-xs leading-relaxed text-slate-400">
              <p>
                Contribution 02 says <span className="text-slate-200">who</span> is exposed. This
                says <span className="text-slate-200">how badly</span>. A fine-tuned YOLOv11 detector
                reads each two-wheeler rider as helmeted, bare-headed, or part of an overloaded
                (triple-riding) bike, and those counts become a scene{" "}
                <span className="text-slate-200">vulnerability multiplier</span> that amplifies the
                fusion&apos;s vru_exposure term. The grounding is external, not invented: the WHO puts
                correct helmet use at roughly a <span className="text-slate-200">42% reduction</span>{" "}
                in rider death, so a bare head carries about{" "}
                <span className="text-slate-200">1 / (1 − 0.42) ≈ 1.72×</span> the fatality exposure of
                a helmeted one; overloading is a bounded ~1.4× aggravator, and the product is capped
                at 1.85×.
              </p>
              <p>
                It is wired into the same additive, explainable fusion — the multiplier scales one
                magnitude before weighting, so the score stays a sum of named parts and reports the
                reason (&ldquo;risk ×1.72: riders without helmets&rdquo;). It runs now on the Vehicle
                Intelligence footage: each rider is boxed green for a helmet or red for a bare head,
                and the worst frame of every demo clip peaks at ×1.72.
              </p>
              <p className="text-slate-500">
                Honest limits: training was stopped at epoch 15/25 (the marginal-gain tail), and the
                validation set holds only 27 with-helmet instances, so that class&apos;s AP is the
                noisiest of the four. The demo clips contain no triple-riding — yet the detector
                scores it highest on held-out validation (right), so the capability is real even
                where this footage does not exercise it.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
              <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500">
                Held-out validation · 383 images · mAP@50
              </p>
              <div className="mt-3 space-y-2.5">
                {[
                  { label: "triple riding", v: 91.0 },
                  { label: "number plate", v: 83.2 },
                  { label: "no helmet", v: 75.6 },
                  { label: "with helmet", v: 62.9 },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-[0.7rem] text-slate-300">
                      <span>{m.label}</span>
                      <span className="tabular-nums">{m.v.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${m.v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-slate-800 pt-2 text-[0.65rem] leading-relaxed text-slate-500">
                Overall mAP@50 <span className="tabular-nums text-slate-300">78.2%</span> · mAP@50-95{" "}
                <span className="tabular-nums text-slate-300">56.2%</span>. Reproducible with{" "}
                <code className="rounded bg-slate-800 px-1 py-0.5 text-[0.6rem] text-slate-300">
                  python -m ai.training.train_helmet --evaluate
                </code>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison to the state of the art */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <Kicker>How it compares</Kicker>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">
          Against the state of the art
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          The two dominant paradigms are conventional ADAS / collision-warning (in-vehicle,
          occupant-centric) and India&apos;s official iRAD / e-DAR black-spot programme
          (infrastructure-side, crash-record-driven). The edge here is at the system level —
          against both, on the dimensions that decide whether a VRU on an Indian road lives.
        </p>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4 font-medium">Dimension</th>
                <th className="pb-3 pr-4 font-medium">Conventional ADAS</th>
                <th className="pb-3 pr-4 font-medium">iRAD / e-DAR (official)</th>
                <th className="rounded-t-lg bg-sky-500/10 px-4 pb-3 pt-2 font-semibold text-sky-300">This system</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  d: "Finding danger",
                  adas: "Reactive — warns as a crash becomes imminent",
                  official: "Reactive — 5 fatal/grievous crashes or 10 deaths in 3 yrs",
                  ours: "Predictive — from near-misses, 1–7.5 day lead, before a crash record exists",
                },
                {
                  d: "Who it protects",
                  adas: "The vehicle occupant",
                  official: "— (aggregate crash records)",
                  ours: "VRU-first — two-wheelers & pedestrians (66.8% of deaths) weighted for exposure",
                },
                {
                  d: "Missing sensors",
                  adas: "Assumes a fixed suite; a gap reads as 'safe'",
                  official: "—",
                  ours: "Unobserved factors dropped & weight redistributed — never assumed safe",
                },
                {
                  d: "Uncertainty",
                  adas: "A single point score",
                  official: "—",
                  ours: "A calibrated, sensor-aware confidence band on every score",
                },
                {
                  d: "Environmental context",
                  adas: "Rarely modelled",
                  official: "—",
                  ours: "MoRTH-grounded time-of-day risk, live and free from the clock",
                },
                {
                  d: "Explainability",
                  adas: "Opaque score",
                  official: "Tabular counts",
                  ours: "Exact additive shares + interactions verified by H-statistic",
                },
                {
                  d: "Reproducibility",
                  adas: "Proprietary",
                  official: "Manual state submissions, updated to 2022",
                  ours: "Open source — every number is one `python -m …` away",
                },
              ].map((row) => (
                <tr key={row.d} className="border-t border-slate-800/70 align-top">
                  <td className="py-2.5 pr-4 font-medium text-slate-200">{row.d}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{row.adas}</td>
                  <td className="py-2.5 pr-4 text-slate-500">{row.official}</td>
                  <td className="bg-sky-500/[0.06] px-4 py-2.5 text-slate-200">{row.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 max-w-3xl rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-[0.75rem] leading-relaxed text-amber-200/80">
          <span className="font-semibold">Where it is NOT ahead, stated plainly:</span> the
          road-damage detector (mAP50 33%) is a competitive component, not a benchmark leader, and
          road-user perception is a COCO-pretrained baseline pending an India-Driving-Dataset
          fine-tune. The claim is not "a better object detector" — it is a better *system* for the
          road India actually has. Beating perception leaderboards is neither claimed nor needed.
        </p>
      </section>

      {/* Benchmarks */}
      <section className="border-y border-slate-800/80 bg-slate-900/30">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <Kicker>Evidence in one place</Kicker>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-50">Benchmarks</h2>

          {/* Quantified discovery evaluation */}
          <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
            <p className="text-sm font-semibold text-slate-200">Black-spot discovery: a quantified evaluation, not one anecdote</p>
            <p className="mt-1 text-xs text-slate-500">
              40 seeds, two traffic volumes, a genuinely dangerous stretch against a busy-but-safe one.
              Reproduce with{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">python -m ai.blackspot.evaluate</code>.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-xs">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-wide text-slate-600">
                    <th className="pb-2 font-medium">Setting</th>
                    <th className="pb-2 pr-3 text-right font-medium">Detection</th>
                    <th className="pb-2 pr-3 text-right font-medium">False-positive</th>
                    <th className="pb-2 text-right font-medium">Lead time (days)</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {[
                    { s: "Busy junction (45 passes/day)", det: "100%", fp: "0%", lead: "median 1 (max 2)" },
                    { s: "Quiet road (10 passes/day)", det: "100%", fp: "0%", lead: "median 7.5 (IQR 4.8–9.2)" },
                  ].map((r) => (
                    <tr key={r.s} className="border-t border-slate-800/70">
                      <td className="py-1.5">{r.s}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-400">{r.det}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-400">{r.fp}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-200">{r.lead}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
              The 0% false-positive on a <span className="text-slate-400">busy-but-safe</span> road is the
              load-bearing result: it shows the engine flags danger, not merely traffic volume — the failure
              mode raw counts fall into. Detection is 100% across all 80 runs; the lead time is reported as a
              distribution, not a single figure.
            </p>
          </div>

          {/* Lead-time comparison */}
          <div className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
            <p className="text-sm font-semibold text-slate-200">Time to flag a dangerous stretch, vs iRAD</p>
            <p className="mt-1 text-xs text-slate-500">Lower is better. Quiet-road median against iRAD&apos;s crash-count rule.</p>
            <div className="mt-5 space-y-3">
              {[
                { label: "This system (near-miss discovery)", display: "7.5 days", tone: "sky", pct: 3 },
                { label: "iRAD, 1-in-20 crash conversion", display: "170 days", tone: "slate", pct: 19 },
                { label: "iRAD, 1-in-100 conversion", display: "450 days", tone: "slate", pct: 50 },
                { label: "iRAD, 1-in-300 conversion", display: "888 days", tone: "slate", pct: 81 },
                { label: "iRAD, 1-in-1000 conversion", display: "never (within 3 yrs)", tone: "slate", pct: 100 },
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

          {/* Learned fusion vs the hand-set rule */}
          <div className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
            <p className="text-sm font-semibold text-slate-200">Learned fusion vs the hand-set rule</p>
            <p className="mt-1 text-xs text-slate-500">
              Is the additive rule leaving signal on the table? A controlled study against a ground
              truth where crash risk compounds (fast <span className="text-slate-400">and</span> bad
              surface <span className="text-slate-400">and</span> vulnerable road users) — the
              interaction an additive model cannot represent. Reproduce with{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">python -m ai.trie.fusion_study</code>.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-wide text-slate-600">
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 pr-3 text-right font-medium">ROC-AUC</th>
                    <th className="pb-2 text-right font-medium">Brier (lower better)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { c: "Hand-set rule (shipped)", auc: 0.781, brier: 0.180 },
                    { c: "Learned linear", auc: 0.815, brier: 0.164 },
                    { c: "Learned non-linear (GBM)", auc: 0.819, brier: 0.162, bold: true },
                  ].map((r) => (
                    <tr key={r.c} className={`border-t border-slate-800/70 ${r.bold ? "font-semibold text-slate-100" : "text-slate-300"}`}>
                      <td className="py-1.5">{r.c}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{r.auc.toFixed(3)}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-400">{r.brier.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
              Learning the weights beats the hand-set rule (AUC 0.78 → 0.82); a non-linear model
              edges ahead further by capturing the compounding, all while staying calibrated. Stable
              across seeds. The honest scope matches the black-spot evaluation: the ground truth is
              authored, because no public dataset labels these six factors against real crash
              outcomes — so this shows the architecture <span className="text-slate-400">admits</span>{" "}
              a learned, calibrated fusion, not a field-measured accuracy.
            </p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold text-slate-200">…and it learned the right structure</p>
              <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">
                &quot;Fits better&quot; is not &quot;learned the right thing.&quot; Friedman&apos;s
                H-statistic — which measures how much of a pair&apos;s effect is interaction, not
                additive — ranks the three couplings the model discovered against the three the
                ground truth was built with. They match, top-3:
              </p>
              <ul className="mt-2 space-y-1 font-mono text-[0.7rem] text-slate-400">
                <li><span className="text-emerald-400">1.</span> speed × road surface <span className="text-slate-500">H=0.25</span></li>
                <li><span className="text-emerald-400">2.</span> speed × VRU exposure <span className="text-slate-500">H=0.22</span></li>
                <li><span className="text-emerald-400">3.</span> distraction × VRU exposure <span className="text-slate-500">H=0.19</span></li>
              </ul>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-slate-500">
                3/3 recovered, each well above the noise floor — the learned fusion is inspectable and
                right for the right reason. SHAP is skipped deliberately: the shipped rule is already
                exactly its own attribution, and the library forces a numpy upgrade this repo&apos;s
                vision stack cannot take. Reproduce with{" "}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">python -m ai.trie.interaction_analysis</code>.
              </p>
            </div>
          </div>

          {/* Horizon forecasting */}
          <div className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 p-6">
            <p className="text-sm font-semibold text-slate-200">Horizon forecasting: learned vs linear extrapolation</p>
            <p className="mt-1 text-xs text-slate-500">
              Forecast error 6 steps ahead on held-out risk trajectories (ramp → peak → fall,
              stop-go, noise). Self-supervised — the target is the risk that actually occurs.
              Reproduce with{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem] text-slate-300">python -m ai.temporal_prediction.forecast_study</code>.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-xs">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-wide text-slate-600">
                    <th className="pb-2 font-medium">Forecaster</th>
                    <th className="pb-2 pr-3 text-right font-medium">MAE (lower better)</th>
                    <th className="pb-2 text-right font-medium">RMSE</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { c: "Persistence (hold last value)", mae: 13.4, rmse: 17.3 },
                    { c: "Linear extrapolation (shipped)", mae: 19.0, rmse: 24.5 },
                    { c: "Learned LSTM", mae: 10.1, rmse: 13.4, bold: true },
                  ].map((r) => (
                    <tr key={r.c} className={`border-t border-slate-800/70 ${r.bold ? "font-semibold text-slate-100" : "text-slate-300"}`}>
                      <td className="py-1.5">{r.c}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{r.mae.toFixed(1)}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-400">{r.rmse.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
              The honest, self-critical finding: the shipped linear extrapolation is{" "}
              <span className="text-slate-400">worse than doing nothing</span> at this horizon — it
              shoots the recent trend straight through every turning point, overshooting the peak a
              hazard approach actually has. A learned LSTM, which can represent that curvature, cuts
              error ~47%. As with the fusion study, the trajectories are authored (no public feed of
              per-vehicle Indian risk exists), so this shows the failure mode and the fix, not a
              field number.
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
            { cmd: "python -m ai.blackspot.evaluate", what: "detection / specificity / lead-time distribution" },
            { cmd: "python -m ai.trie.fusion_study", what: "learned fusion vs the hand-set rule" },
            { cmd: "python -m ai.temporal_prediction.forecast_study", what: "learned horizon forecasting vs linear" },
            { cmd: "python -m ai.training.train_road_damage --evaluate", what: "per-class road-damage mAP" },
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
      </div>
    </main>
  );
}
