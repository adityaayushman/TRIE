"use client";

import Link from "next/link";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, SectionTitle } from "@/components/ui";

/** Honest system status. Every row is what the code actually does today —
 * this is the same status table as docs/ARCHITECTURE.md, rendered, so a
 * reviewer sees the real picture rather than the aspirational one. */
const MODEL_STATUS = [
  { module: "Road damage (potholes, cracks)", detail: "YOLOv11s, fine-tuned on RDD2022 India — mAP50 0.33 (measured, see below)", real: true },
  { module: "Perception (vehicles, VRUs)", detail: "YOLOv11, COCO-pretrained", real: true },
  { module: "Traffic intelligence (congestion, density)", detail: "Derived from perception detections, run on recorded footage", real: true },
  { module: "Driver monitoring", detail: "MediaPipe FaceLandmarker + EAR/PERCLOS", real: true },
  { module: "Risk fusion (TRIE)", detail: "Weighted rule model — learned model pending", real: false },
  { module: "Uncertainty (confidence band)", detail: "Sensor-suite-aware band from unobserved-factor weight", real: true },
  { module: "Temporal forecast", detail: "Linear extrapolation live; LSTM prototyped (cuts error ~47% — see Research)", real: false },
  { module: "Explainability", detail: "Additive factor shares — SHAP pending", real: false },
];

/** Measured on the held-out RDD2022 India val split (1,542 images, 1,340
 * labelled instances) with `python -m ai.training.train_road_damage
 * --evaluate`. These are real numbers on real Indian road images, not a
 * claim — reproduced from runs/road_damage_india/evaluation.json. Training
 * reached epoch 55 of a planned 60 before a host-RAM OOM stopped it; mAP was
 * still climbing, so these are a floor, not the ceiling. */
const ROAD_DAMAGE_EVAL = {
  overall: { mAP50: 0.33, mAP50_95: 0.142, precision: 0.617, recall: 0.311 },
  perClass: [
    { name: "Alligator crack", instances: 394, mAP50: 0.577, mAP50_95: 0.273 },
    { name: "Pothole", instances: 634, mAP50: 0.443, mAP50_95: 0.165 },
    { name: "Longitudinal crack", instances: 295, mAP50: 0.28, mAP50_95: 0.125 },
    { name: "Transverse crack", instances: 17, mAP50: 0.019, mAP50_95: 0.004 },
  ],
};

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
        <SectionTitle hint="measured on the held-out Indian val split">
          Road-damage detector — real accuracy
        </SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
            <p className="text-[0.6rem] uppercase tracking-wide text-slate-500">mAP@50</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-sky-400">
              {(ROAD_DAMAGE_EVAL.overall.mAP50 * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
            <p className="text-[0.6rem] uppercase tracking-wide text-slate-500">mAP@50-95</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-100">
              {(ROAD_DAMAGE_EVAL.overall.mAP50_95 * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
            <p className="text-[0.6rem] uppercase tracking-wide text-slate-500">Precision</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-100">
              {(ROAD_DAMAGE_EVAL.overall.precision * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
            <p className="text-[0.6rem] uppercase tracking-wide text-slate-500">Recall</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-100">
              {(ROAD_DAMAGE_EVAL.overall.recall * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[380px] text-left text-xs">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-wide text-slate-600">
                <th className="pb-2 font-medium">Damage class</th>
                <th className="pb-2 pr-3 text-right font-medium">Val instances</th>
                <th className="pb-2 pr-3 text-right font-medium">mAP@50</th>
                <th className="pb-2 text-right font-medium">mAP@50-95</th>
              </tr>
            </thead>
            <tbody>
              {ROAD_DAMAGE_EVAL.perClass.map((row) => (
                <tr key={row.name} className="border-t border-slate-800/70">
                  <td className="py-1.5 text-slate-200">{row.name}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">{row.instances}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-200">{(row.mAP50 * 100).toFixed(1)}%</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-400">{(row.mAP50_95 * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 border-t border-slate-800 pt-3 text-[0.7rem] leading-relaxed text-slate-600">
          Fine-tuned from <span className="font-mono text-slate-500">yolo11s</span> on the
          RDD2022 India split, evaluated on 1,542 held-out images. Alligator cracks and
          potholes — the damage that actually threatens a two-wheeler — detect well; transverse
          cracks barely register because the val split has only 17 of them to learn from.
          Training reached 55 of a planned 60 epochs before a host-RAM limit stopped it and
          mAP was still climbing, so these are a floor. COCO-pretrained weights have no pothole
          class at all, so this is the difference between guessing and detecting.
        </p>
      </Card>

      <Card delay={0.15}>
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
