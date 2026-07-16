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
             ai/pipeline.py orchestrates all of it end-to-end.
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
python -m ai.pipeline
```

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
Renders `RiskDashboard` against `lib/mockData.ts` until it's wired to the
backend's `/api/v1/risk/events` and `/api/v1/risk/alerts/ws`.

## Next steps

1. Replace one `ai/*/engine.py` stub at a time with a real model, keeping
   `ai/common/types.py` return shapes stable.
2. Wire the frontend to live backend data instead of `mockData.ts`.
3. Export a trained model via `edge/export_onnx.py` and follow
   `edge/README.md` to deploy it on a Jetson device.
