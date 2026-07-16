"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

/** Shared by /login and /register — the two differ only in the fields shown
 * and which call they make, so one component keeps their behaviour (error
 * handling, redirect, disabled state) from drifting apart. */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const { signIn, register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        await register(email, password, organisation);
      } else {
        await signIn(email, password);
      }
      router.push("/dashboard");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-sm font-bold tracking-tight text-slate-50">
          Smart Road Guardian <span className="text-sky-400">AI X</span>
        </Link>

        <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-7">
          <h1 className="text-lg font-semibold text-slate-100">
            {isRegister ? "Create an account" : "Sign in"}
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {isRegister
              ? "An account is only needed to submit telemetry. Reading the dashboard, history and black spots never requires one."
              : "Welcome back."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-400">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-600"
              />
            </label>

            {isRegister && (
              <label className="block">
                <span className="mb-1.5 block text-xs text-slate-400">
                  Organisation <span className="text-slate-600">(optional)</span>
                </span>
                <input
                  value={organisation}
                  onChange={(e) => setOrganisation(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-600"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-400">Password</span>
              <input
                type="password"
                required
                // Mirrors the backend's own bounds (app/auth/security.py):
                // 8 minimum, and 72 because bcrypt silently ignores anything
                // past that rather than failing.
                minLength={isRegister ? 8 : undefined}
                maxLength={isRegister ? 72 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-600"
              />
              {isRegister && (
                <span className="mt-1 block text-[0.65rem] text-slate-600">
                  At least 8 characters.
                </span>
              )}
            </label>

            {error && (
              <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            {isRegister ? "Already have an account? " : "No account? "}
            <Link
              href={isRegister ? "/login" : "/register"}
              className="font-medium text-sky-400 transition hover:text-sky-300"
            >
              {isRegister ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-slate-600">
          <Link href="/dashboard" className="transition hover:text-slate-400">
            Or browse the dashboard without an account →
          </Link>
        </p>
      </div>
    </main>
  );
}
