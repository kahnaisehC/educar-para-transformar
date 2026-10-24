# Educar para Transformar

Sistema de gestión del Centro Educativo **EDUCAR PARA TRANSFORMAR** (Partes 2 y 3 de la consigna integradora). Es un monorepo con React + TypeScript (web), React Native + Expo (móvil), API Node.js + TypeScript, PostgreSQL y autenticación JWT.

## Alcance del sistema completo

- Inicio de sesión real con usuario, contraseña, JWT y autorización por rol.
- Portal Alumno: catálogo de deportes, grupos, docentes, horarios, inscripción y cancelación.
- Módulo Alumno: perfil académico, actualización de contacto, transporte, comedor y reporte personal.
- Reglas de inscripción: máximo dos deportes, sin superposición de horarios y sin duplicados.
- Portal Padre: hijos asociados, materias, docentes, resumen deportivo y matrícula anual del cursado.
- Panel Administrador: usuarios y roles, estructura académica (niveles, cursos, materias, asignaciones), alumnos, docentes, padres, deportes y grupos, transporte, comedor, inscripciones y años lectivos.
- Sprint 2: actualización de contacto para alumnos y docentes, con validación de correo y teléfono.
- Sprint 3: listado de alumnos por materia para docentes (HU-05), inscripción al transporte (HU-06), plantillas de reportes institucionales para la Dirección (HU-07) con filtros por parámetros y exportación CSV, y acceso del administrador a los reportes autorizados.
- Reporte docente (cursos a cargo por nivel, materias y horarios), parámetros de consulta para la Dirección (RF-DI-02/03) y borrado de plantillas.
- Auditoría de inscripciones, cancelaciones, operaciones administrativas y generación de reportes.
- Panel de alertas y notificaciones: confirmaciones, rechazos, cambios de cuenta y matrículas.
- **Parte 3 (móvil):** app Expo con login, consulta de cuotas y facturas, historial de comprobantes, selección de ítems, carga de comprobante (imagen/PDF), validación administrativa, tarifas, emisión de facturas y reportes de cobranza.
- Recuperación y cambio de contraseña, notificaciones por correo con PDF adjunto, idempotencia de envíos y panel de morosidad.

## Estructura

```text
apps/api/               API Express, servicios de negocio, JWT y pruebas Vitest
apps/web/src/pages/     Vistas por rol (React/Vite) con rutas reales
apps/mobile/app/        App Expo Router: pantallas de padre, admin y dirección
apps/mobile/src/        Cliente API, sesión segura, tipos y componentes móviles
database/               Esquema, datos demo y migraciones PostgreSQL
docs/mobile/            Diseño de la Parte 3 (arquitectura y contratos)
docs/                   Documentación existente del proyecto, preservada
```

## Requisitos

- Podman (o Docker).
- Node.js >= 20 para ejecutar la app móvil en desarrollo.
- Expo Go o un emulador/dispositivo para probar la app móvil.

PostgreSQL, la API y la web se ejecutan dentro de los contenedores; no es necesario instalar PostgreSQL en el host.

## Puesta en marcha con Podman

Desde la raíz del repositorio:

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

El script construye y levanta PostgreSQL, la API y el frontend directamente con Podman. Abrir `http://localhost:5173`.

Para detener la aplicación, ejecutar:

```bash
podman rm -f educar-web educar-api educar-db
```

La API queda disponible en `http://localhost:4000`.

La base se inicializa con `database/schema.sql` y `database/seed.sql`. El script aplica además todas las migraciones de `database/migrations/` (`002` a `006`) para actualizar volúmenes existentes. Para reinicializar los datos demo en un entorno local:

```bash
podman rm -f educar-web educar-api educar-db
podman volume rm educar-postgres-data
./scripts/start.sh
```

El secreto JWT de `apps/api/.env` debe ser largo, aleatorio y exclusivo de cada entorno. Nunca usar el secreto de ejemplo en producción.

### App móvil (Expo)

Con la API y la base levantadas:

```bash
npm install
EXPO_PUBLIC_API_URL=http://localhost:4000/api npm run start --workspace @educar/mobile
```

- En un emulador Android usá `http://10.0.2.2:4000/api`; en un dispositivo físico usá la IP de la máquina.
- Escaneá el QR con Expo Go o abrí el emulador.
- Variables opcionales del backend: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `UPLOADS_DIR`, `APP_URL`, `BANK_ALIAS`, `BANK_CBU`, `BANK_HOLDER` (ver `apps/api/.env.example`).
- Los comprobantes se guardan en el volumen `educar-uploads`; si `SMTP_HOST` está vacío se usa un transporte de correo de prueba.

