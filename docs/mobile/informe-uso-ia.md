---
title: "Informe de uso de la IA en programación"
subtitle: "Parte 3 — Aplicación móvil de gestión de cuotas"
---

**Materia:** Metodología de Sistemas II\
**Trabajo práctico:** Educar para Transformar — Parte 3 (aplicación móvil)\
**Fecha de entrega:** 17 de noviembre de 2026\
**Integrantes:**
- Ian Hakanson
- Elias Morales

---

## 1) Relación entre la aplicación web y la aplicación móvil

### Funcionalidades que ya existían en la web

La Parte 2 del trabajo práctico entregó un sistema de gestión completo para el
centro educativo, con cinco roles (alumno, padre, docente, administrador y
dirección) y autenticación JWT con control de acceso por rol. Sobre ese sistema
la web ya resolvía:

- consulta y actualización de datos personales y académicos (alumno, padre,
  docente);
- inscripción a deportes, transporte y comedor, con sus reglas de negocio
  (máximo dos deportes, horarios sin solapamiento, recorrido único);
- gestión administrativa de usuarios, roles, estructura académica, servicios y
  años lectivos;
- reportes institucionales con plantillas configurables y filtros por nivel,
  curso, deporte, horario, docente y recorrido;
- auditoría de las operaciones administrativas relevantes.

Toda esa funcionalidad sigue disponible en la web y **no se duplicó** en la
aplicación móvil.

### Funcionalidades que se incorporaron en la aplicación móvil

La Parte 3 agregó el circuito económico, que no existía: emisión de cuotas,
cobranza por transferencia y validación administrativa del pago.

| Módulo | Alcance |
|---|---|
| Autenticación | Login, logout, recuperación y cambio de contraseña, acceso por rol |
| Cuotas | Pendientes, pagadas, vencidas, importe, estado e historial |
| Pago | Selección de ítems, total discriminado, datos bancarios, carga de comprobante |
| Validación | Aprobación o rechazo del comprobante y emisión del comprobante de pago |
| Tarifas | Configuración de valores por cuota, deporte, transporte y comedor |
| Facturación | Emisión mensual de facturas con detalle de ítems |
| Reportes | Ingresos, pagos completos e incompletos por período y alumno, pagos por deporte, nivel, horario y docente, pagos por recorrido, morosidad y proyección de deuda |
| Notificaciones | Recordatorio del último día hábil con la factura adjunta y aviso de deuda el día 20 |

### Información que comparten

Ambos clientes leen y escriben sobre **la misma base PostgreSQL**. No hay una
base propia del móvil ni una copia de los datos:

- datos maestros: usuarios, roles, alumnos, padres, docentes, niveles, cursos,
  materias, deportes, grupos, recorridos y comedor;
- datos económicos nuevos: tarifas, facturas, ítems de factura, comprobantes,
  pagos, imputaciones de pago, envíos de notificación y tokens de recuperación.

### Cómo se comunican

La aplicación móvil consume la **misma API REST** que la web, sobre HTTPS y con
el mismo esquema de autenticación:

- `apps/mobile/src/api.ts` centraliza todas las llamadas, igual que
  `apps/web/src/api.ts` en la web;
- el token JWT se guarda en `expo-secure-store` (en web cae a `localStorage`);
- la API **revalida el usuario en cada request**, de modo que una cuenta
  desactivada pierde acceso aunque conserve un token viejo.

No se agregó un backend paralelo: el móvil es un tercer consumidor de la API
existente.

### Modificaciones necesarias en el backend

| Cambio | Detalle |
|---|---|
| Migración `006_billing_core.sql` | Tarifas, facturas, ítems, comprobantes, pagos, imputaciones y envíos |
| Migración `007_payment_receipts.sql` | Comprobante de pago numerado y tokens de recuperación de contraseña |
| Endpoints de facturación | 23 rutas bajo `/api/parent/billing/*` y `/api/admin/billing/*` |
| Generación de PDF | Facturas y comprobantes de pago con PDFKit |
| Correo | Nodemailer para recordatorios, aviso de deuda y recuperación de contraseña |
| Almacenamiento | Adaptador local/S3 para los comprobantes subidos |
| Scheduler | Cálculo de último día hábil y día 20, con envío idempotente |

### Qué se reutiliza y cómo se mantienen sincronizados los sistemas

Se reutilizaron los patrones ya establecidos en la Parte 2, que es lo que
garantiza que ambos clientes se comporten igual:

