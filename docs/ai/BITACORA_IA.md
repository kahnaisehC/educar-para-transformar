# Bitácora de sesiones de IA

Registro de lo que hizo cada asistente de IA en este repositorio. Su objetivo
es que el contexto sobreviva entre sesiones, entre herramientas y entre
personas del grupo: no dependas de la memoria del chat.

**Cómo usarla**

- Cada sesión relevante agrega una entrada al final (más reciente abajo).
- Al **empezar** una sesión, pedile a la IA que lea este archivo antes de tocar
  código.
- Al **terminar**, pedile que agregue la entrada con el formato de abajo.
- Sé breve: 5–10 líneas por entrada alcanzan.

**Formato de entrada**

```markdown
## AAAA-MM-DD — Título corto de la tarea
- **Objetivo:** ...
- **Cambios:** archivos principales tocados y qué se hizo.
- **Tests:** qué tests se agregaron/actualizaron.
- **Estado:** hecho / en progreso / bloqueado (y por qué).
- **Verificación:** resultado de typecheck + test + build.
- **Próximos pasos:** lo que sigue y quién debería tomarlo.
```

---

## 2026-10-16 — Configuración de opencode para el repo
- **Objetivo:** dejar instrucciones y contexto para que los asistentes de IA
  trabajen mejor con este proyecto.
- **Cambios:** se agregaron `AGENTS.md` (reglas del repo),
  `opencode.jsonc` (config de opencode), `docs/ai/GUIA_IA.md` (guía general),
  esta bitácora, un comando (`/verificar`) y un subagente de migraciones.
- **Tests:** no aplica (solo documentación y configuración).
- **Estado:** hecho.
- **Verificación:** documentos creados; no se tocó código del proyecto.
- **Próximos pasos:** mantener la bitácora al día; revisar
  `AGENTS.md` cuando cambien los comandos o la arquitectura.

## 2026-10-16 — Corrección de conflictos de numeración de requisitos
- **Objetivo:** alinear la numeración de RF/HU entre todos los documentos
  usando `docs/requerimientosCorregidos.md` como fuente de verdad.
- **Cambios:** en `docs/planDeTrabajo.md` se renumeró el módulo Docente
  (RF-PR-03 = reporte docente, RF-PR-04 = listados; se eliminó RF-PR-05 y la
  carga horaria se integró a RF-PR-01). Se marcaron como superdedados los
  originales `Requerimentos&...txt` y `PlanificacionDeSprints.txt` con una nota
  de diferencias. En `planDeTrabajoMovil.md` se aclaró que HU-01..15 y RF-MV-*
  son un espacio de códigos propio de la Parte 3.
- **Tests:** no aplica (solo documentación).
- **Estado:** hecho.
- **Verificación:** typecheck + 43 tests + build en verde.
- **Próximos pasos:** usar siempre `requerimientosCorregidos.md` como
  referencia canónica; revisar si aparece numeración nueva divergente.

## 2026-10-23 — Agentes de arquitectura y desarrollo móvil
- **Objetivo:** preparar la Parte 3 (app móvil) con dos perfiles de IA
  separados: diseño y ejecución.
- **Cambios:** se agregaron `.opencode/agent/mobile-architect.md` (agente
  primario de arquitectura, sin implementación) y
  `.opencode/agent/mobile-developer.md` (subagente de desarrollo). Ambos leen
  `AGENTS.md`, el plan móvil, la API existente y la bitácora antes de actuar.
- **Tests:** no aplica (configuración y prompts).
- **Estado:** hecho.
- **Verificación:** `opencode debug agents` lista `mobile-architect` (primary)
  y `mobile-developer` (subagent) con los permisos previstos.
- **Próximos pasos:** usar `mobile-architect` para cerrar modelo económico,
  contratos de API y plan de rebanadas antes de que `mobile-developer`
  implemente la primera rebanada (auth + modelo de cuotas).

## 2026-10-24 — Parte 3: modelo económico, API de cuotas y app móvil
- **Objetivo:** ejecutar los Sprints 1 a 6 de la aplicación móvil de cuotas
  reutilizando la API y la base existentes.