## Cuentas demo

Todas las cuentas usan inicialmente la contraseña `Educar2027!`:

| Usuario | Rol |
|---|---|
| `ana.alumna` | Alumno |
| `marta.madre` | Padre / madre |
| `bruno.alumno` | Alumno |
| `carlos.padre` | Padre / madre |
| `laura.docente` | Docente |
| `admin.demo` | Administrador |
| `director.demo` | Dirección |

Cambiar o eliminar estas cuentas demo antes de desplegar el sistema. El frontend no incluye un selector de usuarios: cada persona inicia sesión con sus propias credenciales.

## Pruebas y build

```bash
npm test
npm run typecheck
npm run build
```

Las 50 pruebas del backend (Vitest + `pg-mem` + supertest) cubren autenticación y RBAC, aislamiento padre-hijo, límite de dos deportes, conflictos de horario, duplicados, perfiles iniciales, contacto, transporte, comedor, cancelaciones, reportes, listado docente (HU-05), plantillas de reportes institucionales (HU-07), matrículas del padre (RF-PA-02), gestión académica del administrador (RF-AD-01/02, HU-04), reporte docente (RF-PR-01/03), parámetros de consulta (RF-DI-02/03), notificaciones y los patrones Singleton, Proxy e Iterator. Para la Parte 3 agregan tarifas, generación idempotente de facturas, consulta de cuotas, carga multipart de comprobantes, aprobación/rechazo con imputación, pagos parciales, reportes de cobranza, morosidad, recordatorios idempotentes y recuperación de contraseña.

## Patrones de diseño

Los patrones se implementaron en el código real del Sprint 3 y se aplican en la capa donde aportan mayor beneficio:

| Patrón | Implementación | Problema que resuelve | Evidencia en tests |
|---|---|---|---|
| **MVC** | Arquitectura de tres capas: rutas de Express (`app.ts`) como controladores, servicios (`*.service.ts`) como modelo/lógica de negocio, y React (`apps/web`) como vista. | Separar presentación, lógica y acceso a datos. | - |
| **Iterator** | `apps/api/src/rowIterator.ts` (clase `RowIterator`) usada por `report.service.ts` y `teacher.service.ts` para recorrer resultados de consultas. | Iterar registros sin exponer la estructura interna de la colección. | Test "iterates projected rows without exposing the underlying array" |
| **Proxy** | `apps/api/src/auditProxy.ts` (`withAuditProxy`), aplicado en servicios de inscripción, transporte, administración y reportes; autoriza por rol y registra auditoría de éxito y rechazo. | Agregar autorización y auditar operaciones sin modificar los servicios. | Test "uses a database-pool proxy that authorizes the requested role and audits success and rejection" |
| **Singleton** | `apps/api/src/database.ts` (`getDatabasePool`/`closeDatabasePool`), pool de conexiones único usado por `server.ts` y los tests. | Evitar múltiples instancias de acceso a la base de datos. | Test "returns the same database pool for repeated requests (Singleton)" |

