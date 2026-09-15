"use client";

import { API_URL } from "./api";

const TOKEN_KEY = "trie.token"; // must match lib/auth.tsx and lib/api.ts

function token(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** VAPID public keys arrive base64url (RFC 4648 §5); PushManager wants a
 * Uint8Array of the raw bytes. Browsers have no built-in base64url decoder. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushSupport = "unsupported" | "no-vapid-key" | "denied" | "ready";

/** Whether this browser + deployment can do real push at all, before
 * bothering the user with a permission prompt. */
export function pushCapability(): "unsupported" | "checking" {
  if (typeof window === "undefined") return "checking";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return supported ? "checking" : "unsupported";
}

async function fetchVapidPublicKey(): Promise<{ publicKey: string; enabled: boolean }> {
  const res = await fetch(`${API_URL}/alerts/vapid-public-key`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /alerts/vapid-public-key failed: ${res.status}`);
  const body = await res.json();
  return { publicKey: body.public_key, enabled: body.enabled };
}

/** Full opt-in flow: register the service worker, ask OS/browser permission,
 * subscribe with this deployment's VAPID key, and hand the subscription to
 * the backend. Requires the user to be signed in (subscriptions are
 * per-account, same as POST /risk/assess). Returns the current state so the
 * calling component can render it without maintaining parallel logic. */
export async function enablePushAlerts(): Promise<PushSupport> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (!token()) return "unsupported"; // caller should gate on sign-in before calling this

  const { publicKey, enabled } = await fetchVapidPublicKey();
  if (!enabled || !publicKey) return "no-vapid-key";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // TS's lib.dom PushSubscriptionOptionsInit wants BufferSource; the
      // ArrayBufferLike vs ArrayBuffer generic mismatch here is a typing
      // strictness quirk, not a runtime one — Uint8Array is a valid
      // BufferSource at every browser this code actually runs in.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const body = subscription.toJSON();
  const res = await fetch(`${API_URL}/alerts/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ endpoint: body.endpoint, keys: body.keys }),
  });
  if (!res.ok) throw new Error(`POST /alerts/subscribe failed: ${res.status}`);
  return "ready";
}

/** Reverses enablePushAlerts: unregisters the subscription with the browser's
 * push service AND tells the backend to stop targeting it. */
export async function disablePushAlerts(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await fetch(`${API_URL}/alerts/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch(() => {
    // Best-effort: the browser-side unsubscribe above already stops delivery
    // even if this cleanup call fails (e.g. offline), so don't surface it.
  });
}

/** Current subscription state, for rendering the toggle on mount without
 * re-running the whole enable flow (which would re-prompt permission). */
export async function currentPushState(): Promise<"subscribed" | "not-subscribed" | "unsupported"> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return "not-subscribed";
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "subscribed" : "not-subscribed";
}
