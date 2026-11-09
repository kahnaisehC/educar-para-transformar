# Migraciones de base de datos

## Runner

`scripts/migrate-db.mjs` aplica el esquema y las migraciones de forma
idempotente y registra cada versión en `schema_migrations`.

```bash
DATABASE_URL=postgres://educar:educar_dev_password@localhost:5432/educar \
  node scripts/migrate-db.mjs
```

- Base vacía: aplica `database/schema.sql`, `database/seed.sql` y todas las
  migraciones.
- Base existente: aplica solo las migraciones cuyo `version` no está registrado.
- Si una migración ya aplicada cambia de checksum, avisa y no la vuelve a
  ejecutar.
- `--dry-run` muestra qué haría sin escribir.

## Render

El servicio de API usa:

```yaml
startCommand: node scripts/migrate-db.mjs && npm run start --workspace @educar/api
```

Así, cada deploy aplica las migraciones pendientes antes de levantar la API.
Si el plan de Render permite `preDeployCommand`, se puede mover allí.

## Base existente

Si la base ya tiene tablas pero no `schema_migrations`, el runner crea la tabla
y ejecuta todas las migraciones. Las migraciones actuales usan
`IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS`, por lo que son seguras de reaplicar.
Revisar igualmente cualquier migración futura que haga `DROP` o `UPDATE`
destructivo.

## Reglas

- Nunca editar una migración ya aplicada.
- Agregar siempre `database/migrations/NNN_descripcion.sql`.
- Actualizar `database/schema.sql` y `database/seed.sql` en el mismo cambio.
- Agregar el caso a los tests de `apps/api/src/__tests__/app.test.ts`.
