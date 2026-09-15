// Service worker for TRIE's real alerting loop (Web Push, RFC 8291/8292).
// Registered by lib/push.ts. This is what makes a HIGH/CRITICAL risk
// assessment reach a signed-in user as a genuine OS-level notification even
// with the dashboard tab closed — not a mock, not a toast confined to an open
// tab. The backend (app/services/push.py) sends the encrypted payload; this
// file only has to decode it and show it.

self.addEventListener("push", (event) => {
  let data = { title: "TRIE alert", body: "Elevated road risk detected.", url: "/dashboard/live" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_err) {
    // Non-JSON payload (shouldn't happen — the backend always sends JSON) —
    // fall back to the default text above rather than throwing away the push.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: data.url || "/dashboard/live" },
      tag: "trie-risk-alert",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard/live";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
