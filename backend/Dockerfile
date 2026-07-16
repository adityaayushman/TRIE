FROM python:3.12-slim

WORKDIR /srv

# Only backend/requirements.txt — the ~2GB ai/ stack (torch, ultralytics,
# mediapipe, opencv) is deliberately absent. This service has no camera:
# POST /assess carries telemetry, never frames, so it runs the telemetry-only
# pipeline (ai/no_camera.py) whose output is identical to what the real
# engines produce on a blank frame, without loading any model. Perception runs
# at the edge (ai/ingestion/, ai/cli.py) against `pip install -r
# ai/requirements.txt`, which is where those dependencies belong.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY ai/ ai/
COPY backend/app/ backend/app/
COPY backend/alembic/ backend/alembic/
COPY backend/alembic.ini backend/alembic.ini

ENV PYTHONPATH=/srv:/srv/backend
WORKDIR /srv/backend

# Migrations run every container start rather than as a separate step: this
# is a single backend instance today, so there is no risk of two containers
# racing to apply the same migration concurrently. A multi-replica deployment
# would want this as a separate one-shot job instead.
#
# $PORT: hosts like Render inject the port the container must bind to;
# defaults to 8000 for local `docker run`/Compose, which sets no such var.
ENV PORT=8000
CMD alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
