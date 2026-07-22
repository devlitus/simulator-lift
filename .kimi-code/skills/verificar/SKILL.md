---
name: verificar
description: Verifica que el trabajo de una issue cumple sus criterios de aceptación ejecutando comprobaciones reales y emite un informe por criterio
whenToUse: Cuando el usuario pida verificar o comprobar una issue, validar que una tarea cumple los criterios de aceptación, o saber si el trabajo está listo para cerrar
arguments:
  - issue
---

Procedimiento determinista de verificación contra criterios de aceptación. Principio rector: un criterio solo se marca ✅ con evidencia de una ejecución real en esta sesión — nunca por intuición ni porque "el código parece correcto".

## Paso 1 — Obtener los criterios

En orden de preferencia:

1. Si `$issue` es un número y `gh` está autenticado: `gh issue view $issue --json title,body` y extrae los criterios de aceptación del cuerpo.
2. Si no, lee `.kimi-code/state/issue-$issue.md` (secciones Objetivo y Pendiente).
3. Si no hay ninguna fuente, pide al usuario los criterios literalmente. Sin criterios no hay verificación.

## Paso 2 — Mapear cada criterio a una comprobación

Para cada criterio decide UNA de:

- **Automática**: un test concreto (`pnpm vitest run <archivo> -t "<nombre>"`), `pnpm verify`, o un comando cuyo resultado lo demuestre.
- **Manual** (🔶): toca vistas o mundo 3D (ADR 0006) o no es comprobable por comando. Indica exactamente qué debe mirar el usuario y dónde.

Si un criterio podría tener test automático y no lo tiene, anótalo como hueco de cobertura (candidato para `src/scenarios/`), pero no escribas tests sin que el usuario lo pida.

## Paso 3 — Ejecutar

1. `pnpm verify` completo (format + lint + typecheck + tests). Si falla, reporta el fallo primero; ningún criterio puede darse por bueno con el gate en rojo.
2. Las comprobaciones automáticas específicas de cada criterio, una a una.

## Paso 4 — Informe

Una tabla con una fila por criterio:

| Criterio | Comprobación ejecutada | Resultado |
|---|---|---|
| … | `pnpm vitest run src/scenarios -t "…"` | ✅ / ❌ / 🔶 manual |

Cierra con un veredicto:

- **APTA** — todos ✅ con el gate en verde.
- **APTA CON VERIFICACIÓN MANUAL PENDIENTE** — hay 🔶; lista qué falta por mirar.
- **NO APTA** — algún ❌; lista qué falla y dónde.

## Guardarraíles (nunca negociables)

- No marques ✅ sin haber ejecutado la comprobación en esta sesión y visto su salida.
- Verificar no es arreglar: si algo falla, repórtalo; no toques el código salvo que el usuario lo pida.
- No cierres la issue en GitHub ni borres el archivo de estado: eso lo decide el usuario.
- Si los criterios son ambiguos, pide aclaración antes de elegir comprobaciones; no adivines.
