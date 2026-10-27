## Descripción
<!-- ¿Qué cambia este PR y por qué? Vincular el Issue relacionado con "Closes #<numero>" -->

## Tipo de cambio
- [ ] Feature
- [ ] Fix
- [ ] Chore / refactor
- [ ] Documentación

## Checklist antes de pedir revisión
- [ ] El pipeline de CI (build, typecheck y tests) corrió en verde en este PR
- [ ] Se agregaron o actualizaron tests para el cambio
- [ ] No se agregaron secretos, credenciales ni datos sensibles al código
- [ ] La rama está actualizada contra `main`

## Cómo probarlo
<!-- Pasos para que el revisor valide el cambio localmente -->

## Política de Pull Requests
- [ ] `npm run lint` sin errores (el hook pre-commit ya lo verifica)
- [ ] Al menos 1 aprobación de otro integrante antes de mergear (revisión por pares)
- [ ] El Quality Gate de SonarCloud está en verde
- [ ] Las pruebas E2E de Cypress pasaron
- [ ] El PR es pequeño y enfocado (idealmente menos de 400 líneas)
