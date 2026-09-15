# Educar para Transformar

Aplicación Sprint 1 del sistema de gestión del Centro Educativo **EDUCAR PARA TRANSFORMAR**. Es un monorepo con React + TypeScript, API Node.js + TypeScript, PostgreSQL y autenticación JWT.

## Alcance de Sprint 1

- Inicio de sesión real con usuario, contraseña, JWT y autorización por rol.
- Portal Alumno: catálogo de deportes, grupos, docentes, horarios, inscripción y cancelación.
- Reglas de inscripción: máximo dos deportes, sin superposición de horarios y sin duplicados.
- Portal Padre: únicamente hijos asociados, materias, docentes y resumen deportivo.
- Panel Administrador: listado, alta de usuarios y gestión de rol/estado.
- Roles Docente y Dirección autenticados con una pantalla clara de funcionalidad pendiente.
- Auditoría de inscripciones, cancelaciones y operaciones administrativas.

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

La base se inicializa con `database/schema.sql` y `database/seed.sql` al crear el volumen por primera vez. Para reinicializar los datos demo en un entorno local:

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

Las pruebas del backend cubren autenticación y RBAC, aislamiento padre-hijo, límite de dos deportes, conflictos de horario, duplicados y auditoría de una operación rechazada. Se ejecutan con `pg-mem` y la misma estructura SQL del proyecto, sin necesitar una base PostgreSQL de test.

## API principal

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/student/dashboard`
- `POST /api/student/enrollments`
- `DELETE /api/student/enrollments/:groupId`
- `GET /api/parent/children`
- `GET /api/parent/children/:studentId/summary`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:userId`

Todas las rutas excepto login y health requieren `Authorization: Bearer <token>`. La API vuelve a consultar el usuario en cada request, por lo que una cuenta desactivada pierde acceso aunque conserve un JWT anterior.
