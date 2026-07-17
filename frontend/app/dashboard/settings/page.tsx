"use client";

import Link from "next/link";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, SectionTitle } from "@/components/ui";

/** Honest system status. Every row is what the code actually does today —
 * this is the same status table as docs/ARCHITECTURE.md, rendered, so a
 * reviewer sees the real picture rather than the aspirational one. */
const MODEL_STATUS = [
  { module: "Road damage (potholes, cracks)", detail: "YOLOv11, fine-tuned on RDD2022 India", real: true },
  { module: "Perception (vehicles, VRUs)", detail: "YOLOv11, COCO-pretrained", real: true },
  { module: "Traffic intelligence (congestion, density)", detail: "Derived from perception detections, run on recorded footage", real: true },
  { module: "Driver monitoring", detail: "MediaPipe FaceLandmarker + EAR/PERCLOS", real: true },
  { module: "Risk fusion (TRIE)", detail: "Weighted rule model — learned model pending", real: false },
  { module: "Temporal forecast", detail: "Linear extrapolation — LSTM pending", real: false },
  { module: "Explainability", detail: "Additive factor shares — SHAP pending", real: false },
];

export default function SettingsPage() {
  const { account, signOut } = useAuth();

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-lg font-semibold text-slate-100">Settings</h1>

      <Card>
        <SectionTitle>Account</SectionTitle>
        {account ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-xs">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-200">{account.email}</dd>
              <dt className="text-slate-500">Organisation</dt>
              <dd className="text-slate-200">{account.organisation || "—"}</dd>
              <dt className="text-slate-500">Member since</dt>
              <dd className="text-slate-200">
                {new Date(account.created_at).toLocaleDateString()}
              </dd>
            </dl>
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              Sign out
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Not signed in.{" "}
            <Link href="/login" className="text-sky-400 hover:text-sky-300">
              Sign in
            </Link>{" "}
            to submit telemetry.
          </p>
        )}
      </Card>

      <Card delay={0.05}>
        <SectionTitle hint="what actually runs today">Model status</SectionTitle>
        <ul className="space-y-2.5">
          {MODEL_STATUS.map((row) => (
            <li key={row.module} className="flex items-start gap-3">
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                  row.real ? "bg-emerald-400" : "bg-amber-400"
                }`}
                title={row.real ? "Real model" : "Rule-based placeholder"}
              />
              <div>
                <p className="text-xs font-medium text-slate-200">{row.module}</p>
                <p className="text-[0.7rem] text-slate-500">{row.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-slate-800 pt-3 text-[0.7rem] leading-relaxed text-slate-600">
          <span className="text-emerald-400">Green</span> runs a real algorithm on real input.{" "}
          <span className="text-amber-400">Amber</span> is an honest rule-based placeholder
          pending a learned model — the reasoning layer is transparent by design, not hidden
          behind a black box.
        </p>
      </Card>

      <Card delay={0.1}>
        <SectionTitle>Connection</SectionTitle>
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-xs">
          <dt className="text-slate-500">API</dt>
          <dd className="break-all font-mono text-slate-300">{API_URL}</dd>
          <dt className="text-slate-500">Docs</dt>
          <dd>
            <a
              href={API_URL.replace("/api/v1", "/docs")}
              className="font-mono text-sky-400 hover:text-sky-300"
            >
              /docs
            </a>
          </dd>
        </dl>
      </Card>
    </div>
  );
}
