import Link from "next/link";
import { HeroScene } from "@/components/HeroScene";

/** Dashed lane-marking divider — the road motif carried between sections. */
function LaneDivider() {
  return (
    <div
      aria-hidden
      className="mx-auto h-px max-w-6xl"
      style={{
        background:
          "repeating-linear-gradient(90deg, rgba(56,189,248,0.35) 0 26px, transparent 26px 52px)",
      }}
    />
  );
}

/** Marketing landing page.
 *
 * Every claim here is one the repo can defend: the MoRTH figures are cited,
 * the iRAD threshold is its published rule, and the lead-time numbers come
 * from `python -m ai.blackspot.report`, which reproduces them from the real
 * engines. Nothing here asserts a trained model or a capability that does
 * not exist — the honest limits live on /dashboard and in the docs.
 */

const STATS = [
  { value: "1,77,175", label: "road deaths in India, 2024", source: "MoRTH" },
  { value: "46.2%", label: "were two-wheeler riders", source: "MoRTH" },
  { value: "20.6%", label: "were pedestrians", source: "MoRTH" },
  { value: "13,795", label: "black spots identified 2016–22; ~5,036 fixed", source: "MoRTH" },
];

const PILLARS = [
  {
    title: "Vulnerable road users are first-class",
    body: "Two-wheeler riders and pedestrians are over two-thirds of Indian road deaths. Conventional ADAS scores the risk to the occupant. This weights the risk to everyone with no metal around them — a car moving through a crowd of motorcycles is dangerous however alert its driver is.",
  },
  {
    title: "The model adapts to the road it is on",
    body: "Lane drift is scored only where lane markings exist, and driver distraction only where a face is visible. Most Indian roads have neither. An unobserved factor is dropped and its weight redistributed — never scored as safe.",
  },
  {
    title: "Danger is found before it kills",
    body: "India's iRAD flags a 500m stretch only after five fatal crashes or ten deaths in three years. People must die before a location earns the label. This nominates the same stretch from near-misses instead.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* Hero — a live 3D road scene behind the pitch */}
      <section className="relative min-h-[94vh] overflow-hidden">
        {/* 3D layer */}
        <div className="absolute inset-0">
          <HeroScene />
        </div>
        {/* legibility + depth gradients over the canvas */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(2,6,23,0.55)_0%,rgba(2,6,23,0.15)_35%,rgba(2,6,23,0.85)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />

        {/* glass nav */}
        <header className="relative z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <span className="text-sm font-bold tracking-tight text-slate-50">
              Smart Road Guardian <span className="text-sky-400">AI X</span>
            </span>
            <nav className="flex items-center gap-1.5">
              <Link href="/research" className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">
                Research
              </Link>
              <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">
                Live demo
              </Link>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_20px_-4px_rgba(56,189,248,0.7)] transition hover:bg-sky-400"
              >
                Get started
              </Link>
            </nav>
          </div>
        </header>

        {/* hero content */}
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 pt-16 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-sky-300 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
            Predict · Explain · Prevent
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Road safety that acts
            <br />
            <span className="bg-gradient-to-r from-sky-300 via-sky-400 to-cyan-300 bg-clip-text text-transparent">
              before
            </span>{" "}
            the crash
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300/90 sm:text-lg">
            An explainable transportation-risk platform built for Indian roads — where lanes are
            often unmarked, two-wheelers outnumber cars, and the people most likely to die are
            the ones a conventional ADAS never looks at.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_-6px_rgba(56,189,248,0.8)] transition hover:bg-sky-400"
            >
              Open the live dashboard
            </Link>
            <Link
              href="/research"
              className="rounded-xl border border-slate-600/70 bg-slate-900/40 px-6 py-3 text-sm font-semibold text-slate-200 backdrop-blur transition hover:border-slate-500 hover:text-white"
            >
              Read the research
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-400/80">
            No account needed to look around — one is only required to submit telemetry.
          </p>
        </div>
      </section>

      <LaneDivider />

      <section className="bg-gradient-to-b from-slate-900/40 to-slate-950">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-slate-800/70 border-x border-b border-slate-800/70 lg:grid-cols-4 lg:divide-y-0">
          {STATS.map((stat) => (
            <div key={stat.label} className="group px-5 py-9 text-center transition-colors hover:bg-slate-900/50">
              <p className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-2 text-xs leading-snug text-slate-500">{stat.label}</p>
              <p className="mt-1.5 text-[0.6rem] font-medium uppercase tracking-wide text-slate-700">
                {stat.source}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
          The approach
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold tracking-tight text-white">
          Built for the road it actually runs on
        </h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-7 transition-all hover:-translate-y-1 hover:border-sky-500/40"
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-500/5 blur-2xl transition-colors group-hover:bg-sky-500/10" />
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 font-mono text-sm font-semibold text-sky-300">
                {i + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-50">{pillar.title}</h3>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-400">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      <LaneDivider />

      <section className="border-t border-slate-800/80 bg-slate-900/40">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-400">
            The result
          </p>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-50">
            Finding a black spot in days, not years
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
            Simulated against iRAD&apos;s own reactive rule, using the real fusion and
            discovery engines in this repo — reproducible with{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
              python -m ai.blackspot.report
            </code>
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-sky-900/60 bg-sky-950/30 p-6">
              <p className="text-3xl font-bold tabular-nums text-sky-400">7 days</p>
              <p className="mt-1.5 text-xs text-slate-400">
                near-miss discovery, median of 15 runs
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-3xl font-bold tabular-nums text-slate-300">170 days</p>
              <p className="mt-1.5 text-xs text-slate-500">
                iRAD, under a generous 1-in-20 crash assumption
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-3xl font-bold tabular-nums text-slate-300">never</p>
              <p className="mt-1.5 text-xs text-slate-500">
                iRAD at 1-in-1000, within its own 3-year window
              </p>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-xs leading-relaxed text-slate-600">
            A methodology validation, not a field trial. The near-miss-to-crash conversion
            rate has no published source, so it is swept across a range rather than assumed —
            discovery leads under every rate tested. Validating against MoRTH&apos;s published
            black-spot list is the next step.
          </p>
          <Link
            href="/research"
            className="mt-6 inline-block text-xs font-medium text-sky-400 transition hover:text-sky-300"
          >
            Read the full methodology, prior-work comparison and benchmarks →
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <p className="text-xs text-slate-600">
            Smart Road Guardian AI X — an explainable transportation intelligence platform.
          </p>
          <div className="flex gap-4 text-xs text-slate-500">
            <Link href="/research" className="transition hover:text-slate-300">
              Research
            </Link>
            <Link href="/dashboard" className="transition hover:text-slate-300">
              Dashboard
            </Link>
            <a
              href="https://trie-backend.onrender.com/docs"
              className="transition hover:text-slate-300"
            >
              API docs
            </a>
            <a
              href="https://github.com/adityaayushman/TRIE"
              className="transition hover:text-slate-300"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
