# Requerimientos, Historias de Usuario y Casos de Uso

## Proyecto

**Centro Educativo "EDUCAR PARA TRANSFORMAR" - Sistema de Gestión**

Este documento consolida y corrige los requisitos del sistema. La denominación oficial de la institución es **EDUCAR PARA TRANSFORMAR**.

## 1. Alcance

El sistema de gestión centralizará la información académica, extracurricular y de servicios del centro educativo. En esta etapa se contemplan los portales de alumnos, padres, docentes, administración y Dirección.

La página web institucional y la aplicación móvil forman parte del escenario general de automatización, pero no se incluyen como funcionalidades obligatorias de las historias de usuario de esta etapa del sistema de gestión.

## 2. Roles

- **Alumno:** consulta sus datos, actualiza sus contactos y gestiona inscripciones propias.
- **Padre:** consulta y gestiona información exclusivamente de sus hijos asociados.
- **Docente:** consulta su perfil, carga horaria y alumnos; puede actualizar sus contactos.
- **Administrador:** administra los datos generales, usuarios, permisos, servicios y reportes.
- **Director:** configura y consulta reportes institucionales para la toma de decisiones.

## 3. Requerimientos funcionales

### Módulo Alumno

- **RF-AL-01:** El sistema debe permitir al alumno consultar su legajo, DNI, nombre, apellido, fecha de nacimiento, domicilio, nivel educativo, curso y estado.
- **RF-AL-02:** El sistema debe permitir al alumno modificar su correo electrónico y teléfono.
- **RF-AL-03:** El sistema debe permitir al alumno inscribirse a actividades deportivas.
- **RF-AL-04:** El sistema debe permitir al alumno inscribirse a un recorrido del servicio de transporte.
- **RF-AL-05:** El sistema debe permitir al alumno inscribirse al servicio de comedor.
- **RF-AL-06:** El sistema debe permitir al alumno generar su Reporte de Alumno con curso, materias, profesores, deportes, horarios y servicios utilizados.

### Módulo Padre

- **RF-PA-01:** El sistema debe permitir al padre consultar profesores por materia y deportes de sus hijos asociados.
- **RF-PA-02:** El sistema debe permitir al padre inscribir a sus hijos al cursado del año lectivo.
- **RF-PA-03:** El sistema debe impedir que el padre consulte o gestione información de alumnos no asociados a su cuenta.

### Módulo Docente

- **RF-PR-01:** El sistema debe permitir al docente consultar legajo, DNI, nombre, apellido, especialidad, estado, materias, cursos y niveles a su cargo.
- **RF-PR-02:** El sistema debe permitir al docente modificar su correo electrónico y teléfono.
- **RF-PR-03:** El sistema debe permitir al docente generar su Reporte Docente con cursos a cargo por nivel y horarios.
- **RF-PR-04:** El sistema debe permitir al docente generar listados de alumnos por curso y por materia, limitados a sus asignaciones.

### Módulo Administrador

- **RF-AD-01:** El sistema debe permitir al administrador gestionar alumnos, padres, profesores, niveles, cursos, materias, deportes, horarios e inscripciones.
- **RF-AD-02:** El sistema debe permitir al administrador gestionar los servicios de transporte y comedor.
- **RF-AD-03:** El sistema debe permitir al administrador gestionar usuarios y asignar roles y permisos.
- **RF-AD-04:** El sistema debe permitir al administrador consultar y generar todos los reportes institucionales autorizados.

### Módulo Dirección

- **RF-DI-01:** El sistema debe permitir al Director crear, editar, activar y desactivar plantillas de reportes institucionales.
- **RF-DI-02:** El sistema debe permitir al Director generar reportes configurados con los parámetros seleccionados.
- **RF-DI-03:** El sistema debe permitir consultar listados de alumnos por curso, materia, deporte, nivel, horario, profesor y recorrido de transporte.

## 4. Requerimientos no funcionales

