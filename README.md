# Educar para Transformar

Aplicación de los Sprints 1, 2 y 3 del sistema de gestión del Centro Educativo **EDUCAR PARA TRANSFORMAR**. Es un monorepo con React + TypeScript, API Node.js + TypeScript, PostgreSQL y autenticación JWT.

## Alcance de Sprints 1, 2 y 3

- Inicio de sesión real con usuario, contraseña, JWT y autorización por rol.
- Portal Alumno: catálogo de deportes, grupos, docentes, horarios, inscripción y cancelación.
- Módulo Alumno: perfil académico, actualización de contacto, transporte, comedor y reporte personal.
- Reglas de inscripción: máximo dos deportes, sin superposición de horarios y sin duplicados.
- Portal Padre: únicamente hijos asociados, materias, docentes y resumen deportivo.
- Panel Administrador: listado, alta de usuarios y gestión de rol/estado, con perfiles iniciales para alumnos, padres y docentes.
- Sprint 2: actualización de contacto para alumnos y docentes, con validación de correo y teléfono.
- Sprint 3: listado de alumnos por materia para docentes (HU-05), inscripción al transporte (HU-06) y plantillas de reportes institucionales para la Dirección (HU-07) con exportación CSV.
- Auditoría de inscripciones, cancelaciones, operaciones administrativas y generación de reportes.

## Estructura

```text
apps/api/       API Express, servicios de negocio, JWT y pruebas Vitest
apps/web/       Frontend React/Vite responsive
database/       Esquema y datos demo PostgreSQL
docs/           Documentación existente del proyecto, preservada
```

## Requisitos

- Podman.

Node.js y PostgreSQL se ejecutan dentro de los contenedores; no es necesario instalarlos en el host.

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

La base se inicializa con `database/schema.sql` y `database/seed.sql`. El script aplica además las migraciones de `database/migrations/` (`002_student_and_sprint2.sql`, `003_sprint3.sql`) para actualizar volúmenes existentes. Para reinicializar los datos demo en un entorno local:

```bash
podman rm -f educar-web educar-api educar-db
podman volume rm educar-postgres-data
./scripts/start.sh
```

El secreto JWT de `apps/api/.env` debe ser largo, aleatorio y exclusivo de cada entorno. Nunca usar el secreto de ejemplo en producción.

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

Las pruebas del backend cubren autenticación y RBAC, aislamiento padre-hijo, límite de dos deportes, conflictos de horario, duplicados, perfiles iniciales, contacto, transporte, comedor, reportes, listado docente (HU-05) y plantillas de reportes institucionales (HU-07). Se ejecutan con `pg-mem` y la misma estructura SQL del proyecto, sin necesitar una base PostgreSQL de test.

## API principal

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/student/dashboard`
- `GET /api/student/report`
- `PATCH /api/me/contact`
- `POST /api/student/enrollments`
- `DELETE /api/student/enrollments/:groupId`
- `POST /api/student/transport`
- `DELETE /api/student/transport`
- `POST /api/student/cafeteria`
- `DELETE /api/student/cafeteria`
- `GET /api/parent/children`
- `GET /api/parent/children/:studentId/summary`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `GET /api/teacher/courses`
- `GET /api/teacher/courses/students`
- `GET /api/director/report-entities`
- `GET /api/director/report-templates`
- `POST /api/director/report-templates`
- `PATCH /api/director/report-templates/:templateId`
- `POST /api/director/report-templates/:templateId/generate`

Todas las rutas excepto login y health requieren `Authorization: Bearer <token>`. La API vuelve a consultar el usuario en cada request, por lo que una cuenta desactivada pierde acceso aunque conserve un JWT anterior.

## Patrones de Diseño

Los tres patrones de diseño clásicos (GoF) se implementaron en la capa de API del backend. A continuación se detalla el archivo exacto y las líneas donde se encuentran.

### Singleton — Pool de conexiones único

**Archivo:** `apps/api/src/db.ts` — **líneas 17–49**

Garantiza que durante todo el ciclo de vida del proceso exista una sola instancia del `Pool` de conexiones de PostgreSQL. La primera llamada a `getPool(connectionString)` crea el pool; las llamadas siguientes devuelven la misma instancia sin importar cuántas veces se invoque.

```
apps/api/src/db.ts
  L17  let _poolInstance: DatabasePool | null = null;   ← estado singleton
  L28  export function getPool(...)                      ← punto de acceso único
  L44  export async function destroyPool()               ← limpieza (tests)
```

**Motivación:** evita que múltiples módulos abran conjuntos de conexiones independientes, saturando el límite de conexiones de PostgreSQL.

---

### Proxy — Auditoría transparente de sentencias SQL

**Archivo:** `apps/api/src/audit.proxy.ts` — **líneas 51–99**

`AuditingQueryProxy` implementa la interfaz `Queryable` y envuelve otro `Queryable` (el sujeto real: un `Pool` o `PoolClient`). Intercepta cada llamada a `query()` y, cuando detecta una sentencia de escritura (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`), emite de forma no bloqueante un registro en `audit_logs`.

```
apps/api/src/audit.proxy.ts
  L51  export class AuditingQueryProxy implements Queryable  ← clase Proxy
  L72  async query(...)                                       ← interceptor
  L81  this._recordAudit(...)                                ← delegación + auditoría
  L90  private async _recordAudit(...)                       ← escritura en audit_logs
```

**Motivación:** añade auditoría automática de escrituras sin modificar los servicios existentes ni la interfaz real del Pool.

---

### Iterator — Recorrido uniforme de filas de reporte

**Archivo:** `apps/api/src/report.service.ts` — **líneas 254–324**

`ReportRowIterator` implementa `Iterator<Record<string,string>>` e `Iterable<Record<string,string>>`. Encapsula el estado de recorrido interno (`_index`) y expone la interfaz estándar de JavaScript, permitiendo iterar las filas de un `GeneratedReport` con `for...of` o con llamadas manuales a `.next()`. La función auxiliar `iterateReport(report)` (línea 324) construye el iterador directamente a partir de un reporte generado.

```
apps/api/src/report.service.ts
  L284  export class ReportRowIterator implements Iterator<...>, Iterable<...>
  L295  next(): IteratorResult<...>                   ← avance del cursor
  L305  reset(): void                                 ← reinicio
  L311  [Symbol.iterator]()                           ← soporte for...of
  L322  export function iterateReport(report)         ← función de conveniencia
```

**Motivación:** desacopla al consumidor de la estructura interna del array de filas, facilita la paginación o el filtrado futuro sin modificar `GeneratedReport`.
