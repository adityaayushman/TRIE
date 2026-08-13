import Link from "next/link";
import { HeroScene } from "@/components/HeroScene";
import { Reveal } from "@/components/Reveal";
import { ICONS, IconName } from "@/components/icons";

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

/** Plain-language, no-jargon walkthrough for a first-time visitor: what the
 * system does, in four concrete steps anyone can follow. */
const HOW_STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "live",
    title: "It watches the road",
    body: "The system looks at a road the way a careful person would — counting cars, motorbikes and people on foot, noticing a broken surface, poor light, and how close everyone is to everyone else.",
  },
  {
    icon: "overview",
    title: "It scores the danger — and explains it",
    body: "Everything it sees becomes one live danger score, from 0 to 100. Unlike a black box, it shows you exactly which factors pushed the score up, so the number is something you can trust and act on.",
  },
  {
    icon: "vehicles",
    title: "It protects the most exposed",
    body: "It tilts the danger toward the people most likely to die — the motorbike riders and pedestrians who are two of every three road deaths in India — and even reads which riders have no helmet, because a bare head turns a crash into a fatal one far more often.",
  },
  {
    icon: "blackspots",
    title: "It warns before the crash",
    body: "When the same stretch of road keeps producing near-misses, it flags that place as a black spot — a dangerous stretch — before anyone is actually hurt there, instead of waiting for a crash record.",
  },
];

/** A plain map of what a visitor can actually open and look at, so the dashboard
 * is not a wall of unlabelled tabs. Each links straight to the live page. */
