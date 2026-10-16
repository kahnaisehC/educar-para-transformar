# Guía de uso de IA en este proyecto

Guía práctica para usar asistentes de IA (opencode, Cursor, Copilot, Claude
Code, etc.) en el monorepo **Educar para Transformar**. La idea es que el
código generado sea útil, verificable y consistente con lo que ya existe.

Complementa a `AGENTS.md` (reglas específicas del repo). Si tenés dudas del
stack, comandos y convenciones, leé primero `AGENTS.md`.

---

## 1. Principios

1. **El humano dirige, la IA ejecuta.** Vos definís el objetivo y los criterios
   de aceptación; la IA propone e implementa.
2. **Una rebanada vertical por vez.** No pidas "implementá todo el Sprint".
   Pedí un flujo completo y acotado: "que el alumno pueda inscribirse a
   transporte y se cree la notificación".
3. **Todo cambio se verifica.** La IA no es fuente de verdad: `typecheck`,
   `test` y `build` sí lo son.
4. **No delegar decisiones de negocio.** Las reglas de inscripción, roles y
   auditoría salen de `docs/requerimientosCorregidos.md`, no de la IA.
5. **Revisá lo que se generó.** El código de IA es un borrador; léelo antes de
   commitear.

---

## 2. Flujo de trabajo recomendado

```text
1. Contexto   -> la IA lee AGENTS.md, el RF/HU y el archivo afectado.
2. Plan       -> pedí un plan corto (archivos a tocar, tests a agregar).
3. Rebanada   -> implementación acotada + tests.
4. Verificación -> npm run typecheck && npm test && npm run build.
5. Bitácora   -> registrar en docs/ai/BITACORA_IA.md.
```

En opencode, los **modos** ayudan a respetar esto:

- **plan** (solo lectura): explorar y proponer sin editar. Ideal para el paso 2.
- **build** (por defecto): implementar. Para el paso 3.

Atajo: pedí "planeá esto primero" y recién después "ahora implementalo".

---

## 3. Cómo escribir buenos pedidos

Un buen pedido tiene: **contexto + objetivo + alcance + criterios de
aceptación + restricciones**.

```text
Contexto: RF-DI-02 exige filtros por nivel y curso en los reportes.
Objetivo: agregar el filtro por deporte a GET /api/director/report-filters.
Alcance: solo report.service.ts, app.ts y el test de reportes.
Criterios:
  - el endpoint devuelve los deportes disponibles
  - un rol no autorizado recibe 403
  - los tests existentes siguen en verde
Restricciones: no tocar el frontend todavía; seguir usando withAuditProxy.
```

Evitá: "arreglá los reportes", "optimizá el código", "agregá validaciones"
(sin decir cuáles). Eso genera cambios grandes y difíciles de revisar.

---

## 4. Agentes y subagentes

Un **agente** es una configuración con su propio prompt, permisos y modelo. Un
**subagente** es un agente que el agente principal puede invocar como una tarea
delegada (mediante la herramienta `task`), y trabaja en un contexto aparte.

**Cuándo usarlos:**

- **Exploración** (dónde está X, cómo funciona Y): usá el subagente `explore`.
  Devuelve respuestas sin llenar el contexto principal.
- **Tareas repetibles y especializadas** (migraciones, tests, reviews):
  conviene definir un subagente propio en `.opencode/agent/<nombre>.md`.
- **Trabajo en paralelo**: lanzá varios subagentes a la vez para tareas
  independientes.

**Formato** (`.opencode/agent/migraciones-db.md`):

```markdown
---
description: Escribe migraciones SQL incrementales siguiendo las reglas del repo.
mode: subagent
permission:
  edit: allow
  bash: ask
---

Eres responsable de las migraciones de database/migrations/ ...
```

- No fijes `model:` salvo que necesites uno puntual; así hereda el del agente
  principal.
- `mode: subagent` = solo invocable por otro agente. `primary` = seleccionable
  por el usuario. `all` = ambos.

---

