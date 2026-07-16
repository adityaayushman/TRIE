import Link from "next/link";

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
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="text-sm font-bold tracking-tight text-slate-50">
            Smart Road Guardian <span className="text-sky-400">AI X</span>
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              Live demo
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-400">
          Predict. Explain. Prevent.
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-50 sm:text-5xl">
          Road safety that acts{" "}
          <span className="text-sky-400">before</span> the crash
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
          An explainable transportation risk platform built for Indian roads — where lanes are
          often unmarked, two-wheelers outnumber cars, and the people most likely to die are
          the ones a conventional ADAS never looks at.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            Open the live dashboard
          </Link>
          <a
            href="https://github.com/adityaayushman/TRIE"
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
          >
            View the source
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-600">
          No account needed to look around — one is only required to submit telemetry.
        </p>
      </section>

      <section className="border-y border-slate-800/80 bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-50 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs leading-snug text-slate-500">{stat.label}</p>
              <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-slate-700">
                {stat.source}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-50">
          Built for the road it actually runs on
        </h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6"
            >
              <h3 className="text-sm font-semibold text-slate-100">{pillar.title}</h3>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-400">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

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
        </div>
      </section>

      <footer className="border-t border-slate-800/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <p className="text-xs text-slate-600">
            Smart Road Guardian AI X — an explainable transportation intelligence platform.
          </p>
          <div className="flex gap-4 text-xs text-slate-500">
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
