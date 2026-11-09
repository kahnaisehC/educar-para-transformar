# Plan de cierre de brechas — Parte 3

Fecha: 2026-11-04
Estado: planificación. No se modificó código de la aplicación.

Este documento cubre las 8 brechas detectadas en la auditoría contra los
requerimientos de la Parte 3. Cada brecha incluye alcance, cambios, pruebas,
criterios de aceptación, riesgos y esfuerzo estimado.

## Estado de ejecución (2026-11-09)

| # | Brecha | Estado |
|---|---|---|
| 1 | Scheduler de notificaciones | Implementado: lógica de fechas, endpoint interno, workflow diario y tests. Requiere secretos `APP_URL` y `NOTIFICATIONS_TOKEN`. |
| 2 | Comprobante de pago definitivo | Implementado: migración 007, numeración, PDF, endpoints y descarga móvil. |
| 3 | SMTP real | Implementado: estado, prueba y variables. Requiere credenciales del proveedor. |
| 4 | Persistencia de comprobantes | Implementado: adaptador local/S3. Render debe usar `STORAGE_DRIVER=s3` y credenciales S3/R2. |
| 5 | Migraciones en Render | Implementado: `scripts/migrate-db.mjs` y `startCommand` en `render.yaml`. |
| 6 | Dispositivo + EAS | Configuración `eas.json`, script y checklist. El build requiere cuenta Expo/EAS. |
| 7 | Email en usuarios nuevos | Implementado en API y panel admin; alta con email obligatorio en la UI. |
| 8 | Branch protection | Documentado con `gh api` en `docs/POLITICA_PR.md`. Requiere ejecutarlo con permisos de administrador. |

### Brechas funcionales adicionales cerradas (2026-11-09)

- **RF-AD-01:** el admin puede crear inscripciones deportivas, de transporte y
  de comedor desde el panel, además de cancelarlas.
- **RF-MV-10:** el historial móvil permite filtrar facturas y comprobantes por
  rango de períodos.
- **HU-06:** el padre y el admin pueden descargar la factura en PDF desde la app.
- **RF-MV-15:** el admin puede abrir/descargar el comprobante cargado antes de
  aprobarlo o rechazarlo.
- **RNF-04:** se agregó una prueba de aprobación concurrente que verifica una
  sola acreditación.

## Decisiones abiertas antes de implementar

| Decisión | Opciones | Recomendación |
|---|---|---|
| Proveedor SMTP | Gmail app password, SendGrid, Resend, Mailgun | Proveedor transaccional con dominio verificado; Gmail solo para demo |
| Almacenamiento de comprobantes | Disco persistente de Render, S3/R2, PostgreSQL bytea | S3-compatible (R2) detrás de un adaptador; fallback local en desarrollo |
| Scheduler de notificaciones | Render Cron, GitHub Actions schedule, `node-cron` en la API | Render Cron si el plan lo permite; si no, GitHub Actions con token interno |
| Numeración del comprobante de pago | `payments.id` formateado, secuencia propia, UUID | Secuencia propia `PAGO-AAAA-000001` persistida en `payments.payment_number` |
| Build móvil | Solo Android APK, Android + iOS, EAS Update | Android APK para la defensa; iOS solo si hay cuenta Apple |
| Branch protection | Checks obligatorios, revisiones obligatorias | Requerir `build-and-test`, `e2e` y SonarCloud; PR obligatorio |

## Orden recomendado

1. Migraciones idempotentes (5) — base para desplegar cambios de esquema.
2. Email en usuarios nuevos (7) — requerido por notificaciones y reset.
3. Comprobante de pago definitivo (2).
4. SMTP real (3).
5. Scheduler de recordatorios y deuda (1).
6. Persistencia de comprobantes (4).
7. Prueba en dispositivo y build EAS (6).
8. Branch protection (8) — al final, cuando todos los checks existan.

Dependencias: 1 → 2, 1 → 4? No; 1 es transversal. 3 → 1 (SMTP) → 5.
4 es independiente. 6 depende de 4. 8 depende de 3, 5 y 6 en CI.

