# TRIE — Roadmap to Completion

A prioritised, honest plan from the current state (a working, validated
research platform) to a defensible, publication-ready and field-deployable
system. Every item carries an **effort estimate** and an **owner**, because the
critical-path items are gated on data access and hardware, not on writing more
code.

**Owner legend**
- 🟦 **Repo** — completable in-repo now, no external dependency.
- 🟨 **You** — needs your action (a training run, an account, a credential).
- 🟥 **Partner** — blocked on external data or an institutional partnership.

**Effort** is engineering time for one focused contributor (½d = half a day).

---

## P0 — Publication-critical (decides the venue tier)

| # | Item | Owner | Effort | Notes |
|---|------|-------|--------|-------|
| 0.1 | **Field-validate black-spot discovery on real MoRTH black spots** | 🟥 Partner | 1–2 wk *after* data | The single biggest lever. Converts the most novel claim from *simulation* to *evidence*. Needs near-miss telemetry for known locations — not public. Gated on 0.2. *Partial, negative:* a retrospective test on real NHAI crashes (`ai.trie.blackspot_crash_validation`) found no evidence that lower-severity crashes predict severe ones beyond severe-crash history and volume (ΔAUC 0.000, CI ±0.005; lead time equals a severity-shuffled null). It does not test telemetry near-misses, so 0.1 itself is still open. |
| 0.2 | **Secure a data partnership** (IIT-M/iRAD, TRIPC-IIT-D, WRI India, SaveLIFE, a Smart-City ICCC) | 🟥 Partner | Outreach ongoing | Playbook + email templates already in `docs/OUTREACH.md`. Unblocks 0.1, 3.x. |
| 0.3 | **Run the IDD perception fine-tune** (Kaggle T4) | 🟨 You | ~½d wall-clock | Notebook ready: `ai/training/kaggle_idd_notebook.md`. Closes the "COCO-only perception" caveat. Local machine can't sustain it (6 GB GPU). |

## P1 — Professional completeness (raises reviewer trust; **doable now**)

