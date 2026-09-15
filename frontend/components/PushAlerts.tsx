"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { currentPushState, disablePushAlerts, enablePushAlerts } from "@/lib/push";

type Status = "checking" | "unsupported" | "signed-out" | "off" | "on" | "denied" | "no-vapid-key" | "error";

/** The real human-facing alerting loop, live in the settings page: a genuine
 * browser/OS push notification (RFC 8291/8292 Web Push, delivered by Chrome's
 * FCM or Firefox's autopush — not a mock) when a HIGH/CRITICAL assessment is
 * produced for this account, even with the dashboard tab closed. Backed by
 * app/services/push.py + app/api/routes/alerts.py. */
export function PushAlerts() {
  const { account } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!account) {
        if (!cancelled) setStatus("signed-out");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      const state = await currentPushState();
      if (!cancelled) setStatus(state === "subscribed" ? "on" : "off");
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [account]);

  async function toggle() {
    setBusy(true);
    try {
      if (status === "on") {
        await disablePushAlerts();
        setStatus("off");
      } else {
        const result = await enablePushAlerts();
        setStatus(result === "ready" ? "on" : (result as Status));
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  const copy: Record<Status, string> = {
    checking: "Checking this browser…",
    unsupported: "This browser doesn't support push notifications.",
    "signed-out": "Sign in to enable real device alerts.",
    off: "Off — a HIGH/CRITICAL assessment updates the dashboard only while it's open.",
    on: "On — a HIGH/CRITICAL assessment reaches this device as a real notification, even if the tab is closed.",
    denied: "Notification permission was denied in the browser. Re-enable it in your browser's site settings.",
    "no-vapid-key": "This deployment has no push keypair configured (see backend/app/vapid_keys.py) — push alerts are unavailable, not broken.",
    error: "Something went wrong subscribing — try again.",
  };

  const canToggle = status === "on" || status === "off";

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-slate-200">Real device alerts</p>
        <p className="mt-0.5 max-w-md text-[0.7rem] leading-relaxed text-slate-500">{copy[status]}</p>
      </div>
      {canToggle && (
        <button
          onClick={toggle}
          disabled={busy}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            status === "on"
              ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-600"
              : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          {busy ? "…" : status === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
