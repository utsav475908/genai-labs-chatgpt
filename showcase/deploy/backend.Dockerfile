# One Python image for every lab backend. Each compose service runs it with its own
# working_dir and port. Secrets are NOT baked in: they arrive at runtime from .env.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY showcase/deploy/generated/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY . /app
