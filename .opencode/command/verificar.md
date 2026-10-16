---
description: Corre la tripleta del CI (typecheck + tests + build) en todo el monorepo
agent: build
---

Ejecutá, en este orden y desde la raíz del repositorio:

```bash
npm run typecheck && npm test && npm run build
```

Luego reportá:

1. El resultado de cada paso (verde/rojo).
2. Si algo falla, el error concreto y el archivo/línea involucrados.
3. Un resumen de 1-2 líneas del estado final.

No modifiques código en este comando: solo verificá y reportá. Si hay fallas,
proponé el siguiente paso para corregirlas.
