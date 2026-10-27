# Unidad 5 – Pruebas de verificación y calidad

Entrega del TP de la Unidad 5 (Parte 2) de Educar para Transformar.

| Archivo | Contenido |
|---|---|
| `TP Unidad 5 - Hakanson Morales.docx` | Documento completado: caso de prueba TC-DEP-01, prueba estática, herramientas, prueba dinámica, métricas, historia de usuario y arquitectura |
| `TP Unidad 5 - Hakanson Morales.pdf` | Mismo documento en PDF |
| `vscode-settings.sample.json` | Configuración de ESLint para Visual Studio Code |
| `evidencia-sonarcloud-pr4.png` | Captura del PR #4: Quality Gate de SonarCloud aprobado y checks en verde |

Funcionalidad elegida: **RF-AL-03 / HU-01 – Inscripción a deportes** (la Unidad 4 usó RF-AL-01).

## Qué se instaló en el repositorio

| Herramienta | Archivos | Comando |
|---|---|---|
| ESLint 9 + typescript-eslint + react-hooks | `eslint.config.mjs` | `npm run lint`, `npm run lint:fix` |
| Husky + lint-staged (pre-commit) | `.husky/pre-commit`, `lint-staged` en `package.json` | automático al hacer `git commit` |
| Cypress 13 (E2E y regresión) | `cypress.config.ts`, `cypress/` | `npm run e2e`, `npm run e2e:open` |
| Cobertura (`@vitest/coverage-v8`) | `apps/api/package.json` | `npm run test:coverage` |
| SonarCloud (vinculado, Quality Gate aprobado en el PR #4) | `sonar-project.properties`, `.github/workflows/sonarcloud.yml` | automático en PR; usa el secreto `SONAR_TOKEN` |
| Política de PR | `.github/CODEOWNERS`, `.github/pull_request_template.md`, `docs/POLITICA_PR.md` | – |
| CI ampliado | `.github/workflows/ci.yml` (paso Lint y job `e2e`) | automático en push y PR |

## Cómo correr las pruebas E2E localmente

1. Levantar PostgreSQL (por ejemplo `docker run -d -e POSTGRES_DB=educar -e POSTGRES_USER=educar -e POSTGRES_PASSWORD=educar_dev_password -p 5432:5432 postgres:16-alpine`).
2. Inicializar la base: `DATABASE_URL=postgres://educar:educar_dev_password@localhost:5432/educar node scripts/init-db.mjs`.
3. Levantar la API (`npm run dev:api`) y el frontend (`npm run dev --workspace @educar/web -- --host`).
4. Ejecutar `npm run e2e`.

## Resultados

- Cypress: 4 pruebas, 4 aprobadas (`inscripcion-deportes.cy.ts`, `regresion-horarios.cy.ts`).
- Vitest: 50 pruebas aprobadas; cobertura de la API 84,61 % de líneas y 73,21 % de ramas.
- ESLint: 0 errores y 12 advertencias (`react-hooks/exhaustive-deps`).

## Pendiente (acciones manuales en GitHub / SonarCloud)

- Activar la protección de `main` en *Settings > Branches* (ver `docs/POLITICA_PR.md`).
