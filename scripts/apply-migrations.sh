#!/bin/sh
#
# Aplica las migraciones de database/migrations/ dentro del contenedor
# de PostgreSQL. Se monta en /docker-entrypoint-initdb.d/ para que el
# entrypoint oficial la ejecute después de schema.sql y seed.sql.

set -e

if [ -d /migrations ]; then
  for migration in /migrations/*.sql; do
    [ -e "$migration" ] || continue
    echo "Aplicando migración $(basename "$migration")..."
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration"
  done
fi