---

## 1. Scheduler de recordatorios y avisos de deuda

**Brecha:** RF-MV-16 y RF-MV-17. Los envíos existen, pero solo se disparan
manualmente desde `POST /api/admin/billing/notifications/reminders|debt`
(`apps/api/src/app.ts`). No hay cálculo del último día hábil ni ejecución
automática el día 20.

**Objetivo:** enviar recordatorios el último día hábil del mes y avisos de deuda
el día 20, sin duplicados y con registro.

**Cambios:**

- `apps/api/src/billingNotifications.service.ts`:
  - Agregar funciones puras `isLastBusinessDayOfMonth(date)` y
    `isDebtNoticeDay(date)`.
  - `sendMonthlyReminders`/`sendDebtNotices` deben aceptar un modo
    `scheduled` que valide la fecha y devuelva `skipped` si no corresponde.
  - Mantener idempotencia por `notification_deliveries.idempotency_key`.
- `scripts/billing-notifications.mjs` (nuevo):
  - Script CLI que crea el pool, ejecuta el envío del día y cierra la conexión.
  - Modo `--kind=reminders|debt` y `--force` para pruebas manuales.
- `render.yaml`:
  - Agregar un servicio `type: cron` diario (por ejemplo `0 12 * * *` UTC)
    que ejecute `node scripts/billing-notifications.mjs`.
  - Si el plan no admite cron, agregar un workflow programado en
    `.github/workflows/billing-notifications.yml` que invoque un endpoint
    interno protegido por `NOTIFICATIONS_TOKEN`.
- `apps/api/src/app.ts`:
  - Si se usa GitHub Actions, agregar `POST /api/internal/notifications/run`
    con header `X-Internal-Token` y comparación contra
    `NOTIFICATIONS_TOKEN`.
- `apps/api/.env.example` y `render.yaml`: documentar
  `NOTIFICATIONS_TOKEN` y la zona horaria (`America/Argentina/Buenos_Aires`).

**Tests:**

- Fechas: último día hábil con fin de semana y feriado/configuración.
- Día 20: envía solo ese día; otro día devuelve `skipped`.
- Dos ejecuciones el mismo día no duplican envíos.
- Sin SMTP configurado no se envía correo real.
- Script CLI con base de prueba.

**Aceptación:**

- El 30/10/2026 (último día hábil de octubre) se envía un recordatorio por padre
  con saldo y factura adjunta.
- El 20/11/2026 se envía el aviso de deuda solo a padres con pago incompleto.
- Reintentos y ejecuciones duplicadas no generan un segundo correo.
- Queda registro en `notification_deliveries`.

**Riesgos:** feriados locales; zona horaria del cron; plan de Render sin cron;
límites del proveedor SMTP.

**Esfuerzo:** 1,5–2 días.

---

## 2. Comprobante de pago definitivo

**Brecha:** RF-MV-15. Al aprobar un comprobante se crea un registro en
`payments`, pero no existe un comprobante de pago definitivo con número y PDF
descargable. `payments.id` es interno.

**Objetivo:** emitir un comprobante de pago numerado, persistente y descargable
cuando el administrador aprueba un comprobante.

**Cambios:**

- Migración `007_payment_receipts.sql`:
  - `ALTER TABLE payments ADD COLUMN payment_number VARCHAR(30) UNIQUE`.
  - Secuencia o función para generar `PAGO-AAAA-000001`.
  - Backfill de pagos existentes.
- `apps/api/src/billing.service.ts`:
  - Al aprobar, generar `payment_number` dentro de la misma transacción.
  - Endpoint `GET /api/parent/billing/payments/:paymentId/receipt` y
    `GET /api/admin/billing/payments/:paymentId/receipt` (PDF).
  - Listar pagos en el detalle de factura y en el historial del padre.
