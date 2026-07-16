FROM python:3.12-slim

WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
COPY ai/requirements.txt ai/requirements.txt
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
CMD alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000