## 5. Comandos personalizados

Un **comando** es un atajo de prompt que escribís con `/nombre`. Se define en
`.opencode/command/<nombre>.md` y puede recibir argumentos con `$ARGUMENTS`,
`$1`, `$2`.

Ejemplo incluido: `.opencode/command/verificar.md` → corre la tripleta de CI.

```markdown
---
description: Corre typecheck + tests + build
agent: build
---

Ejecutá `npm run typecheck && npm test && npm run build` y reportá el resultado.
```

---

## 6. Skills

Una **skill** es un paquete de instrucciones que opencode carga *solo cuando la
tarea coincide* con su descripción (ej: configurar opencode, escribir
migraciones). A diferencia de `AGENTS.md` (siempre cargado), las skills evitan
gastar contexto hasta que se necesitan.

- Ubicación: `.opencode/skill/<nombre>/SKILL.md` (con frontmatter `name` y
  `description`).
- La `description` debe decir **qué hace y cuándo usarla**, con las palabras
  clave que dispararían la carga.

---

## 7. MCP (Model Context Protocol)

MCP es un estándar para conectar la IA con herramientas y datos externos
(GitHub, bases de datos, navegador). Se configura en `opencode.jsonc` bajo la
clave `mcp` (hay ejemplos comentados en el archivo).

**Cuándo vale la pena en este proyecto:**

| Servidor | Para qué | Requisito |
|---|---|---|
| GitHub (remote) | leer/abrir issues y PRs, ver checks de CI | `GITHUB_TOKEN` |
| PostgreSQL (local) | inspeccionar el esquema y datos reales | Postgres corriendo |
| Playwright / Chrome | probar la UI de `apps/web` de punta a punta | binario del navegador |

**Cuidado:**

- Cada MCP arranca con opencode: si el binario o el token faltan, agrega ruido.
  Activá solo los que uses (`"enabled": false` para apagar uno heredado).
- Un MCP de base de datos apunta a datos reales. Usá credenciales de solo
  lectura o el entorno demo, nunca producción.
- No pongas tokens en el repo: usá `{env:VAR}` y una variable de entorno.

---

## 8. Seguridad y secretos

- **Nunca** pegues `.env`, tokens, contraseñas ni datos personales de alumnos
  en un prompt. `.env` está ignorado por git.
- La IA **no** debe commitear ni hacer push salvo pedido explícito.
- Revisá que los diffs no agreguen credenciales antes de commitear
  (checklist en `.github/pull_request_template.md`).
- Los datos de `seed.sql` son demo, pero tratá el sistema como si tuviera datos
  reales de menores.

---

## 9. Verificación (siempre)

Antes de dar por cerrada una tarea:

```bash
npm run typecheck   # tipos en API y web
npm test            # Vitest + pg-mem (reglas de negocio)
npm run build       # la API y la web compilan
```

El CI corre exactamente estos tres pasos. Si no pasan en local, no pasan en CI.
Regla de oro: **si rompiste un test, arreglá el código o el test, pero no lo
borres sin justificar**.

---

## 10. Bitácora de sesiones

Para que el contexto sobreviva entre sesiones (y entre personas), cada sesión
de IA relevante se registra en `docs/ai/BITACORA_IA.md`: objetivo, cambios,
estado y próximos pasos.

- Es un archivo Markdown versionado, no la memoria del chat.
- Al empezar una sesión nueva, pedile a la IA que lea la bitácora antes de
  tocar código.
- Al terminar, pedile que agregue una entrada.

Plantilla y ejemplo en `docs/ai/BITACORA_IA.md`.

---

## 11. Errores comunes a evitar

- Pedir varios cambios a la vez y no poder revisarlos.
- Aceptar un refactor "de paso" que rompe los patrones de diseño.
- Editar `schema.sql` en vez de crear una migración nueva.
- Cambiar `app.ts` sin agregar/actualizar el test correspondiente.
- Confiar en la memoria del chat en vez de la bitácora.
- Dejar que la IA commitee sola.