- `apps/api/src/paymentPdf.service.ts` (nuevo):
  - PDF con número, fecha, alumno, factura, ítems imputados, importe,
    medio de pago (transferencia) y datos de la institución.
- `apps/mobile/app/parent/historial.tsx`:
  - Botón “Descargar comprobante de pago” para pagos aprobados.
  - Descarga con `expo-file-system` y compartir con `expo-sharing`.
- `apps/web/src/pages/BillingReports.tsx` o detalle de factura:
  - Enlace de descarga del comprobante para admin.

**Tests:**

- Aprobar un comprobante genera un número único y formato correcto.
- El PDF responde `application/pdf` y contiene el número.
- Un padre no puede descargar el comprobante de otro alumno.
- Reintentar la aprobación no genera un segundo pago ni un segundo número.
- El listado de pagos muestra el comprobante.

**Aceptación:**

- Cada pago aprobado tiene un comprobante con número único.
- El padre puede descargarlo desde la app.
- El administrador puede consultarlo y descargarlo.
- La numeración no se repite ni queda huérfana.

**Riesgos:** formato de numeración; migración de pagos existentes; permisos de
descarga.

**Esfuerzo:** 1,5–2 días.

---

## 3. SMTP real

**Brecha:** RF-MV-16/17 y recuperación de contraseña. `mail.service.ts` soporta
SMTP, pero el entorno usa transporte JSON de prueba. No hay credenciales ni
verificación de envío real.

**Objetivo:** enviar correos reales con un proveedor SMTP configurable, sin
secretos en el repositorio.

**Cambios:**

- `apps/api/src/config.ts` y `.env.example`: ya existen `SMTP_*`; agregar
  validación y `MAIL_FROM`.
- `render.yaml`: declarar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` con `sync: false`.
- `apps/api/src/mail.service.ts`:
  - `verifyMailTransport()` al iniciar (solo log, no bloquear el arranque).
  - `sendMail` devuelve `transport: "smtp" | "json"`.
- `apps/api/src/app.ts`:
  - `GET /api/admin/notifications/mail-status` (admin) para verificar
    configuración sin enviar.
  - `POST /api/admin/notifications/test` (admin) para enviar un correo de
    prueba al propio administrador.
- Documentar SPF/DKIM y remitente verificado en `docs/mobile/smtp.md`.

**Tests:**

- Configuración ausente → transporte JSON y log claro.
- Configuración presente → se crea transporte SMTP (sin enviar en CI).
- Endpoint de prueba rechaza roles no admin.
- No se filtran credenciales en logs ni respuestas.

**Aceptación:**

- Con variables configuradas, un recordatorio llega a una casilla real.
- Sin variables, la app sigue funcionando con transporte de prueba.
- El estado del transporte es consultable desde el panel admin.

**Riesgos:** proveedor, reputación del dominio, límites de envío, secretos.

**Esfuerzo:** 0,5–1 día (más configuración externa).

---

## 4. Persistencia de comprobantes en Render

**Brecha:** RNF-03/RNF-09. Los comprobantes se guardan en
`uploads/receipts` y en Podman usan el volumen `educar-uploads`. En Render no
hay disco persistente ni storage externo: un redeploy puede perder archivos.

**Objetivo:** conservar los comprobantes entre despliegues y reinicios.

**Opciones:**

- **A. Disco persistente de Render:** agregar `disk` al servicio API.
  Requiere plan que lo soporte y un único servicio (no escala horizontal).
- **B. S3-compatible (R2/S3/MinIO):** recomendado. Agregar un adaptador de
  storage y guardar solo la clave/ruta en la base.
- **C. PostgreSQL bytea:** simple pero no recomendado para archivos grandes.

**Plan recomendado (B):**

- `apps/api/src/storage/`:
  - `StorageAdapter` con `put`, `get`, `delete`.
  - `LocalStorageAdapter` (desarrollo) y `S3StorageAdapter` (producción).
- Variables: `STORAGE_DRIVER=local|s3`, `S3_ENDPOINT`, `S3_BUCKET`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`.
- `apps/api/src/app.ts`: usar el adaptador en carga/descarga de comprobantes.
- Migración: `payment_receipts.file_path` pasa a ser `storage_key`
  (o se mantiene compatible).
