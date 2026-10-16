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
