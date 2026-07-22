---
name: commit
description: Crea commits siguiendo Conventional Commits en español, agrupando por cambio lógico y validando antes de commitear
whenToUse: Cuando el usuario pida hacer un commit, commitear cambios, guardar trabajo en git o crear varios commits
---

Procedimiento determinista para crear commits en este repo. Sigue los pasos en orden; ante el mismo `git diff`, el resultado debe ser siempre el mismo.

## Paso 1 — Inspección

Antes de decidir nada, ejecuta y lee:

```bash
git status --short
git diff
git log --oneline -10   # estilo e idioma del historial
```

Para archivos nuevos (untracked), lee su contenido. Sin esta información no hay decisión.

## Paso 2 — Agrupación

Un commit = un cambio lógico. Reglas de corte:

- Si dos cambios pueden existir independientemente sin romper build ni tests → commits separados.
- Si un archivo no compila o no pasa tests sin otro → van juntos en el mismo commit.
- Los tests van siempre con el código que prueban.
- Documentación independiente del código (ADRs, README sin relación) → commit propio de tipo `docs`.

## Paso 3 — Tipo (gana la primera condición que aplique)

| Condición | Tipo |
|---|---|
| Solo documentación (`*.md`, ADRs) | `docs` |
| Solo tests (añadir/corregir sin tocar lógica) | `test` |
| Comportamiento nuevo visible para el jugador | `feat` |
| Comportamiento incorrecto corregido | `fix` |
| Misma conducta, mejor estructura interna | `refactor` |
| Formato puro (Prettier, sin lógica) | `style` |
| Dependencias, build, configuración | `build` o `chore` |

## Paso 4 — Ámbito

El scope sale mecánicamente de la carpeta de dominio (ADR 0005): `src/animals/` → `(animals)`, `src/economy/` → `(economy)`, `src/crops/` → `(crops)`, etc. Cambios transversales o en `data/` → sin scope.

## Paso 5 — Formato del mensaje

```
<tipo>[ámbito]: <descripción en imperativo, ≤72 caracteres>
```

- Idioma y estilo según `git log`: español, minúscula inicial, sin punto final.
- Cuerpo opcional explicando el *por qué* (nunca el *qué*, eso ya está en el diff).

## Paso 6 — Validación previa obligatoria

```bash
pnpm test && pnpm typecheck
```

Si falla, **no se commitea**: se reporta el fallo al usuario y se corrige primero.

## Paso 7 — Guardarraíles (nunca negociables)

- Nunca `git push` sin permiso explícito del usuario.
- Nunca `git commit --amend` de commits ya publicados.
- Nunca `git add -A` / `git add .` sin haber revisado antes el diff completo; staging selectivo por archivos.
- Nunca commitear archivos de secretos, `.env` o artefactos de build (`dist/`).
- Si la agrupación o el tipo es genuinamente ambiguo, pregunta al usuario en vez de adivinar.
