# AGENTS.md

Instrucciones para asistentes de IA que trabajan en este repositorio
(opencode, Cursor, Copilot, Claude Code, etc.). Leé este archivo antes de
proponer o editar código.

## Qué es este proyecto

Monorepo de **"Educar para Transformar"**, el sistema de gestión de un centro
educativo. Contiene los Sprints 1, 2 y 3 de la consigna universitaria.
Stack: React + TypeScript (frontend), Node/Express + TypeScript (API),
PostgreSQL y autenticación JWT.

El proyecto es un trabajo práctico de una facultad argentina. Toda la
documentación, los comentarios de código y los textos de la UI están en
español.

## Idioma

- **Documentación, comentarios y textos de UI:** español (con acentos).
- **Mensajes de commit:** inglés, formato Conventional Commits
  (`feat:`, `fix`, `docs:`, `chore:`, `refactor:`), como en el historial.
- **Código (identificadores):** inglés.

## Estructura

```text
apps/api/                 API Express + servicios + JWT
apps/api/src/app.ts       Rutas/controladores (MVC) - archivo grande, 1000+ lineas
apps/api/src/*.service.ts Logica de negocio por dominio
apps/api/src/__tests__/   Pruebas Vitest + pg-mem + supertest
apps/web/src/pages/       Vistas por rol (React Router)
apps/web/src/api.ts       Cliente fetch centralizado
apps/web/src/ui.tsx       Helpers y componentes de UI reutilizables
database/schema.sql       Esquema PostgreSQL
database/seed.sql         Datos demo
database/migrations/      Migraciones incrementales (NNN_*.sql)
docs/                     Documentacion del TP (requerimientos, sprints, planes)
docs/ai/                  Guia de uso de IA y bitacora de sesiones
scripts/start.sh          Levanta todo con Podman
```

## Comandos

```bash
npm install            # instala workspaces (apps/*)
npm run dev:api        # API en modo watch (tsx), puerto 4000
npm run dev:web        # Vite dev server, puerto 5173 (proxy /api -> 4000)
npm test               # Vitest en @educar/api
npm run test:watch --workspace @educar/api
npm run typecheck      # tsc --noEmit en todos los workspaces
npm run build          # build de API (dist) y web (dist)

./scripts/start.sh     # build + levantar PostgreSQL + API + web con Podman
podman rm -f educar-web educar-api educar-db   # detener
```

Requiere Node >= 20. No hay ESLint/Prettier configurado: respetá el estilo del
archivo que editás.

## Reglas de trabajo (obligatorias)

1. **Una rebanada vertical por vez.** No implementes "todo el plan" de una.
   Ver `docs/app-steering-guide.txt`.
2. **Antes de dar una tarea por terminada** ejecutá:
   `npm run typecheck && npm test && npm run build`. El CI corre exactamente
   eso en cada push/PR a `main`; no se mergea en rojo.
3. **No rompas tests existentes.** Si cambiás una regla de negocio, actualizá o
   agregá tests.
4. **Cambios pequeños y enfocados.** Nada de refactors masivos no pedidos.
5. **No edites** `dist/`, `node_modules/` ni `package-lock.json` a mano.
6. **Nunca commitees secretos.** `.env` está ignorado; usá
   `apps/api/.env.example` como plantilla.
7. **No hagas commit ni push salvo que te lo pidan explícitamente.**

## Arquitectura y convenciones

- **ESM (`type: module`) con `NodeNext`.** Los imports de archivos locales
  llevan extensión `.js` aunque el fuente sea `.ts`
  (ej: `import { createApp } from "./app.js"`).
- **MVC en tres capas:** `app.ts` define las rutas (controlador), los
  `*.service.ts` contienen la lógica y el acceso a datos (modelo), y
  `apps/web` es la vista. Mantené esa separación.
- **Errores:** lanzá `AppError(statusCode, message, code)` (`errors.ts`).
  `app.ts` los traduce a respuestas HTTP.