- **RNF-01 Seguridad:** El sistema debe autenticar a los usuarios y aplicar control de acceso basado en roles (RBAC).
- **RNF-02 Privacidad:** Cada usuario solo debe acceder a la información correspondiente a su rol y relaciones autorizadas.
- **RNF-03 Integridad:** La base de datos debe garantizar relaciones consistentes, restricciones de unicidad y prevención de inscripciones duplicadas.
- **RNF-04 Disponibilidad:** El sistema debe estar disponible para accesos concurrentes de alumnos, padres, docentes y personal administrativo.
- **RNF-05 Usabilidad:** La interfaz debe ser clara y responsive para computadoras y dispositivos móviles.
- **RNF-06 Mantenibilidad:** El código debe estar organizado por capas y documentado en el repositorio.
- **RNF-07 Auditoría:** Las operaciones administrativas relevantes deben registrar usuario, fecha, operación y resultado.

## 5. Reglas de negocio

- **RN-01:** Un alumno puede inscribirse como máximo a dos deportes simultáneamente.
- **RN-02:** El sistema debe impedir inscripciones deportivas con horarios superpuestos.
- **RN-03:** Cada alumno pertenece a un único curso y cada curso pertenece a un único nivel educativo.
- **RN-04:** Un padre puede tener uno o varios hijos asociados, pero solo puede acceder a ellos.
- **RN-05:** El servicio de transporte tiene exactamente cuatro recorridos configurables por el administrador.
- **RN-06:** No pueden existir inscripciones duplicadas de cursado, deportes, transporte o comedor.
- **RN-07:** Cada usuario debe acceder únicamente a los módulos permitidos por su rol.
- **RN-08:** Una materia puede dictarse en varios cursos y tener distintos docentes según el curso.
- **RN-09:** Cada deporte debe tener un docente responsable y puede dividirse en grupos por nivel y horario.

## 6. Clasificación del sistema de información

El sistema es híbrido:

- **TPS:** procesa operaciones diarias como inscripciones, altas, modificaciones y uso de servicios.
- **MIS:** transforma los datos operativos en reportes para la administración y la Dirección.

## 7. Arquitectura de la información

### Portal de Alumno y Padre

- Mi perfil.
- Mis estudios.
- Mis actividades deportivas.
- Mis servicios de transporte y comedor.
- Mis reportes.
- Mis hijos, visible únicamente para el rol Padre.

### Portal Docente

- Mi perfil.
- Mi carga horaria.
- Mis materias y cursos.
- Mis alumnos.
- Mis reportes.

### Panel Administrador

- Gestión académica.
- Gestión de usuarios y permisos.
- Gestión de deportes y grupos.
- Gestión de transporte y comedor.
- Gestión de inscripciones.
- Reportes institucionales.

### Módulo Dirección

- Plantillas de reportes.
- Parámetros de consulta.
- Reportes institucionales.

## 8. Arquitectura de software

Se utilizará una arquitectura web de tres capas, complementada con el patrón MVC:

1. **Presentación:** interfaz responsive para los distintos roles.
2. **Lógica de negocio:** API, autenticación, autorización y validación de reglas de negocio.
3. **Acceso a datos:** persistencia relacional, integridad referencial y consultas para reportes.

### Componentes

- Frontend web.
- Backend con API REST.
- Módulo de autenticación y autorización RBAC.
- Módulos de alumnos, padres, docentes, administración y Dirección.
- Motor de reportes.
- Base de datos relacional.

### Conectores

- El frontend se comunica con el backend mediante HTTP/HTTPS y JSON.
- El backend se comunica con la base de datos mediante un ORM o repositorio de datos.
- El motor de reportes recibe consultas autorizadas y genera resultados en pantalla y, opcionalmente, PDF o CSV.

### Tecnologías

La selección definitiva queda a cargo del equipo. Se recomienda:

- **Frontend:** React, Vue o Angular.
- **Backend:** Node.js, Spring Boot, .NET, Django o FastAPI.
- **Base de datos:** PostgreSQL, MySQL o SQL Server.
- **Autenticación:** sesiones seguras o tokens JWT, según la implementación elegida.
- **Repositorio:** GitHub o GitLab.
- **Gestión:** Jira, GitHub Projects u otra herramienta con tablero Kanban.

## 9. Historias de usuario

### HU-01 - Inscripción a deportes

