# Planificación de Sprints

## Proyecto

**Centro Educativo "EDUCAR PARA TRANSFORMAR" - Sistema de Gestión**

La planificación se organiza en tres sprints de una semana cada uno. Las historias están ordenadas considerando prioridad, dependencias y riesgo técnico.

## Backlog General

| ID | Historia de usuario | Actor principal | Prioridad | Puntos | Sprint |
|---|---|---|---|---:|---:|
| HU-01 | Inscripción a deportes | Alumno | Alta | 5 | 1 |
| HU-02 | Consulta de información académica | Padre | Alta | 3 | 1 |
| HU-03 | Actualización de datos de contacto | Alumno y Docente | Media | 3 | 2 |
| HU-04 | Gestión de usuarios y roles | Administrador | Crítica | 8 | 2 |
| HU-05 | Generación del listado de alumnos por materia | Docente | Media | 3 | 3 |
| HU-06 | Inscripción al servicio de transporte | Alumno | Alta | 5 | 3 |
| HU-07 | Configuración de reportes institucionales | Director | Media | 5 | 3 |

## Sprint 1

### Duración

Una semana.

### Objetivo

Implementar las funcionalidades principales de autogestión extracurricular y consulta familiar, incluyendo el control de acceso a la información de los hijos.

### Historias incluidas

| ID | Título | Prioridad | Estimación | Estado |
|---|---|---|---:|---|
| HU-01 | Inscripción a deportes | Alta | 5 puntos | Done |
| HU-02 | Consulta de información académica | Alta | 3 puntos | Done |

**Total:** 8 puntos de historia.

### Plan de trabajo

- **Días 1 y 2:** modelado de alumnos, padres, cursos, deportes, grupos y horarios; diseño del catálogo de deportes.
- **Días 3 y 4:** implementación de la inscripción deportiva, límite de dos deportes y validación de conflictos de horarios; implementación de la consulta de hijos.
- **Día 5:** pruebas funcionales y de autorización, integración, corrección de errores y demostración del sprint.

### Criterios de terminado

- HU-01 y HU-02 cumplen todos sus criterios de aceptación.
- Las restricciones de máximo de dos deportes y conflictos de horarios fueron probadas.
- Un padre solo puede consultar hijos asociados a su cuenta.
- El código fue revisado e integrado al repositorio.
- Las funcionalidades están disponibles en el entorno de pruebas.

## Sprint 2

### Duración

Una semana.

### Objetivo

Implementar la autogestión de datos de contacto y la administración de usuarios con sus roles y permisos.

### Historias incluidas

| ID | Título | Prioridad | Estimación | Estado |
|---|---|---|---:|---|
| HU-03 | Actualización de datos de contacto | Media | 3 puntos | Done |
| HU-04 | Gestión de usuarios y roles | Crítica | 8 puntos | Done |

**Total:** 11 puntos de historia.

### Plan de trabajo

- **Días 1 y 2:** formularios para actualizar correo y teléfono de alumnos y docentes; validaciones de formato y persistencia.
- **Días 3 y 4:** alta, consulta, modificación y baja de usuarios; asignación de roles y configuración de permisos RBAC.
- **Día 5:** pruebas de validación, seguridad e integración; corrección de errores y demostración del sprint.

### Criterios de terminado

- HU-03 permite actualizar los datos de contacto de alumnos y docentes.
- HU-04 exige un rol válido para cada usuario.
- Cada rol solo puede acceder a sus módulos y datos permitidos.
- Se realizaron pruebas funcionales, de integración y de seguridad.
- El código fue revisado e integrado al repositorio.

## Sprint 3

### Duración

Una semana.

### Objetivo

Completar los reportes operativos y la gestión del servicio de transporte, incorporando la configuración de reportes institucionales para la Dirección.

### Historias incluidas

| ID | Título | Prioridad | Estimación | Estado |
|---|---|---:|---:|---|
| HU-05 | Generación del listado de alumnos por materia | Media | 3 puntos | Done |
| HU-06 | Inscripción al servicio de transporte | Alta | 5 puntos | Done |
| HU-07 | Configuración de reportes institucionales | Media | 5 puntos | Done |

**Total:** 13 puntos de historia.

### Plan de trabajo

- **Días 1 y 2:** listado de alumnos por materia para docentes, restringido a sus cursos y materias.
- **Días 2 y 3:** inscripción al transporte, visualización de los cuatro recorridos y prevención de duplicados.
- **Días 3 y 4:** configuración de plantillas de reportes institucionales para la Dirección y generación de reportes.
- **Día 5:** pruebas unitarias, funcionales, de integración y de permisos; corrección de incidencias, demostración final y cierre.

### Criterios de terminado

- HU-05 muestra únicamente información que corresponde al docente autenticado.
- HU-06 permite seleccionar uno de los cuatro recorridos y evita inscripciones duplicadas.
- HU-07 permite al Director definir y guardar una plantilla con parámetros válidos.
- Los reportes solicitados se generan con los campos definidos.
- Todas las pruebas fueron aprobadas y las funcionalidades están integradas para la demostración final.

## Definición general de terminado

Una historia se considera terminada cuando cumple sus criterios de aceptación, cuenta con validaciones de errores, fue probada, revisada por el equipo, integrada al repositorio y desplegada en el entorno de pruebas.

## Seguimiento del proyecto

El equipo utilizará un tablero Kanban en Jira, GitHub Projects u otra herramienta equivalente. Se registrarán las tareas del equipo y la participación individual de cada integrante mediante asignaciones, comentarios, avances y evidencias.