- **MVC en tres capas**: rutas en `app.ts`, lógica en `*.service.ts`;
- **Singleton** (`database.ts`) para el pool de conexiones;
- **Proxy** (`withAuditProxy`) para autorizar y auditar;
- **Iterator** (`rowIterator.ts`) en los reportes;
- `AppError` para los errores y `withTransaction` para las transacciones.

La sincronización es por construcción: hay **una sola fuente de verdad**, no hay
réplica ni caché de negocio en el móvil. Si un padre carga un comprobante, el
administrador lo ve en la web en la siguiente consulta; si el administrador
aprueba el pago, el padre lo ve en el móvil al refrescar. Las notificaciones
incluyen una clave de idempotencia para que un reintento no duplique el envío.

---

## 2) Registro de uso de la IA — Bitácora de IA

Cada sesión de trabajo con IA se registró en `docs/ai/BITACORA_IA.md`, con
objetivo, cambios, tests, estado y verificación. La siguiente tabla resume los
episodios más relevantes para el aprendizaje.

Los prompts se transcriben en forma abreviada; el registro completo y el
historial están en la bitácora del repositorio.

| Nº | Problema | Prompt utilizado | Herramienta de IA | Respuesta de IA | ¿Funcionó? | Modificaciones realizadas | Resultado |
|---|---|---|---|---|---|---|---|
| 1 | Diseñar el modelo económico de cuotas | «Diseñá el modelo de datos de tarifas, facturas, comprobantes y pagos respetando las migraciones incrementales» | Asistente IA (opencode) | Propuso tablas, claves e índices; incluyó una tabla de pagos sin imputaciones | Parcialmente | Se agregó `invoice_payment_allocations` para permitir pagos parciales sobre varios ítems | Correcto |
| 2 | Emitir facturas sin duplicados | «Implementá la emisión mensual de facturas con idempotencia» | Asistente IA | Usó restricción única por alumno y período dentro de una transacción | Sí | Se agregó la clave de idempotencia y un test específico | Correcto |
| 3 | Aprobación concurrente de comprobantes | «¿Qué pasa si dos administradores aprueban el mismo comprobante a la vez?» | Asistente IA | Explicó el problema pero no lo previno en el código inicial | No | Se agregó bloqueo con `FOR UPDATE` y un test de concurrencia | Reemplazado |
| 4 | Recordatorio del último día hábil | «Implementá el envío del último día hábil del mes y el día 20» | Asistente IA | Propuso `node-cron` dentro de la API | Parcialmente | Se separó el cálculo de fechas (función pura y testeable) del disparador | Correcto |
| 5 | Filtro de facturas por período en el móvil | «Agregá filtro desde/hasta al historial de facturas» | Asistente IA | Comparó la fecha de emisión como string contra el rango | No | Fallaba con `pg-mem`, que devuelve `Date`; se pasó a comparar por período (año-mes) | Reemplazado |
| 6 | Subida de comprobante en el APK | «Al enviar el comprobante la app dice *Unsupported FormDataPart implementation*» | Asistente IA | Proponía el pseudo-blob `{ uri, name, type }` de React Native | No | El `fetch` de Expo SDK 58 sólo acepta `string`, `Blob` u objetos con `bytes()`; se armó un objeto con `uri`, `name`, `type` y `bytes()` | Reemplazado |
| 7 | Compilar el APK | «¿Qué API de Android usa el proyecto?» | Asistente IA | Dijo `compileSdk 36`, leyendo un valor por defecto del plugin | No | React Native 0.88 fija 37; el build de Gradle reveló el error | Reemplazado |
| 8 | CI bloqueado antes del deploy | «SonarCloud falla por facturación» | Asistente IA | Diagnosticó un problema de facturación de SonarCloud | No | La anotación real decía que **GitHub Actions** tenía la cuenta bloqueada; SonarCloud funcionaba por *Automatic Analysis* | Reemplazado |
| 9 | CORS en el navegador | «Necesito una extensión de CORS para poder loguearme» | Asistente IA | Sostuvo que el backend ya permitía el origen | Parcialmente | Era correcto en local, pero la API desplegada sólo permitía el origen de la web; faltaba agregar `http://localhost:8081` | Correcto con ajuste |
| 10 | Íconos de la barra inferior | «Los íconos funcionan en el navegador pero no en el APK» | Asistente IA | Afirmó que era un problema de renderizado por plataforma | No | No existía ningún `tabBarIcon` en el código: se agregaron los íconos | Reemplazado |
| 11 | Tests con base en memoria | «Agregá tests de facturación con pg-mem» | Asistente IA | Escribió los casos y los fixtures | Sí | Se ajustaron tipos de fecha y secuencias para que coincidieran con PostgreSQL | Correcto |
| 12 | Generar la documentación técnica | «Documentá el procedimiento de build del APK» | Asistente IA | Redactó el procedimiento completo | Sí | Se corrigieron versiones de SDK tras verificarlas contra el proyecto real | Correcto |