- `render.yaml`: variables `sync: false` para S3; documentar creación del
  bucket y permisos.
- Tests con `LocalStorageAdapter` y un fake de S3.

**Aceptación:**

- Subir un comprobante, redeployar y descargarlo sigue funcionando.
- El padre solo accede a sus comprobantes; el admin a todos.
- Los archivos no se guardan en el repo ni en la imagen Docker.

**Riesgos:** costo/configuración del bucket, permisos, migración de archivos
existentes.

**Esfuerzo:** 2–3 días.

---

## 5. Migraciones automáticas en Render

**Brecha:** `scripts/init-db.mjs` solo aplica `schema.sql`, `seed.sql` y
migraciones si la tabla `users` no existe. En una base Render existente, una
migración nueva como `006_billing_core.sql` no se aplica.

**Objetivo:** aplicar migraciones pendientes en cada deploy, de forma
idempotente y transaccional.

**Cambios:**

- Crear `schema_migrations`:
  - `version`, `name`, `applied_at`, `checksum`.
- `scripts/migrate-db.mjs`:
  - Detecta migraciones pendientes en `database/migrations/`.
  - Aplica cada archivo en una transacción y registra la versión.
  - Si la base está vacía, ejecuta `schema.sql` + `seed.sql` y marca la línea
    base (001–006) como aplicada.
  - Si la base ya existe sin tabla de control, crea la tabla y marca las
    migraciones ya incluidas en `schema.sql` como aplicadas.
- `render.yaml`:
  - `preDeployCommand: node scripts/migrate-db.mjs` (si el plan lo permite) o
    `startCommand: node scripts/migrate-db.mjs && npm run start ...`.
  - Mantener `scripts/init-db.mjs` solo para el primer arranque o reemplazarlo.
- `scripts/start.sh` y `start2.sh`: usar el runner en lugar del loop actual.
- Documentar el flujo en `docs/mobile/migraciones.md`.

**Tests:**

- Base vacía → aplica schema, seed y migraciones, registra versiones.
- Base con migraciones aplicadas → no reaplica.
- Migración nueva → se aplica una sola vez.
- Migración con error → rollback y no registra la versión.

**Aceptación:**

- Un deploy con `007_...sql` aplica la migración automáticamente.
- Un reinicio posterior no la vuelve a aplicar.
- La base de Render existente queda migrada sin perder datos.

**Riesgos:** baseline de la base actual; migraciones no idempotentes;
`preDeployCommand` disponible solo en ciertos planes.

**Esfuerzo:** 1–2 días.

---

## 6. Prueba en dispositivo y build EAS

**Brecha:** la app pasa typecheck/export web, pero no fue probada en un
dispositivo ni existe APK/IPA. No hay `eas.json`.

**Objetivo:** generar un build instalable y validar los flujos críticos en un
dispositivo real.

**Cambios:**

- `apps/mobile/eas.json`:
  - Perfiles `development`, `preview` (APK) y `production`.
  - `app.json`: `owner`, `projectId`, versión, `android.package`.
- `apps/mobile/README.md` o `docs/mobile/pruebas-dispositivo.md`:
  - Requisitos (Expo Go/EAS CLI, cuenta Expo, API accesible).
  - Checklist de humo: login, cuotas, pago, comprobante, aprobación, historial,
    cierre de sesión, restauración de sesión.
  - Evidencias (capturas, logs, versión del build).
- Scripts:
  - `npm run build:android --workspace @educar/mobile` (EAS preview).
- CI opcional: job manual con `EAS_TOKEN`; no bloquear PRs.

**Aceptación:**

- APK instalable en Android.
- Los flujos de padre y admin funcionan contra la API de prueba.
- La sesión persiste al cerrar y reabrir.
- La app maneja API caída y token vencido con mensajes claros.

