# Diseño de la aplicación móvil (Parte 3)

Fecha: 2026-10-23
Estado: vigente para la implementación de los Sprints 1 a 6.

## 1. Decisiones arquitectónicas

| Tema | Decisión |
|---|---|
| App móvil | `apps/mobile` con React Native + Expo + TypeScript y Expo Router. |
| Backend | Se reutiliza `apps/api`; no se duplica autenticación, RBAC, auditoría ni reportes. |
| Base de datos | PostgreSQL existente; migraciones incrementales `006_...` en adelante. |
| Comprobantes | Filesystem local en `uploads/receipts` (ruta configurable por `UPLOADS_DIR`). |
| Correo | Nodemailer con transporte de prueba en desarrollo y SMTP por variables de entorno. |
| Factura PDF | PDFKit en la API; se adjunta al correo de recordatorio. |
| Recuperación de contraseña | Token de un uso por correo, hash SHA-256, vencimiento 60 minutos. |
| Pagos | Parciales por subconjunto de ítems; sin pagos en efectivo. |
| Sesión móvil | JWT existente, almacenado con `expo-secure-store`. |

## 2. Navegación por rol

- **Padre/madre:** Resumen, Cuotas, Pagos, Historial, Perfil.
- **Administrador:** Resumen, Comprobantes pendientes, Facturas, Tarifas, Reportes.
- **Dirección:** Reportes y panel de morosidad (en la web; el móvil muestra un resumen).
- **Alumno/docente:** solo perfil y consulta, si el alcance lo permite.

## 3. Modelo de datos

### `billing_tariffs`

| Columna | Tipo | Nota |
|---|---|---|
| id | SERIAL PK | |
| kind | VARCHAR(20) | `monthly`, `sport`, `transport`, `cafeteria` |
| sport_id | INTEGER FK sports | obligatorio solo para `sport` |
| transport_route_id | INTEGER FK transport_routes | obligatorio solo para `transport` |
| amount | NUMERIC(12,2) | >= 0 |
| valid_from | DATE | vigencia desde |
| valid_to | DATE NULL | vigencia hasta |
| created_by | INTEGER FK users | auditoría |
| created_at | TIMESTAMPTZ | |

Restricción `CHECK` por `kind`; índice por `kind` y vigencia.

### `invoices`

| Columna | Tipo | Nota |
|---|---|---|
| id | SERIAL PK | |
| student_id | INTEGER FK students | |
| period_year | INTEGER | |
| period_month | SMALLINT | 1..12 |
| issue_date | DATE | |
| due_date | DATE | vencimiento |
| total_amount | NUMERIC(12,2) | suma de ítems |
| status | VARCHAR(20) | `pending`, `partial`, `paid`, `cancelled` |
| created_by | INTEGER FK users | |
| created_at | TIMESTAMPTZ | |

`UNIQUE (student_id, period_year, period_month)`.

### `invoice_items`

| Columna | Tipo | Nota |
|---|---|---|
| id | SERIAL PK | |
| invoice_id | INTEGER FK invoices ON DELETE CASCADE | |
| kind | VARCHAR(20) | igual que tarifas |
| description | VARCHAR(160) | texto para el padre |
| sport_id / transport_route_id | INTEGER FK NULL | trazabilidad |
| tariff_id | INTEGER FK billing_tariffs | valor aplicado |
| amount | NUMERIC(12,2) | |
| paid_amount | NUMERIC(12,2) | default 0 |
| status | VARCHAR(20) | `pending`, `partial`, `paid` |

`UNIQUE (invoice_id, kind, description)` para evitar duplicados.

### `payment_receipts`

| Columna | Tipo | Nota |
|---|---|---|
| id | SERIAL PK | |
| invoice_id | INTEGER FK invoices | |
| uploaded_by | INTEGER FK users | padre |
| file_name | VARCHAR(160) | |
| file_path | TEXT | ruta relativa |
| mime_type | VARCHAR(80) | |
| size_bytes | INTEGER | |
| claimed_amount | NUMERIC(12,2) | suma de ítems reclamados |
| status | VARCHAR(20) | `pending`, `approved`, `rejected` |
| rejection_reason | TEXT NULL | |
| reviewed_by / reviewed_at | FK users / TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `payment_receipt_items`

