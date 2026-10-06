#!/usr/bin/env bash
#
# Docker version of start.sh, for use on Windows (Git Bash / Windows Terminal).

set -Eeuo pipefail

# Avoid Git Bash mangling absolute paths passed to docker.exe.
export MSYS_NO_PATHCONV=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -W 2>/dev/null || pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' "Error: Docker no está instalado o no está disponible en PATH." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf '%s\n' "Error: Docker no está corriendo. Iniciá Docker Desktop e intentá de nuevo." >&2
  exit 1
fi

NETWORK_NAME="educar-network"
VOLUME_NAME="educar-postgres-data"
DB_CONTAINER="educar-db"
API_CONTAINER="educar-api"
WEB_CONTAINER="educar-web"
JWT_SECRET_VALUE="${JWT_SECRET:-local-only-change-this-jwt-secret-educar-2026}"

remove_container() {
  local container="$1"
  if docker container inspect "$container" >/dev/null 2>&1; then
    docker rm -f "$container" >/dev/null
  fi
}

if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  docker network create "$NETWORK_NAME" >/dev/null
fi

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  docker volume create "$VOLUME_NAME" >/dev/null
fi

remove_container "$WEB_CONTAINER"
remove_container "$API_CONTAINER"
remove_container "$DB_CONTAINER"

printf '%s\n' "Construyendo las imágenes de API y frontend..."
docker build --file apps/api/Dockerfile --tag educar-api .
docker build --file apps/web/Dockerfile --tag educar-web .

printf '%s\n' "Iniciando PostgreSQL..."
docker run --detach \
  --name "$DB_CONTAINER" \
  --network "$NETWORK_NAME" \
  --env POSTGRES_DB=educar \
  --env POSTGRES_USER=educar \
  --env POSTGRES_PASSWORD=educar_dev_password \
  --volume "$VOLUME_NAME:/var/lib/postgresql/data" \
  --volume "$ROOT_DIR/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro" \
  --volume "$ROOT_DIR/database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro" \
  postgres:16-alpine >/dev/null

database_ready=false
for _attempt in {1..30}; do
  if docker exec "$DB_CONTAINER" pg_isready -U educar -d educar >/dev/null 2>&1; then
    database_ready=true
    break
  fi
  sleep 1
done

if [[ "$database_ready" != true ]]; then
  printf '%s\n' "Error: PostgreSQL no alcanzó el estado saludable." >&2
  docker logs "$DB_CONTAINER" >&2
  exit 1
fi

printf '%s\n' "Iniciando API y frontend..."
docker run --detach \
  --name "$API_CONTAINER" \
  --network "$NETWORK_NAME" \
  --env PORT=4000 \
  --env DATABASE_URL=postgres://educar:educar_dev_password@educar-db:5432/educar \
  --env JWT_SECRET="$JWT_SECRET_VALUE" \
  --env CORS_ORIGIN=http://localhost:5173 \
  --publish 4000:4000 \
  educar-api >/dev/null

docker run --detach \
  --name "$WEB_CONTAINER" \
  --network "$NETWORK_NAME" \
  --env VITE_PROXY_TARGET=http://educar-api:4000 \
  --publish 5173:5173 \
  educar-web >/dev/null

printf '%s\n' "Aplicación iniciada con Docker."
printf '%s\n' "La aplicación estará disponible en http://localhost:5173"
printf '%s\n' "API: http://localhost:4000"
printf '%s\n' "Para detenerlos: docker rm -f educar-web educar-api educar-db"