**Riesgos:** cuenta Expo/EAS, credenciales Android, SDK 58 y Expo Go,
conectividad HTTP local.

**Esfuerzo:** 1–2 días (más tiempo de build).

---

## 7. Email en usuarios nuevos

**Brecha:** `createUser` en `apps/api/src/admin.service.ts` no asigna
`users.email`. Los usuarios creados desde el panel no reciben notificaciones ni
recuperación de contraseña.

**Objetivo:** capturar y persistir el correo al crear o editar usuarios.

**Cambios:**

- `apps/api/src/admin.service.ts`:
  - `CreateUserInput.email` y `UpdateUserInput.email`.
  - Insertar `users.email`; para alumno/docente, reflejar también en su perfil.
  - Validar formato y unicidad si corresponde.
- `apps/api/src/app.ts`:
  - `POST /api/admin/users` acepta `email`; `PATCH` permite editarlo.
- `apps/web/src/pages/AdminDashboard.tsx`:
  - Campo email en alta y edición de usuario.
- Migración/backfill:
  - Completar `users.email` con `username || '@educar.local'` para usuarios
    existentes sin email (igual que la migración 006).
- `apps/api/src/password.service.ts` y `billingNotifications.service.ts`:
  - Usar `users.email`; si falta, registrar `skipped` con motivo.

**Tests:**

- Alta de usuario con email válido → se persiste.
- Email inválido → 400.
- Usuario sin email → no recibe correo y queda registro.
- Edición de email → se actualiza.
- Notificación/reset usan el email correcto.

**Aceptación:**

- Todo usuario nuevo tiene email o se informa que falta.
- Los correos de reset y recordatorio llegan.
- El panel admin permite corregir el email.

**Riesgos:** duplicados, datos existentes, diferencias entre `users.email` y
`students.email`/`teachers.email`.

**Esfuerzo:** 0,5 día.

---

## 8. Branch protection en GitHub

**Brecha:** la política de PR existe, pero `main` no exige checks ni revisión.
El `unidad5v2/README.md` lo marca como pendiente manual.

**Objetivo:** impedir merges con CI rojo o sin revisión y evitar pushes directos
a `main`.

**Cambios (GitHub, no código):**

- Settings → Branches → Add branch protection rule para `main`:
  - Require a pull request before merging.
  - Require approvals (1).
  - Dismiss stale approvals.
  - Require status checks: `build-and-test`, `e2e` y SonarCloud.
  - Require branches to be up to date.
  - Block force pushes y deletions.
- Verificar que los checks existan en un PR reciente.
- Documentar el procedimiento con `gh api` en `docs/POLITICA_PR.md`:
  - `gh api` para `required_status_checks`, `required_pull_request_reviews`,
    `enforce_admins`, etc.
- Actualizar `unidad5v2/README.md` cuando esté activo.

**Aceptación:**

- Un push directo a `main` es rechazado.
- Un PR con CI o SonarCloud en rojo no se puede mergear.
- Un PR sin aprobación no se puede mergear.
- La configuración queda documentada y reproducible.

**Riesgos:** permisos de administrador del repositorio; checks con nombres
exactos; SonarCloud requiere `SONAR_TOKEN`.

**Esfuerzo:** 0,5 día (más permisos).

---

## Resumen de esfuerzo

| # | Brecha | Esfuerzo |
|---|---|---|
| 1 | Scheduler de notificaciones | 1,5–2 días |
| 2 | Comprobante de pago definitivo | 1,5–2 días |
| 3 | SMTP real | 0,5–1 día |
| 4 | Persistencia de comprobantes | 2–3 días |
| 5 | Migraciones en Render | 1–2 días |
| 6 | Dispositivo + EAS | 1–2 días |
| 7 | Email en usuarios nuevos | 0,5 día |
| 8 | Branch protection | 0,5 día |

Total estimado: **9–13 días** de trabajo, sin contar aprovisionamiento de
cuentas externas (SMTP, storage, Expo/EAS, SonarCloud).
