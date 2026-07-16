FROM python:3.12-slim

WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
COPY ai/requirements.txt ai/requirements.txt

# The full ai/requirements.txt is required, not just backend/requirements.txt:
# ai/perception/lanes.py and ai/road_intelligence/damage.py import cv2 at
# module level, and PerceptionEngine/DriverIntelligenceEngine both run real
# YOLO/MediaPipe inference even on the blank-frame stub POST /assess uses
# (neither analyze() early-returns for a frame that is blank but non-empty).
# CPU wheels for torch: this image has no GPU, and the CUDA build is
# several times larger for no benefit.
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r backend/requirements.txt -r ai/requirements.txt

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
