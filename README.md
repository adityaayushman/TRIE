# Smart Road Guardian AI X

> **Predict. Explain. Prevent.**

An Explainable Multimodal Edge AI Transportation Intelligence Platform for
real-time accident prevention and causal risk analysis. Full spec and
system architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Presenting or
evaluating it? Start with the [presentation kit](docs/PRESENTATION.md) — thesis,
every result, and a five-minute demo script in one page. Writing it up? A working
paper draft (IMRaD, real-data validation, verified citations, honest limitations)
lives at [paper/smart-road-guardian.md](paper/smart-road-guardian.md).

## Live

| | |
|---|---|
| Dashboard | https://trie-dashboard.vercel.app |
| API | https://trie-backend.onrender.com |
| API docs | https://trie-backend.onrender.com/docs |

Both run on free tiers. The backend **sleeps after ~15 minutes idle**, so the
first request after a quiet spell takes ~50s to wake it and the dashboard
briefly shows "cannot reach the backend" before recovering. The free
PostgreSQL instance expires ~30 days after creation and needs recreating.

Reading the dashboard is open to everyone; the *Run an Assessment* control
writes to a shared database, so it requires a (free) account — register or
sign in from the dashboard. Every GET route stays anonymous so a reviewer can
inspect everything without registering.

Every module is wired together end-to-end, and the honest split between what is
a real model and what is a rule is stated on the live **Settings** page and the
**[/research](https://trie-dashboard.vercel.app/research)** page, not hidden:

- **Real models on real input:** road-damage detection (YOLOv11s fine-tuned on
  RDD2022 India, **mAP50 33%** measured on held-out Indian images), perception
  (YOLOv11), driver monitoring (MediaPipe), traffic intelligence, and a
  time-of-day environmental-risk factor grounded in published MoRTH data.
- **Transparent rules, with learned replacements prototyped and benchmarked:**
  TRIE fusion (a learned model beats the hand-set rule 0.78→0.82 AUC in a
  controlled study, and an H-statistic confirms it recovered the right
  interactions), temporal forecast (a learned LSTM cuts error ~47% vs the
  shipped linear extrapolation), plus a sensor-suite-aware **uncertainty band**
  on every score. Each study is one `python -m …` command away — see
  [Reproduce the research](#reproduce-the-research).

## Layout

```
ai/          Perception, driver/road/traffic intelligence, TRIE risk fusion
             (+ uncertainty band), temporal prediction, causal reasoning,
             explainable AI, and environmental context (ai/environment/).
             ai/pipeline.py orchestrates it end-to-end; ai/ingestion/ feeds it
             frames; ai/cli.py runs it. ai/training/ fine-tunes the road-damage
             detector (RDD2022); ai/blackspot/ discovers + evaluates black
             spots; the learned-model studies live beside what they compare to
             (ai/trie/fusion_study.py, ai/trie/interaction_analysis.py,
             ai/temporal_prediction/forecast_study.py); ai/demo/ builds the
             recorded-footage and black-spot demo data.
backend/     FastAPI service: JWT auth, persists risk events (PostgreSQL),
             broadcasts them over a websocket, serves the demo assets.
frontend/    Next.js + TypeScript + TailwindCSS + Framer Motion — a multi-route
             dashboard plus the /research methodology page.
edge/        NVIDIA Jetson / TensorRT / ONNX deployment for the ai/ layer.
docs/        Architecture reference.
```

## Two deployments, two dependency sets

The split matters, and it is why `backend/requirements.txt` and
`ai/requirements.txt` are separate files rather than one:

| | Backend (`backend/`) | Edge (`ai/cli.py`, `ai/ingestion/`) |
|---|---|---|
| Input | telemetry JSON — **never frames** | camera / video frames |
| Needs | `backend/requirements.txt` only | `ai/requirements.txt` (torch, YOLO, MediaPipe, OpenCV) |
| Pipeline | `ai/no_camera.py` telemetry-only | the real vision engines |
| Image size | ~150MB | ~2GB |

`POST /risk/assess` carries no frames, so the backend runs the telemetry-only
pipeline: every camera-dependent factor is reported *unobserved* and dropped
from the score by `ai/trie/`, rather than measured against an image that does
not exist. Perception runs at the edge and sends results on.

## Quickstart

### Everything, via Docker Compose

```bash
docker compose up --build
```
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:3000

### AI pipeline only (no server)

```bash
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r ai/requirements.txt

python -m ai.cli --demo                     # generated frames, no hardware needed
python -m ai.cli --road-video road.mp4 --cabin-video cabin.mp4 --speed 95
python -m ai.cli --road-camera 0 --cabin-camera 1 --stride 5
```
`ai/ingestion/` is the camera-to-pipeline path: frame sources (video file, live
camera, synthetic), timestamp-based road/cabin synchronization, and a runner
that drives `ai/pipeline.py` over the stream. `--stride N` assesses every Nth
frame, for hardware that can't keep up with capture.

### Backend, locally

```bash
pip install -r backend/requirements.txt -r ai/requirements.txt
cd backend
$env:PYTHONPATH = "..;."          # PowerShell; use ..:. on macOS/Linux
alembic upgrade head              # apply the schema — see backend/alembic/
uvicorn app.main:app --reload
```
Requires a running PostgreSQL matching `TRIE_DATABASE_URL` (see
`backend/.env.example`) — `docker compose up db` starts one. The schema is
managed by Alembic, not `create_all`; the Docker image runs `alembic upgrade
head` automatically on every container start (see `backend/Dockerfile`), but
a local run needs it done once by hand, and again after pulling a change
that adds a migration.

### Frontend, locally

```bash
cd frontend
npm install
npm run dev
```
Point it at a backend with `NEXT_PUBLIC_API_URL` (default
`http://localhost:8000/api/v1`). Next.js inlines `NEXT_PUBLIC_*` at **build**
time, so when building an image this must be a build arg, not a runtime env
var — see `frontend/Dockerfile`.

A multi-route SaaS dashboard (landing page, auth, sidebar):

- **Overview** — live counts derived from real telemetry; zero means an empty
  database, not a mock.
- **Live Risk** — the gauge with its **uncertainty band**, the
  contributing-factor breakdown (bars sum to the gauge), what was *not
  observed*, the time-of-day environmental context, the causal chain, temporal
  forecast, and road surface. Seeds from `GET /api/v1/risk/events`, then follows
  the `/api/v1/alerts/ws` websocket. *Run an Assessment* posts telemetry and the
  page updates from the broadcast.
- **Vehicle Intelligence** — the real YOLOv11 detector run over recorded street
  footage: a monitoring wall of feeds with live bounding-box overlays, clearly
  labelled recorded (the deployed API has no camera).
- **Traffic Analytics** — congestion/density from the same recorded footage.
- **Risk History** — the per-vehicle risk trend against the engine's own
  30/55/80 thresholds. Per-vehicle because `ai/temporal_prediction/` keys by
  `vehicle_id`.
- **Black Spots** — a self-contained **map** plus ranked nominations from
  `GET /api/v1/risk/blackspots` (Wilson lower bound, routed to Engineering /
  Enforcement / Education), with a Live / illustrative-sample toggle.
- **Settings** — the honest model-status table, and the road-damage detector's
  measured per-class accuracy.

The separate **[/research](https://trie-dashboard.vercel.app/research)** page is
the methodology write-up: each contribution as prior-work → this-system →
evidence, a benchmarks section, honest limitations, and reproducibility
commands.

### Tests

```bash
pip install -r backend/requirements-dev.txt
pytest
```
Covers the TRIE fusion contract, the end-to-end AI pipeline, frame ingestion,
black-spot discovery and its evaluation, and the risk API (assess → persist →
broadcast → read). The API tests run against SQLite, so no PostgreSQL or
Docker is needed.

```bash
pytest -m "not model"   # the fast suite CI runs on every push
pytest -m model         # the real YOLO/MediaPipe tests: needs the ai/ stack
                        # installed, and fetches sample images on first run
```

`tests/test_no_camera.py` runs in subprocesses with torch/ultralytics/
mediapipe/opencv blocked from `sys.meta_path`, reproducing the deployed
backend's environment — it is what stops the ~2GB dependency stack creeping
back into the image unnoticed. `tests/test_research_studies.py` guards the
headline number of each study below, so the figures the site presents cannot
silently drift.

## Reproduce the research

Every figure on the [/research](https://trie-dashboard.vercel.app/research) page
regenerates from the real engines — no screenshots of a claim. Each needs
`ai/requirements.txt` (adds scikit-learn; torch is already in it):

```bash
# Real-data validation — the premise on 128k real crashes (DfT STATS19)
python -m ai.trie.external_validation      # do the model's factors predict who
                                           # dies? AUC 0.725, VRUs 52% of deaths
python -m ai.trie.statistical_validation   # odds ratios + 95% CIs, interaction
                                           # LR test, calibration (ECE 0.18%),
                                           # leave-one-out ablation
# Detectors
python -m ai.training.train_helmet --evaluate       # helmet/triple-riding mAP (78%)
python -m ai.vru_intelligence.annotate_footage      # rider vulnerability on the clips
python -m ai.training.train_road_damage --evaluate  # per-class road-damage mAP
# Controlled studies (authored ground truth, stated as such)
python -m ai.blackspot.evaluate            # black-spot discovery: detection,
                                           # false-positive rate, lead-time dist.
python -m ai.blackspot.report              # lead-time vs iRAD's crash threshold
python -m ai.trie.fusion_study             # learned fusion vs the hand-set rule
python -m ai.trie.interaction_analysis     # Friedman's H — did it learn the
                                           # right interactions? (3/3, top-3)
python -m ai.temporal_prediction.forecast_study   # LSTM vs linear extrapolation
python -m ai.demo.build_traffic_demo       # perception + traffic on the clips
python -m ai.demo.build_blackspot_demo     # the illustrative black-spot map data
```

The studies against a compounding ground truth (fusion, forecast, interactions)
are **controlled evaluations on authored data**, stated as such on the page: no
public dataset labels these telemetry factors against real Indian crash
outcomes, so they demonstrate the architecture and method, not a field number.
The road-damage mAP and the MoRTH-grounded environmental factor are the parts
that rest on real data.

## Deploying

Backend on **Render**, frontend on **Vercel** — split because the backend
needs a persistent process (websockets, and a real runtime for the `ai/`
stack), which Vercel's serverless functions cannot provide.

**Backend.** [`render.yaml`](render.yaml) is a Blueprint: point Render at this
repo (New → Blueprint) and it provisions the Postgres instance and the Docker
web service, healthchecked at `/api/v1/health`. Migrations run on every
container start (see [`backend/Dockerfile`](backend/Dockerfile)). Pushes to
`main` auto-deploy.

**Frontend.** Deploy `frontend/` with the Vercel CLI, which uploads the real
local tree and aliases the production domain:

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://<your-backend>/api/v1 \
  vercel deploy --prod --build-env NEXT_PUBLIC_API_URL=https://<your-backend>/api/v1
```

Three traps worth knowing, each of which cost a deploy cycle here:

- **`NEXT_PUBLIC_*` is inlined at _build_ time.** Setting it as a runtime env
  var does nothing — the value must be present when `next build` runs, as a
  build environment variable or in the build command.
- **Git auto-deploy needs the project's Root Directory set to `frontend`.**
  The Next.js app lives in a subdirectory; without that setting a push to
  `main` builds from the repo root and fails with "couldn't find a `pages` or
  `app` directory". The CLI command above sidesteps it.
- **The backend image must not install `ai/requirements.txt`.** It has no
  camera, so it runs the telemetry-only pipeline and needs none of
  torch/ultralytics/mediapipe/opencv. Installing them produced a ~2GB image
  that could not start on a 512MB instance — and bought nothing, since the
  output is identical (see `ai/no_camera.py`).

## Done since the first cut

Several original "next steps" are now shipped, each honestly scoped on
[/research](https://trie-dashboard.vercel.app/research):

- **The model's premise is validated on real crash data** — on 128k real DfT
  STATS19 casualties, the factors it weights predict fatal outcomes with
  ROC-AUC 0.725 (95% CI 0.713–0.737); multivariable odds ratios (VRU 3.66,
  speed 2.23/SD, darkness 1.73) with a significant speed×VRU interaction
  (p<1e-9), calibrated (ECE 0.18%). GB not India, so it validates the factor
  *structure*, not the deployment — stated as such. See
  [`paper/smart-road-guardian.md`](paper/smart-road-guardian.md) for the writeup.
- **Per-rider vulnerability is a live feature** — a fine-tuned YOLOv11 helmet /
  triple-riding detector (mAP50 78%) turns each rider into a WHO-grounded
  fatality multiplier wired into the risk fusion, with overlays on the Vehicle
  Intelligence page.
- **Road-damage detection is a real, fine-tuned model** — YOLOv11s on RDD2022
  India, mAP50 33% measured on 1,542 held-out Indian images (was classical CV).
- **The rule-based layers have learned replacements, prototyped and benchmarked**
  — fusion (learned model 0.78→0.82 AUC over the rule, interactions verified by
  H-statistic), temporal forecast (LSTM cuts error ~47%), plus a
  sensor-suite-aware uncertainty band and a MoRTH-grounded environmental factor.
  They are studies, not yet swapped into the live pipeline — see below.
- **Black-spot discovery has a quantified evaluation** — 100% detection, 0%
  false-positives, lead-time distribution vs iRAD (`ai.blackspot.evaluate`).

## Still open

1. **Ship the learned fusion/forecast into the live pipeline.** They are
   benchmarked as studies against a *controlled* ground truth; the blocker to
   deploying them (and to a real field validation of black spots) is the same —
   no public dataset labels these telemetry factors against real Indian crash
   outcomes. `ai/common/types.py` contracts are stable so the swap stays local.
2. **Fine-tune _perception_ (not just road damage) on the [IDD](https://idd.insaan.iiit.ac.in/).**
   Vehicle/VRU weights are still COCO-pretrained — Western, car-dominated, no
   auto-rickshaw class. `PerceptionEngine(model_path=...)` makes the swap a
   constructor argument.
3. **Field-validate black spots against MoRTH's published list** — precision/
   recall replaying real telemetry from before each stretch qualified. Needs
   near-miss telemetry for real locations, which is not publicly available.
4. Export a trained model via `edge/export_onnx.py` and follow `edge/README.md`
   to deploy it on a Jetson.

## Known gaps

- **Telemetry-only risk cannot exceed ~35%.** With no camera, speed is the
  only live factor, and its weight after redistribution is 0.349. That is
  correct behaviour — an unobserved factor is dropped, not assumed safe — but
  it means the deployed API never emits a HIGH assessment, so black-spot
  discovery there needs `near_miss_level=moderate` to nominate anything. Real
  perception at the edge reaches the full range.
- `TemporalPredictionEngine`'s per-vehicle history lives in process memory
  (LRU-capped at 10,000 vehicles), so a restart or a multi-process deployment
  loses trend continuity. Fine for one backend process; a real fleet
  deployment wants that history in a shared store (Redis, or the DB) instead.
- The API has **JWT auth on writes** (register/login, bcrypt, 7-day tokens) but
  **no rate limiting**, and every read route is intentionally anonymous. Fine
  for a demo; a real deployment wants rate limiting and per-account quotas too.
- The forecast, road-hazard detail and unobserved-factor list ride the
  websocket but are **not persisted**, so a dashboard seeded from
  `GET /risk/events` shows them as em dashes until the first live broadcast.
- `next` is on 14.2.35, not the advisory-clean 16.2.10 — `npm audit`'s own
  fix requires that major bump (React 19, likely breaking changes), which
  deserves dedicated test time rather than a quick patch. The 14.2.x line
  still carries several high-severity entries as a result.
- The frontend has **no component tests**; CI covers it with `tsc --noEmit`
  and `next build` only.
