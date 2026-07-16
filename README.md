# Smart Road Guardian AI X

> **Predict. Explain. Prevent.**

An Explainable Multimodal Edge AI Transportation Intelligence Platform for
real-time accident prevention and causal risk analysis. Full spec and
system architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

This repo is a **full skeleton** — every module is wired together end-to-end
but currently returns deterministic mock/heuristic data instead of running
trained models. See "Status" in the architecture doc for what to replace
first.

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
uvicorn app.main:app --reload
```
Requires a running PostgreSQL matching `TRIE_DATABASE_URL` (see
`backend/.env.example`) — `docker compose up db` starts one.

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

- No CI runs the test suite.
- `TemporalPredictionEngine`'s per-vehicle history lives in process memory
  (LRU-capped at 10,000 vehicles), so a restart or a multi-process deployment
  loses trend continuity. Fine for one backend process; a real fleet
  deployment wants that history in a shared store (Redis, or the DB) instead.
- `docker-compose.yml` has no DB healthcheck, so the backend can race
  PostgreSQL on a cold `up` (it runs `create_all` at startup).
- `frontend/Dockerfile` copies only `package.json`, so the image build
  re-resolves deps instead of using the committed `package-lock.json`.
- The schema is created via `create_all`; there are no migrations, so column
  changes need the volume dropped.
- `next@14.2.5` has a known security advisory; needs an upgrade.
