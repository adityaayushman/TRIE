FROM python:3.12-slim

WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
COPY ai/requirements.txt ai/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY ai/ ai/
COPY backend/app/ backend/app/

ENV PYTHONPATH=/srv:/srv/backend
WORKDIR /srv/backend

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
