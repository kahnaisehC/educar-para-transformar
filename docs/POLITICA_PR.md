# Política de Pull Requests

Reglas para integrar cambios a `main` mediante revisión por pares.

## Reglas

1. **Todo cambio entra por Pull Request.** No se hace push directo a `main`.
2. **Una aprobación mínima** de un integrante distinto del autor. `.github/CODEOWNERS` solicita la revisión automáticamente.
3. **Checks obligatorios en verde:** CI (lint, typecheck, test, build) y job E2E con Cypress.
   SonarCloud está desactivado por un problema de facturación de la organización
   (ver `.github/workflows/sonarcloud.yml`); no es un check obligatorio.
4. **PR pequeño y enfocado** (idealmente menos de 400 líneas), una rebanada vertical por vez.
5. **Rama actualizada contra `main`** y conversaciones del diff resueltas antes de mergear.
6. **Commits en inglés con Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
7. **Sin secretos** en el código ni en los archivos versionados.

## Lista de verificación del revisor

- ¿Cumple los criterios de aceptación de la HU/RF vinculada?
- ¿Hay tests nuevos o actualizados para la regla de negocio?
- ¿Respeta las capas (rutas en `app.ts`, lógica en `*.service.ts`, vista en `apps/web`)?
- ¿Maneja los errores con `AppError` y valida las entradas?
- ¿Puede exponer datos de otro usuario o de otro rol?

## Activar la protección de rama (GitHub)

*Settings > Branches > Add branch protection rule* para `main`:

- Require a pull request before merging (1 approval, Require review from Code Owners).
- Require status checks to pass: `Build, typecheck y test` y `Pruebas E2E (Cypress)`.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.

Estas reglas se configuran desde la interfaz de GitHub; no se pueden versionar en el repositorio.

### Configuración reproducible con `gh`

Con permisos de administrador del repositorio:

```bash
gh api --method PUT repos/{owner}/{repo}/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Build, typecheck y test",
      "Pruebas E2E (Cypress)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Verificar con:

```bash
gh api repos/{owner}/{repo}/branches/main/protection
```

La configuración de protección de rama vive en GitHub, no en el repositorio.