- **Cambios:** migración `006_billing_core.sql` (tarifas, facturas, ítems,
  comprobantes, pagos, imputaciones, envíos y tokens de contraseña); endpoints
  de facturación, comprobantes, reportes, morosidad y recuperación de
  contraseña; generación de PDF con PDFKit y correo con Nodemailer; panel de
  cobranza en la web; paquete `apps/mobile` con Expo Router, SecureStore,
  login, cuotas, pagos, historial, comprobantes, tarifas y reportes; volumen
  `educar-uploads` en los scripts de arranque; diseño en
  `docs/mobile/diseno.md`.
- **Tests:** se agregaron 7 casos de facturación (tarifas, generación
  idempotente, cuotas, comprobantes, aprobación parcial/total, rechazo,
  reportes, morosidad, recordatorios idempotentes y reset de contraseña).
- **Estado:** núcleo de la Parte 3 implementado. Quedan pruebas de integración
  móvil en dispositivo, envío SMTP real y pulido visual.
- **Verificación:** `npm run typecheck` (API, web y móvil), 50 tests y
  `npm run build` en verde; smoke test real con Podman (login, tarifas,
  facturas, comprobante, aprobación, PDF y reportes).
- **Próximos pasos:** probar la app en Expo Go con un dispositivo, configurar
  SMTP real si se desea enviar correos y completar la evidencia para la
  defensa/testig.


## Unidad 5 – Calidad y pruebas (27/10/2026)

- **Objetivo:** completar el TP de la Unidad 5 (caso de prueba, prueba estática y dinámica, métricas) sobre RF-AL-03 / HU-01.
- **Cambios:** ESLint, Husky + lint-staged, Cypress (E2E y regresión), cobertura con `@vitest/coverage-v8`, configuración de SonarCloud, job `e2e` y paso `lint` en CI, política de PR y carpeta `unidad5v2/` con el Word y el PDF. Se eliminaron imports sin usar detectados por ESLint.
- **Estado:** lint 0 errores, typecheck, 50 tests y build en verde; Cypress 4/4 contra el stack real.
- **Próximos pasos:** vincular SonarCloud (`SONAR_TOKEN`) y activar la protección de `main`.

## 2026-11-09 — Cierre de brechas de la Parte 3
- **Objetivo:** ejecutar el plan de cierre de las 8 brechas detectadas en la
  auditoría de la Parte 3.
- **Cambios:** runner de migraciones (`scripts/migrate-db.mjs` y `schema_migrations`),
  email en alta/edición de usuarios, comprobante de pago numerado con PDF y
  descarga móvil, estado y prueba de SMTP, scheduler con lógica de último día
  hábil/día 20 y workflow de GitHub Actions, adaptador de storage local/S3,
  configuración EAS y documentación de branch protection.
- **Tests:** se agregaron casos de email de usuarios, comprobante de pago,
  estado de correo y calendario de notificaciones. Total: 54 tests.
- **Estado:** implementación local completa. Pendientes operativos: credenciales
  SMTP/S3, secretos del workflow, build EAS y ejecución de branch protection.
- **Verificación:** lint sin errores (12 warnings), typecheck de API/web/móvil,
  54 tests y build en verde; migración 007 probada contra PostgreSQL real.
- **Próximos pasos:** configurar secretos en Render/GitHub, generar APK de
  prueba y activar branch protection.

## 2026-11-09 — Brechas funcionales de la Parte 3
- **Objetivo:** cerrar las brechas funcionales detectadas después de la
  auditoría: inscripciones desde admin, filtros y PDFs móviles, preview de
  comprobantes y concurrencia.
- **Cambios:** altas administrativas de deporte/transporte/comedor; filtro de
  historial por período; descarga de factura PDF para padre y admin; descarga
  del comprobante cargado por el admin; normalización de fechas de factura y
  prueba de aprobación concurrente.
- **Tests:** 56 tests (se agregaron altas admin, filtro por período, PDFs y
  concurrencia).
- **Estado:** hecho a nivel código. Pendientes: credenciales SMTP/S3, secretos
  de GitHub, APK EAS y branch protection.
- **Verificación:** lint sin errores, typecheck API/web/móvil, 56 tests, build y
  export web de Expo en verde.