**Balance:** de 12 episodios, 6 fueron correctos en el primer intento, 2
requirieron ajustes y 4 debieron reemplazarse. Los cuatro reemplazos tienen un
patrón común: la IA respondió con conocimiento **genérico** cuando el problema
dependía de una **versión concreta** del stack o del estado real del entorno.

---

## 3) IA vs. conocimiento del sistema

**¿Por qué una IA puede generar una solución técnicamente correcta pero
incorrecta para nuestro sistema?**

Porque «técnicamente correcto» se evalúa en el vacío, y nuestro sistema no es el
vacío. Un modelo de lenguaje produce la respuesta más probable dado un enunciado;
no conoce el estado de nuestro repositorio, las versiones exactas que tenemos
instaladas, las reglas de negocio de la cátedra ni las decisiones que ya tomamos.

**Contexto.** El ejemplo más claro es el del comprobante: enviar
`formData.append("file", { uri, name, type })` es *la* forma documentada de subir
archivos en React Native. Es correcto en general. Pero en Expo SDK 58 el `fetch`
global lo reemplaza Expo, y su conversor sólo acepta `string`, `Blob` u objetos
con `bytes()`. La respuesta era correcta para React Native y equivocada para
nuestro proyecto.

**Arquitectura.** La IA propuso inicialmente usar `node-cron` dentro de la API
para los recordatorios. Es una solución válida en abstracto, pero en nuestra
arquitectura la API corre en un contenedor de Render que puede dormirse o
reiniciarse, así que el cron no es confiable. Hubo que separar el cálculo de
fechas (función pura, testeable) del disparador.

**Reglas de negocio.** Ninguna regla de la cátedra surge del código: máximo dos
deportes por alumno, transporte opcional, sin pagos en efectivo, comprobante
obligatorio, validación administrativa previa, una factura con varios
comprobantes. La IA puede escribir el `if`, pero no sabe *cuál* `if` corresponde.
En más de una respuesta propuso validar el pago al subir el comprobante, lo que
contradice la regla de validación administrativa.

**Base de datos.** La IA tiende a asumir PostgreSQL «de manual». Nuestros tests
corren con `pg-mem`, que devuelve `Date` donde PostgreSQL devuelve string. Un
filtro que comparaba `invoice.issueDate < from` funcionaba en producción y
fallaba en los tests, o al revés. También desconocía que ya existían las tablas
de la Parte 2 y proponía crear duplicados.

**Requisitos.** La IA no distingue RF-MV de RF-AD ni sabe qué historia de usuario
está en juego. Cuando se le pidió «un reporte de pagos», generó uno; cuando se
le pidió el de RF-MV-23 (por deporte, nivel, horario y docente) hubo que
precisar los cuatro ejes, porque el genérico no los cubría.

**Permisos.** Un endpoint «de consulta de facturas» es trivial hasta que se
pregunta *quién* puede consultarlas. La regla de aislamiento padre-hijo
(RN-10) exige verificar la asociación en cada acceso, no sólo el rol. La IA
tendía a proteger por rol y no por vínculo.

**Tecnologías utilizadas.** El proyecto es ESM con `NodeNext`, con imports que
llevan `.js` aunque el fuente sea `.ts`. La IA escribía imports sin extensión,
válidos en otros proyectos y rotos en este. Lo mismo con el `compileSdk`: el
valor por defecto del plugin decía 36, el proyecto real usaba 37.

**Conclusión.** La IA aporta velocidad y cobertura, pero la validación tiene que
ser contra el sistema real: leer el código, correr los tests, leer el error
literal y verificar en el artefacto. En los cuatro casos en que hubo que
reemplazar una respuesta, la causa no fue una IA «mala» sino la ausencia de
contexto que sólo el equipo podía aportar.

---

## 4) Comparación: desarrollo tradicional vs. desarrollo asistido por IA