- **Transacciones:** usá `withTransaction(pool, work)` (`db.ts`).
- **Tipos de datos:** `DatabasePool` y `Queryable` en `db.ts`.
- **Comillas dobles y punto y coma.** Indentación de 2 espacios.
- **Exportaciones nombradas** en la API; en las páginas de `apps/web` se usa
  `export default`.

### Patrones de diseño (de la consigna, no eliminar)

| Patrón | Archivo | Nota |
|---|---|---|
| Singleton | `apps/api/src/database.ts` | `getDatabasePool`/`closeDatabasePool` |
| Proxy | `apps/api/src/auditProxy.ts` | `withAuditProxy` autoriza y audita |
| Iterator | `apps/api/src/rowIterator.ts` | `RowIterator`, usado por report/teacher |

Si tocás servicios de inscripción, transporte, administración o reportes,
mantené el uso de `withAuditProxy`. Los tests verifican estos patrones.

### Autenticación

- JWT con `requireAuth` / `requireRoles` (`auth.ts`).
- La API **revalida el usuario en cada request**, así una cuenta desactivada
  pierde acceso aunque tenga un JWT viejo. No lo cambies por validación solo
  del token.
- `JWT_SECRET` debe tener al menos 32 caracteres (`config.ts`).

### Frontend

- Páginas por rol en `apps/web/src/pages/*Dashboard.tsx`; ruteo real por rol en
  `App.tsx` / `AppShell.tsx`.
- Todas las llamadas HTTP pasan por `apps/web/src/api.ts`.
- Tipos compartidos en `apps/web/src/types.ts`.
- No existe selector de usuarios demo: el login es real con credenciales.

## Base de datos

- `schema.sql` define la estructura; `seed.sql` carga datos demo;
  `database/migrations/NNN_*.sql` son incrementales y se aplican en orden.
- `scripts/start.sh` y el `docker-compose.yml` aplican `schema.sql`,
  `seed.sql` y luego todas las migraciones.
- **Si modificás el esquema, agregá una migración nueva** con el siguiente
  número (`005_...`), en lugar de editar una existente ya aplicada.
- Conexión vía `DATABASE_URL`
  (`postgres://educar:educar_dev_password@localhost:5432/educar`).

## Testing

- Framework: **Vitest + `pg-mem` + supertest**.
- Un único archivo: `apps/api/src/__tests__/app.test.ts` (1300+ líneas).
- El esquema se carga en memoria desde `database/schema.sql` y se insertan
  fixtures en `beforeEach`; no requiere PostgreSQL real.
- Autenticación en tests vía helper `loginAs(username)` con la contraseña
  `Educar2027!`.

## Git y CI

- CI (`.github/workflows/ci.yml`): `typecheck` → `test` → `build`, en cada
  push y PR a `main`.
- Plantilla de PR en `.github/pull_request_template.md` (incluye checklist de
  tests y de no filtrar secretos).
- Ramas remotas: `main`, `rama_nueva`.

## Contexto funcional

- Requerimientos e historias de usuario: `docs/requerimientosCorregidos.md`
  (códigos `RF-XX-nn`, `HU-nn`).
- Planificación: `docs/planificacionDeSprints.md`, `docs/planDeTrabajo.md`.
- App móvil (Parte 3): `docs/planDeTrabajoMovil.md`.
- Cobertura de requerimientos: sección homónima en `README.md`.

## Cómo colaborar (IA)

1. Leé el requerimiento (`RF-*`/`HU-*`) y el servicio/archivo afectado antes de
   escribir código.
2. Para explorar el repo, preferí búsquedas puntuales antes que leer todo.
3. Implementá, agregá tests y **siempre verifica con `typecheck` + `test` +
   `build`**.
4. Registrá lo hecho en `docs/ai/BITACORA_IA.md` (objetivo, cambios, estado,
   próximos pasos).
5. Guía general de uso de IA: `docs/ai/GUIA_IA.md`.