`receipt_id`, `invoice_item_id`, PK compuesta.

### `payments`

`id`, `receipt_id` UNIQUE FK, `invoice_id` FK, `amount`, `approved_by`, `created_at`.

### `payment_allocations`

`id`, `payment_id` FK, `invoice_item_id` FK, `amount`, `UNIQUE (payment_id, invoice_item_id)`.

### `notification_deliveries`

`id`, `user_id`, `kind`, `period_year`, `period_month`, `idempotency_key` UNIQUE, `status`, `error`, `metadata`, `sent_at`, `created_at`.

### `password_reset_tokens`

`id`, `user_id`, `token_hash` UNIQUE, `expires_at`, `used_at`, `created_at`.

### `users.email`

Se agrega `email VARCHAR(160)` para recuperación de contraseña y notificaciones.

## 4. Contratos de API

### Autenticación

- `POST /api/auth/login` (existente).
- `POST /api/auth/forgot-password` `{ username }` → 200 siempre.
- `POST /api/auth/reset-password` `{ token, newPassword }`.
- `PATCH /api/me/password` `{ currentPassword, newPassword }` (autenticado).

### Tarifas (admin)

- `GET /api/admin/billing/tariffs`
- `POST /api/admin/billing/tariffs` `{ kind, sportId?, transportRouteId?, amount, validFrom? }`
- `PATCH /api/admin/billing/tariffs/:id` `{ amount?, validTo? }`

### Facturas (admin)

- `POST /api/admin/billing/invoices/generate` `{ year, month }`
- `GET /api/admin/billing/invoices?year=&month=&studentId=`
- `GET /api/admin/billing/invoices/:id`
- `GET /api/admin/billing/receipts?status=pending`
- `POST /api/admin/billing/receipts/:id/approve`
- `POST /api/admin/billing/receipts/:id/reject` `{ reason }`

### Padre

- `GET /api/parent/billing/children/:studentId/summary`
- `GET /api/parent/billing/children/:studentId/invoices?from=&to=`
- `GET /api/parent/billing/invoices/:id`
- `POST /api/parent/billing/invoices/:id/receipts` (multipart: `file`, `itemIds` JSON)
- `GET /api/parent/billing/bank-details`

### Reportes

- `GET /api/admin/billing/reports/income?from=&to=`
- `GET /api/admin/billing/reports/payments?from=&to=&status=`
- `GET /api/admin/billing/reports/services?from=&to=`
- `GET /api/admin/billing/delinquency?year=&month=`

### Notificaciones (admin)

- `POST /api/admin/billing/notifications/reminders` `{ year, month }`
- `POST /api/admin/billing/notifications/debt` `{ year, month }`

## 5. Reglas de negocio

- Una factura por alumno y período; generación idempotente.
- La cuota base siempre se incluye; deportes, transporte y comedor solo si están activos.
- El transporte es opcional.
- Un comprobante pendiente no acredita pago.
- La aprobación imputa solo los ítems reclamados y no duplica acreditaciones.
- El rechazo exige motivo y deja los ítems pendientes.
- Los pagos parciales actualizan el saldo del ítem y de la factura.
- Los correos usan clave de idempotencia por usuario/período/tipo.

## 6. Rebanadas verticales

1. **S1:** migración 006 + tarifas + generación de facturas + auth móvil.
2. **S2:** consulta de cuotas, facturas y deuda del padre.
3. **S3:** selección de ítems, carga de comprobante, aprobación/rechazo.
4. **S4:** reset de contraseña, SMTP, recordatorio y aviso de deuda con PDF.
5. **S5:** reportes de cobranza y panel de morosidad.
6. **S6:** pruebas integrales, datos demo, documentación y smoke tests.

## 7. Riesgos y supuestos

- No hay servidor SMTP real: se usa transporte de prueba y variables de entorno.
- No hay almacenamiento externo: los comprobantes viven en el filesystem del contenedor; en producción debe montarse un volumen.
- Expo no se compila en CI: se valida con TypeScript y el build de la API/web; la app se prueba en Expo Go/dispositivo.
- La defensa del 10–11/11 exige priorizar el núcleo económico; los reportes avanzados y morosidad quedan al final.