| Aspecto | Sin IA | Con IA |
|---|---|---|
| Generación de código | Más lenta; cada archivo se escribe desde cero | Muy rápida para estructura, CRUD, validaciones y tests repetitivos |
| Tiempo de desarrollo | Mayor en volumen de código; menor en corrección | Menor en la primera versión; se recupera tiempo en la depuración |
| Comprensión del código | Alta, porque se escribió | Riesgo de aceptar código que no se entiende; exige revisión activa |
| Detección de errores | Depende de la experiencia del equipo | Buena para errores de sintaxis y tipos; mala para errores de contexto |
| Documentación | Se posterga con frecuencia | Se genera junto con el código, pero hay que corregirla contra la realidad |
| Aprendizaje | Se aprende del error propio | Se aprende leyendo y discutiendo la propuesta; puede volverse superficial |
| Integración | Costosa pero previsible | Rápida, con riesgo de proponer piezas que no encajan con lo existente |
| Seguridad | Depende de las buenas prácticas del equipo | Reproduce patrones comunes, incluidos los que no corresponden al proyecto |
| Mantenimiento | El equipo conoce cada decisión | Necesita revisión: puede introducir dependencias o abstracciones innecesarias |
| Calidad del resultado | Consistente con el conocimiento del equipo | Alta en lo mecánico, variable en lo que depende del contexto |

---

## 5) Reflexión crítica

**1. ¿La utilización de IA redujo realmente el tiempo de desarrollo?**
Sí, pero no en la proporción esperada. Redujo mucho el tiempo de escritura y
casi nada el de verificación. El balance fue claramente positivo en la
construcción del módulo de cuotas y en los tests; fue neutro o negativo en los
problemas que dependían del entorno (compilación nativa, CI, CORS).

**2. ¿En qué tareas resultó más útil?**
En tareas con forma definida y criterio de aceptación claro: modelos de datos,
endpoints con validaciones, tests, documentación de procedimientos, refactors
acotados y explicación de mensajes de error.

**3. ¿En qué tareas produjo errores?**
En todo lo que dependía de una versión concreta o del estado real del entorno:
el tipo de `FormData` en Expo SDK 58, el `compileSdk` de React Native 0.88, el
origen permitido por CORS en el despliegue y el motivo real del bloqueo del CI.

**4. ¿Qué tipo de errores fueron más frecuentes?**
Errores de contexto, no de sintaxis. Código que compila y es lógicamente
razonable, pero que asume otra versión, otra base de datos, otras reglas u otra
arquitectura. También afirmaciones seguras sobre algo que no había verificado.

**5. ¿Fue necesario modificar código generado por IA?**
Sí, en todos los módulos. En algunos casos fueron ajustes menores de estilo y en
cuatro casos hubo que reemplazar la solución completa.

**6. ¿La IA comprendió correctamente la base de datos?**
Parcialmente. Entendió el esquema cuando se le dio explícitamente, pero no lo
infirió: propuso tablas duplicadas y desconocía diferencias de comportamiento
entre PostgreSQL y `pg-mem`.

**7. ¿La IA comprendió correctamente las reglas de negocio?**
No por sí sola. Las reglas de la cátedra no están en el código: hay que
enunciarlas. Cuando se le dieron los RF y RN por escrito, las respetó; cuando no,
propuso alternativas plausibles pero incorrectas.

**8. ¿Qué riesgos identificaron?**
Aceptar código sin comprenderlo; introducir dependencias innecesarias;
implementar una validación de permisos sólo por rol y no por vínculo;
diagnosticar por la apariencia del síntoma y no por la evidencia; y creer que un
build en verde implica que el artefacto hace lo correcto.

**9. ¿Qué conocimientos necesitó el equipo para validar las respuestas?**
Leer código ajeno, interpretar trazas de error, entender la diferencia entre
código compilado y bytecode, conocer el modelo de permisos del sistema, saber
leer una anotación de un check de GitHub y verificar artefactos (firmas, URLs
horneadas, permisos de Android).

**10. ¿Consideran que utilizar IA permite reemplazar el conocimiento del
programador?**
No. La IA acelera a quien sabe qué pedir, cómo verificarlo y cuándo
desconfiar. En este trabajo, los cuatro errores más costosos se resolvieron
leyendo el código real del stack y el mensaje literal del error, no formulando
otro prompt. La IA reemplaza parte de la escritura, no el criterio.

---

## Anexo — Dónde está la evidencia

| Evidencia | Ubicación |
|---|---|
| Bitácora completa de sesiones | `docs/ai/BITACORA_IA.md` |
| Guía de uso de IA en el repo | `docs/ai/GUIA_IA.md` |
| Reglas de trabajo del proyecto | `AGENTS.md` |
| Procedimiento de build del APK | `docs/mobile/build-apk-local.md` |
| Diseño de la Parte 3 | `docs/mobile/` |
| Tests del backend | `apps/api/src/__tests__/app.test.ts` (56 casos) |