**Como** Alumno, **quiero** inscribirme a actividades deportivas para participar en propuestas extracurriculares.

**Criterios de aceptación:**

- Se muestra el catálogo de deportes y grupos disponibles.
- No se permite superar dos deportes activos.
- No se permite seleccionar horarios superpuestos.
- La inscripción confirma deporte, grupo, horario y docente responsable.

### HU-02 - Consulta de información académica

**Como** Padre, **quiero** consultar la información académica y deportiva de mis hijos para realizar su seguimiento.

**Criterios de aceptación:**

- Se muestran únicamente los hijos asociados.
- Se muestran profesores por materia y deportes activos.
- Un intento de acceso a un alumno no asociado es rechazado.
- Si no existen asociaciones, se informa la situación al padre.

### HU-03 - Actualización de datos de contacto

**Como** Alumno o Docente, **quiero** modificar mi correo electrónico y teléfono para mantener mis datos actualizados.

**Criterios de aceptación:**

- Cada usuario solo puede modificar sus propios datos.
- Se valida el formato del correo y los campos obligatorios.
- Los cambios válidos se persisten y muestran confirmación.
- Los datos inválidos no se guardan y muestran un mensaje de error.

### HU-04 - Gestión de usuarios y roles

**Como** Administrador, **quiero** crear, editar, desactivar y asignar roles a los usuarios para controlar el acceso al sistema.

**Criterios de aceptación:**

- Se pueden gestionar usuarios y sus estados.
- Es obligatorio asignar un rol válido: Alumno, Padre, Docente, Administrador o Director.
- El usuario accede únicamente a las funciones permitidas por su rol.
- No se permiten usuarios duplicados según las claves definidas.

### HU-05 - Listado de alumnos por materia

**Como** Docente, **quiero** generar el listado de alumnos de las materias que dicto para controlar mis cursos.

**Criterios de aceptación:**

- El docente solo puede seleccionar materias y cursos asignados a él.
- El listado incluye nivel, curso, materia, profesor, alumno y legajo.
- La consulta respeta el control de acceso.
- Se puede exportar el resultado a CSV si se implementa dicha funcionalidad.

### HU-06 - Inscripción al servicio de transporte

**Como** Alumno, **quiero** seleccionar un recorrido de transporte para asegurar mi traslado a la institución.

**Criterios de aceptación:**

- Se muestran exactamente cuatro recorridos disponibles.
- El alumno solo puede tener un recorrido activo.
- Se bloquean inscripciones duplicadas.
- La inscripción confirmada queda asociada al alumno y recorrido seleccionado.

### HU-07 - Configuración de reportes institucionales

**Como** Director, **quiero** configurar plantillas de reportes institucionales para obtener información útil para la toma de decisiones.

**Criterios de aceptación:**

- El Director puede seleccionar una entidad base y los campos del reporte.
- El nombre de la plantilla es obligatorio.
- Debe seleccionarse al menos un parámetro.
- La plantilla se puede guardar, editar, activar o desactivar.
- Solo usuarios autorizados pueden consultar o generar el reporte.

## 10. Casos de uso resumidos

| ID | Caso de uso | Actor | Historia relacionada |
|---|---|---|---|
| CU-01 | Inscribirse a un deporte | Alumno | HU-01 |
| CU-02 | Consultar información de un hijo | Padre | HU-02 |
| CU-03 | Actualizar datos de contacto | Alumno o Docente | HU-03 |
| CU-04 | Gestionar usuarios y roles | Administrador | HU-04 |
| CU-05 | Generar listado de alumnos por materia | Docente | HU-05 |
| CU-06 | Inscribirse a un recorrido de transporte | Alumno | HU-06 |
| CU-07 | Configurar plantilla de reporte institucional | Director | HU-07 |

## 11. Funcionalidad adicional de valor

Se propone incorporar un **panel de alertas y notificaciones**. El sistema notificará al usuario cuando una inscripción sea confirmada o rechazada, cuando exista un conflicto de horario o cuando se modifique información relevante de un curso, deporte o servicio.

Esta funcionalidad agrega valor porque reduce consultas manuales, mejora la comunicación y permite detectar rápidamente problemas de inscripción o cambios operativos.
