# Smart Road Guardian AI X

> **Predict. Explain. Prevent.**

An Explainable Multimodal Edge AI Transportation Intelligence Platform for
real-time accident prevention and causal risk analysis. Full spec and
system architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

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
The dashboard seeds from `GET /api/v1/risk/events` and then updates live from
the `/api/v1/alerts/ws` websocket, reconnecting with backoff if the backend
goes away. Point it at a backend with `NEXT_PUBLIC_API_URL` (default
`http://localhost:8000/api/v1`).

Next.js inlines `NEXT_PUBLIC_*` at **build** time, so when building an image
this must be passed as a build arg, not a runtime env var — see
`frontend/Dockerfile`.

Until something calls `POST /api/v1/risk/assess`, the dashboard shows a
"waiting for the first assessment" state. To produce one:

```bash
curl -X POST http://localhost:8000/api/v1/risk/assess \
  -H "Content-Type: application/json" \
  -d '{"vehicle_id": "VEH-001", "speed_kmh": 95}'
```

### Tests

```bash
pip install -r backend/requirements-dev.txt
pytest
```
Covers the TRIE fusion contract, the end-to-end AI pipeline, and the risk API
(assess -> persist -> broadcast -> read). The API tests run against SQLite, so
no PostgreSQL or Docker is needed.

## Next steps

1. Replace one `ai/*/engine.py` stub at a time with a real model, keeping
   `ai/common/types.py` return shapes stable.
2. Export a trained model via `edge/export_onnx.py` and follow
   `edge/README.md` to deploy it on a Jetson device.

## Known gaps

- `TemporalPredictionEngine`'s per-vehicle history lives in process memory
  (LRU-capped at 10,000 vehicles), so a restart or a multi-process deployment
  loses trend continuity. Fine for one backend process; a real fleet
  deployment wants that history in a shared store (Redis, or the DB) instead.
- `next` is on 14.2.35, not the advisory-clean 16.2.10 — `npm audit`'s own
  fix requires that major bump (React 19, likely breaking changes), which
  deserves dedicated test time rather than a quick patch. The 14.2.x line
  still carries several high-severity entries as a result.
