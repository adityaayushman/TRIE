# Smart Road Guardian AI X

> **Predict. Explain. Prevent.**

An Explainable Multimodal Edge AI Transportation Intelligence Platform for
real-time accident prevention and causal risk analysis. Full spec and
system architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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

The dashboard's *Run an Assessment* control writes to that public database:
there is no auth, so anyone with the URL can add events. Acceptable for a
demo; not something to leave running unattended.

Every module is wired together end-to-end. Perception (YOLOv11), driver
monitoring (MediaPipe), and road damage detection (classical CV) run real
algorithms on real frames; TRIE fusion, temporal prediction, causal reasoning
and explainability are honest rule-based placeholders pending a learned model.
See "Status" in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the detail.

## Layout

```
ai/          Perception, driver/road/traffic intelligence, TRIE risk fusion,
             temporal prediction, causal reasoning, explainable AI.
             ai/pipeline.py orchestrates all of it end-to-end;
             ai/ingestion/ feeds it frames; ai/cli.py runs it.
backend/     FastAPI service: persists risk events (PostgreSQL) and
             broadcasts them to dashboards over a websocket.
frontend/    Next.js + TypeScript + TailwindCSS + Framer Motion dashboard.
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

Three tabs:

- **Live Risk** — the gauge, the contributing-factor breakdown (bars sum to
  the gauge), what was *not observed*, the causal chain, the temporal
  forecast, and road surface. Seeds from `GET /api/v1/risk/events`, then
  follows the `/api/v1/alerts/ws` websocket, reconnecting with backoff. *Run
  an Assessment* posts telemetry and the whole page updates from the
  broadcast.
- **Risk History** — the per-vehicle risk trend, with the engine's own
  30/55/80 thresholds as reference lines. Per-vehicle because
  `ai/temporal_prediction/` keys its trend by `vehicle_id`.
- **Black Spots** — nominations from `GET /api/v1/risk/blackspots`, ranked by
  Wilson lower bound, routed to Engineering / Enforcement / Education, with
  the evidence thresholds exposed as controls.

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
back into the image unnoticed.

## Deploying

Backend on **Render**, frontend on **Vercel** — split because the backend
needs a persistent process (websockets, and a real runtime for the `ai/`
stack), which Vercel's serverless functions cannot provide.

**Backend.** [`render.yaml`](render.yaml) is a Blueprint: point Render at this
repo (New → Blueprint) and it provisions the Postgres instance and the Docker
web service, healthchecked at `/api/v1/health`. Migrations run on every
container start (see [`backend/Dockerfile`](backend/Dockerfile)). Pushes to
`main` auto-deploy.

**Frontend.** Any Vercel deploy of `frontend/`. The one setting that matters:

```
NEXT_PUBLIC_API_URL=https://<your-backend>/api/v1
```

Two traps worth knowing, both of which cost a deploy cycle here:

- **`NEXT_PUBLIC_*` is inlined at _build_ time.** Setting it as a runtime env
  var does nothing — the value must be present when `next build` runs, as a
  build environment variable or in the build command.
- **The backend image must not install `ai/requirements.txt`.** It has no
  camera, so it runs the telemetry-only pipeline and needs none of
  torch/ultralytics/mediapipe/opencv. Installing them produced a ~2GB image
  that could not start on a 512MB instance — and bought nothing, since the
  output is identical (see `ai/no_camera.py`).

## Next steps

1. **Fine-tune perception on the [India Driving Dataset](https://idd.insaan.iiit.ac.in/)**
   and report mAP against it. The current weights are COCO-pretrained — a
   Western, lane-disciplined, car-dominated distribution with no auto-rickshaw
   class at all. `PerceptionEngine(model_path=...)` exists so that swap is a
   constructor argument, not a rewrite. This is the single biggest gap between
   "runs a real model" and "a defensible accuracy claim on Indian roads".
2. **Replace the rule-based reasoning layer with learned models** — TRIE
   fusion (weights → gradient-boosted trees or an MLP on labelled near-miss
   telemetry), temporal prediction (linear extrapolation → LSTM), causal
   reasoning (rule table → causal DAG), explainability (additive shares →
   SHAP). Keep the `ai/common/types.py` contracts stable and the rest of the
   pipeline keeps working.
3. **Validate black-spot discovery against the official iRAD list.** The
   simulation (`python -m ai.blackspot.report`) measures lead time against a
   swept crash-conversion assumption; the real result is precision/recall
   against MoRTH's published black spots, replaying telemetry from before
   each qualified.
4. Export a trained model via `edge/export_onnx.py` and follow
   `edge/README.md` to deploy it on a Jetson device.

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
- The API has **no authentication or rate limiting**, and `POST /risk/assess`
  writes to the database. Fine for a demo behind an obscure URL; a real
  deployment needs both.
- The forecast, road-hazard detail and unobserved-factor list ride the
  websocket but are **not persisted**, so a dashboard seeded from
  `GET /risk/events` shows them as em dashes until the first live broadcast.
- `next` is on 14.2.35, not the advisory-clean 16.2.10 — `npm audit`'s own
  fix requires that major bump (React 19, likely breaking changes), which
  deserves dedicated test time rather than a quick patch. The 14.2.x line
  still carries several high-severity entries as a result.
- The frontend has **no component tests**; CI covers it with `tsc --noEmit`
  and `next build` only.