## API principal

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/notifications` · `PATCH /api/notifications/:id/read` · `PATCH /api/notifications/read-all`
- `GET /api/student/dashboard`
- `GET /api/student/report`
- `PATCH /api/me/contact`
- `POST /api/student/enrollments` · `DELETE /api/student/enrollments/:groupId`
- `POST /api/student/transport` · `DELETE /api/student/transport`
- `POST /api/student/cafeteria` · `DELETE /api/student/cafeteria`
- `GET /api/parent/children` · `GET /api/parent/children/:studentId/summary`
- `GET /api/parent/children/:studentId/enrollment` · `POST /api/parent/children/:studentId/enrollment`
- `GET /api/admin/users` · `POST /api/admin/users` · `PATCH /api/admin/users/:userId`
- `GET /api/admin/academic` · `GET /api/admin/services` · `GET /api/admin/enrollments`
- Catálogos (admin): `levels`, `courses`, `subjects`, `course-subjects`, `school-years`, `students`, `teachers`, `parents`, `sports`, `sport-groups`, `transport-routes` con CRUD bajo `/api/admin/*`
- Gestión de vínculos: `POST/DELETE /api/admin/students/:studentId/parents(/:parentId)`
- Inscripciones (admin): cancelar deportes/transporte, activar comedor y cambiar matrículas bajo `/api/admin/enrollments/*`
- `GET /api/teacher/profile` · `GET /api/teacher/report` · `GET /api/teacher/courses` · `GET /api/teacher/courses/students`
- `GET /api/director/report-entities` · `GET /api/director/report-filters`
- `GET /api/director/report-templates` · `POST/PATCH/DELETE /api/director/report-templates(/:id)`
- `POST /api/director/report-templates/:templateId/generate` (con `filters`)
- `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` · `PATCH /api/me/password`
- **Facturación (admin):** `GET/POST/PATCH /api/admin/billing/tariffs(/:id)`, `POST /api/admin/billing/invoices/generate`, `GET /api/admin/billing/invoices(/:id)`, `GET /api/admin/billing/receipts`, `POST /api/admin/billing/receipts/:id/approve|reject`
- **Facturación (padre):** `GET /api/parent/billing/children/:studentId/summary|invoices`, `GET /api/parent/billing/invoices/:id`, `POST /api/parent/billing/invoices/:id/receipts` (multipart), `GET /api/parent/billing/bank-details`
- **Reportes de cobranza:** `GET /api/admin/billing/reports/income|payments|services`, `GET /api/admin/billing/delinquency`, `POST /api/admin/billing/notifications/reminders|debt`

Todas las rutas excepto login y health requieren `Authorization: Bearer <token>`. La API vuelve a consultar el usuario en cada request, por lo que una cuenta desactivada pierde acceso aunque conserve un JWT anterior. El rol administrador puede consultar y generar los reportes institucionales autorizados; la creación y edición de plantillas es exclusiva de Dirección.

## Cobertura de requerimientos

| Requerimiento | Estado |
|---|---|
| RF-AL-01 a RF-AL-06 (alumno) | Implementado |
| RF-PA-01, RF-PA-02 (matrícula anual), RF-PA-03 (aislamiento) | Implementado |
| RF-PR-01 (perfil/carga horaria), RF-PR-02 (contacto), RF-PR-03 (reporte docente), RF-PR-04 (listados) | Implementado |
| RF-AD-01 (gestión académica), RF-AD-02 (transporte y comedor), RF-AD-03 (usuarios y roles), RF-AD-04 (reportes autorizados) | Implementado |
| RF-DI-01 (plantillas), RF-DI-02 (parámetros de consulta), RF-DI-03 (listados por nivel/curso/materia/deporte/horario/profesor/recorrido) | Implementado |
| Panel de alertas y notificaciones | Implementado (in-app) |
| Parte 3 · RF-MV-01 a RF-MV-19 (auth, cuotas, pagos, comprobantes, tarifas, facturas) | Implementado |
| Parte 3 · RF-MV-20 a RF-MV-25 (reportes de cobranza y morosidad) | Implementado en la web |
| Parte 3 · RF-MV-16/17 (correo, PDF adjunto, idempotencia) | Implementado con transporte de prueba/SMTP configurable |
| App móvil (Expo) | Implementada en `apps/mobile` |

## Patrones de Diseño

Los patrones de diseño clásicos (GoF) se implementaron en la capa de API del backend. A continuación se detalla el archivo exacto de cada uno.

### Singleton — Pool de conexiones único

**Archivo:** `apps/api/src/database.ts`

`getDatabasePool(connectionString)` crea el `Pool` en la primera llamada y devuelve la misma instancia en las siguientes; `closeDatabasePool()` lo libera (tests y apagado ordenado).

**Motivación:** evita que múltiples módulos abran conjuntos de conexiones independientes, saturando el límite de conexiones de PostgreSQL.

---

### Proxy — Autorización y auditoría transparente

**Archivo:** `apps/api/src/auditProxy.ts`

`withAuditProxy(pool, { operation, actorUserId, actorRole, allowedRoles, handler })` verifica el rol autorizado y registra en `audit_logs` tanto el éxito como el rechazo de la operación, sin que los servicios modifiquen su lógica de negocio (`apps/api/src/audit.ts` persiste los registros).

**Motivación:** agrega control de acceso y trazabilidad a operaciones de escritura sin tocar los servicios existentes.

---

### Iterator — Recorrido uniforme de filas

**Archivos:** `apps/api/src/rowIterator.ts` y `apps/api/src/report.service.ts`

`RowIterator<T, U>` encapsula el estado de recorrido sobre los resultados de una consulta y permite proyectar cada fila; lo usan `teacher.service.ts` y `report.service.ts`. `report.service.ts` expone además `ReportRowIterator` e `iterateReport(report)` para recorrer las filas de un `GeneratedReport` con `for...of` o llamadas manuales a `.next()`.

**Motivación:** desacopla al consumidor de la estructura interna del array de filas y facilita paginación o filtrado futuro sin modificar los servicios.