| # | Item | Owner | Effort | Status |
|---|------|-------|--------|--------|
| 1.1 | **Model cards** for every model | 🟦 Repo | ½d | ✅ Done — `docs/MODEL_CARDS.md` |
| 1.2 | **Dataset datasheets** for every dataset | 🟦 Repo | ½d | ✅ Done — `docs/DATASHEETS.md` |
| 1.3 | **CI: one-command reproduce check** in GitHub Actions | 🟦 Repo | ½d | ✅ Done — `.github/workflows/ci.yml`'s `research-repro` job runs `scripts/check_reproducibility.py` on every push (plus weekly), badge in README. |
| 1.4 | **Frontend accessibility + Lighthouse pass** (a11y labels, contrast, reduced-motion) | 🟦 Repo | 1d | ✅ Done — real Lighthouse audit (not assumed) across all 12 pages, iterated until every one hit a clean 1.0 accessibility score. Fixed: text/button color-contrast failing WCAG AA at this dark theme's actual background shades (`text-slate-500/600/700` → `400`, `bg-sky-500/600` + white text → `700`, ~130 instances), 4 inline links relying on color alone (added underline), a real heading-order gap on `/dashboard/locations` when signed out, unlabelled range sliders in `FusionPlayground`, and a missing favicon. The hero's collision sequence already gated its camera/DOM jolt behind `prefers-reduced-motion`. Left open, lower priority: `font-size` (best-practices, not a11y — this app's compact `text-[0.6rem]` caption/badge language is a deliberate density tradeoff, not addressed here) and `valid-source-maps` (build tooling, not user-facing). |

## P2 — From demo to pilot (needs data, but not a full partnership)

| # | Item | Owner | Effort | Notes |
|---|------|-------|--------|-------|
| 2.1 | **Real telemetry ingestion** (your device's real sensors, not the seeded demo) | 🟦 Repo | ✅ Done | `/dashboard/live` "Live — your device" mode: real GPS speed/heading (Geolocation) + real accelerometer (DeviceMotion) POSTed to `/risk/assess` on a live loop. Honest scope: one real device, not population near-miss telemetry — see its in-page caveat. |
| 2.2 | **Alert delivery loop** (operator/rider notification) | ✅ Repo / 🟨 You (1 step) | ✅ Done | Real Web Push (RFC 8291/8292) — `backend/app/services/push.py`, toggle in `/dashboard/settings`, no SMS/app-store account needed. **Live in production** (VAPID keypair set on Render; `/alerts/vapid-public-key` reports `enabled: true`). To mint a fresh pair: `python -m app.vapid_keys`. A deployment without keys reports `enabled: false` rather than failing. |
| 2.3 | **End-to-end live-score validation** (score vs realised outcomes) | 🟥 Partner | 1 wk *after* data | Currently factor structure is validated, not the live score. Needs outcome-labelled live data. |

## P3 — Product hardening (not research-blocking)

| # | Item | Owner | Effort | Status |
|---|------|-------|--------|--------|
| 3.1 | Role-based access (operator vs admin) | 🟦 Repo | ✅ Done | `role` on `User` (default `operator`), granted once at registration from a `TRIE_ADMIN_EMAILS` allowlist — no promotion endpoint. Gates one real action: `DELETE /risk/events/{id}` (admin-only; 403 for a signed-in operator, 401 signed out). Reads stay public for everyone regardless of role, unchanged. |
| 3.2 | Multi-location / multi-camera scaling | 🟦 Repo | ✅ Done | New `Location` model (name, reference coordinates, who registered it) — `risk_events.location_id` is a nullable FK, so every existing ad-hoc/untagged flow keeps working unchanged. `/dashboard/locations` lists every registered site with a live rollup; `/dashboard/locations/[id]` reuses RiskDashboard/RiskTimeline scoped to just that site. A fixed camera with no GPS of its own inherits the site's registered coordinates on assess. Verified end-to-end with a headless browser against a live local backend (register → create site → tag an assessment → see the rollup and detail page), not just unit tests — caught and fixed a UUID-JSON-serialization bug and a SQLite FK-enforcement gap along the way. |
| 3.3 | Historical analytics export (CSV) | 🟦 Repo | ✅ Done | `/dashboard/history` → "Export CSV" pulls up to 5,000 persisted events and downloads every field the dashboard renders, RFC 4180-quoted. |
| 3.4 | Mobile-responsive dashboard pass | 🟦 Repo | ✅ Done | Playwright audit of all 12 pages at 360 and 390 px, measuring `scrollWidth` against the requested width. Found and fixed three real overflows: `/dashboard` (590 px: a grid item without `min-w-0` defeated its chart's own `overflow-x-auto`), `/dashboard/traffic` (525 px: a 480 px SVG with no scroll container), and a transient one on the landing page (the hero's 14 px impact jolt letting phones scroll sideways for 650 ms; absorbed by an `overflow-x: clip` wrapper). Every page now measures exactly the viewport width. The audit's first version was itself wrong (mobile emulation widens the layout viewport, hiding the overflow) — corrected before trusting it. Not covered: real-device testing, and tap-target size (many compact controls are under 24 px). |

---

## Critical path (what actually gates "done")

```
0.2 Data partnership ──► 0.1 Black-spot field validation ──► 0.3-adjacent: flagship-journal submission
        │
        └──► 2.3 Live-score validation ──► pilot deployment
```

**P1 and P3 are now fully shipped.** The research ceiling (a flagship IEEE journal
such as *T-ITS*) is gated almost entirely on **0.2 → 0.1**: real Indian field
data and one field validation. That is named here as the open experiment, not
papered over — which is itself the project's methodological stance.

## Definition of done, by target

- **Reproducible research artifact (now):** ✅ open code, one-command repro,
  model cards, datasheets, honest limitations. Ready for IEEE Access / a
  reputable IEEE conference with honest scoping.
- **Flagship journal:** + 0.1 black-spot field validation + 0.3 IDD perception.
- **Deployed pilot:** ✅ 2.1 real device telemetry + ✅ 2.2 alert delivery (one
  manual VAPID env-var step to switch on) shipped; + 2.3 live-score
  validation, with a city or research partner.