const EXPLORE: { icon: IconName; href: string; title: string; body: string }[] = [
  {
    icon: "live",
    href: "/dashboard/live",
    title: "Live Risk",
    body: "Watch the danger score update in real time, with the reasons broken out factor by factor.",
  },
  {
    icon: "vehicles",
    href: "/dashboard/vehicles",
    title: "Vehicle Intelligence",
    body: "The real detection model on actual street footage, boxing every vehicle, rider and pedestrian — and flagging the riders with no helmet as higher-risk.",
  },
  {
    icon: "traffic",
    href: "/dashboard/traffic",
    title: "Traffic Analytics",
    body: "Congestion and density measured from what the model sees — where a lane full of motorbikes counts as crowded.",
  },
  {
    icon: "blackspots",
    href: "/dashboard/blackspots",
    title: "Black Spots",
    body: "Dangerous stretches nominated from near-misses and mapped, before any crash record exists.",
  },
  {
    icon: "history",
    href: "/dashboard/history",
    title: "Risk History",
    body: "How each vehicle's danger score has trended over time against the system's own thresholds.",
  },
  {
    icon: "overview",
    href: "/dashboard",
    title: "Overview",
    body: "The command centre — every live figure in one place, or honest zeros when the database is empty.",
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-slate-950 to-transparent" />

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

        {/* hero content — staged entrance on load */}
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 pt-16 text-center sm:pt-24">
          <Reveal immediate y={12}>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-sky-300 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
              Predict · Explain · Prevent
            </span>
          </Reveal>
          <Reveal immediate delay={0.08} y={16}>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Road safety that acts
              <br />
              <span className="bg-linear-to-r from-sky-300 via-sky-400 to-cyan-300 bg-clip-text text-transparent">
                before
              </span>{" "}
              the crash
            </h1>
          </Reveal>
          <Reveal immediate delay={0.16} y={16}>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300/90 sm:text-lg">
              An explainable transportation-risk platform built for Indian roads — where lanes are
              often unmarked, two-wheelers outnumber cars, and the people most likely to die are
              the ones a conventional ADAS never looks at.
            </p>
          </Reveal>
          <Reveal immediate delay={0.24} y={16}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_-6px_rgba(56,189,248,0.8)] transition hover:bg-sky-400 hover:shadow-[0_0_40px_-4px_rgba(56,189,248,0.9)]"
              >
                Open the live dashboard
              </Link>
              <Link
                href="/research"
                className="rounded-xl border border-slate-600/70 bg-slate-900/40 px-6 py-3 text-sm font-semibold text-slate-200 backdrop-blur-sm transition hover:border-slate-500 hover:text-white"
              >
                Read the research
              </Link>
            </div>
          </Reveal>
          <Reveal immediate delay={0.32} y={10}>
            <p className="mt-5 text-xs text-slate-400/80">
              No account needed to look around — one is only required to submit telemetry.
            </p>
          </Reveal>
        </div>
      </section>

      <LaneDivider />

      <section className="bg-linear-to-b from-slate-900/40 to-slate-950">
        <Reveal>
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-slate-800/70 border-x border-b border-slate-800/70 lg:grid-cols-4 lg:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="group px-5 py-9 text-center transition-colors hover:bg-slate-900/50">
                <p className="bg-linear-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs leading-snug text-slate-500">{stat.label}</p>
                <p className="mt-1.5 text-[0.6rem] font-medium uppercase tracking-wide text-slate-700">
                  {stat.source}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
            The approach
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold tracking-tight text-white">
            Built for the road it actually runs on
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.1}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-800/80 bg-linear-to-b from-slate-900/80 to-slate-900/40 p-7 transition-all hover:-translate-y-1 hover:border-sky-500/40">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-500/5 blur-2xl transition-colors group-hover:bg-sky-500/10" />
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 font-mono text-sm font-semibold text-sky-300">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-50">{pillar.title}</h3>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-400">{pillar.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <LaneDivider />

      {/* Plain-language walkthrough for a first-time visitor */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
            New here? Start with this
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold tracking-tight text-white">
            How it works, in plain terms
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
            No background needed. Four steps take you from an ordinary road camera to a warning
            that arrives <span className="text-slate-200">before</span> the crash.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((step, i) => {
            const Icon = ICONS[step.icon];
            return (
              <Reveal key={step.title} delay={i * 0.1}>
                <div className="group relative flex h-full flex-col">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 transition group-hover:border-sky-400/60 group-hover:bg-sky-500/20">
                      <Icon size={20} />
                    </span>
                    <span className="font-mono text-2xl font-bold text-slate-700 transition group-hover:text-slate-600">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-50">{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <LaneDivider />

      {/* A plain map of the live pages, so the dashboard is not a wall of tabs */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
            What you can explore
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-center text-3xl font-bold tracking-tight text-white">
            Everything is live and open to look at
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
            No account needed to explore — one is only required to submit your own telemetry. Each
            page below runs on real engine output. Open any of them.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORE.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <Reveal key={item.title} delay={(i % 3) * 0.08}>
                <Link
                  href={item.href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-linear-to-b from-slate-900/80 to-slate-900/40 p-6 transition-all hover:-translate-y-1 hover:border-sky-500/40"
                >
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-500/5 blur-2xl transition-colors group-hover:bg-sky-500/10" />
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300">
                      <Icon size={18} />
                    </span>
                    <span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-sky-400">
                      →
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-slate-50">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.body}</p>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <LaneDivider />

      <section className="border-t border-slate-800/80 bg-slate-900/40">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-400">
              The result
            </p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-50">
              Finding a black spot in days, not years
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
              Simulated against iRAD&apos;s own reactive rule, using the real fusion and
              discovery engines in this repo — reproducible with{" "}
              <code className="rounded-sm bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                python -m ai.blackspot.report
              </code>
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Reveal delay={0}>
              <div className="h-full rounded-2xl border border-sky-900/60 bg-sky-950/30 p-6">
                <p className="text-3xl font-bold tabular-nums text-sky-400">7 days</p>
                <p className="mt-1.5 text-xs text-slate-400">
                  near-miss discovery, median of 15 runs
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <p className="text-3xl font-bold tabular-nums text-slate-300">170 days</p>
                <p className="mt-1.5 text-xs text-slate-500">
                  iRAD, under a generous 1-in-20 crash assumption
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <p className="text-3xl font-bold tabular-nums text-slate-300">never</p>
                <p className="mt-1.5 text-xs text-slate-500">
                  iRAD at 1-in-1000, within its own 3-year window
                </p>
              </div>
            </Reveal>
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
