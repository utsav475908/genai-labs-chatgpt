#!/usr/bin/env bash
# Build and (re)start the whole showcase on this machine. Run from anywhere:
#   ./showcase/deploy/deploy.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

if [[ ! -f .env ]]; then
  echo "Missing .env in $REPO. Create it with: cp .env.example .env  (then fill in your values)" >&2
  exit 1
fi

python3 showcase/deploy/render.py
docker build -f showcase/deploy/backend.Dockerfile -t genai-labs-api:latest .
docker compose -f showcase/deploy/generated/docker-compose.yml --env-file .env up -d --build --remove-orphans
docker compose -f showcase/deploy/generated/docker-compose.yml --env-file .env ps
