---
name: pausar
description: Guarda el estado de la tarea actual en .kimi-code/state/ antes de dejar el trabajo a medias
whenToUse: Cuando el usuario diga que hay que pausar, dejar el trabajo para mañana, cerrar la sesión con una tarea a medias o guardar el estado de una issue
---

Procedimiento determinista para persistir el estado de una tarea a medias. El objetivo: que otra sesión (u otro día) pueda retomar exactamente donde se dejó.

## Paso 1 — Identificar la tarea

- Si hay una issue de GitHub asociada al trabajo actual, el archivo es `.kimi-code/state/issue-<N>.md`.
- Si no hay número de issue, usa un slug corto: `.kimi-code/state/<slug>.md`.
- Si no está claro qué tarea se está pausando, pregunta al usuario antes de escribir nada.

## Paso 2 — Recopilar el estado real

Ejecuta y lee antes de escribir:

```bash
git status --short
git branch --show-current
date +%F
```

Repasa la conversación y los cambios: qué se hizo (solo lo verificado), qué falta, y cuál sería el siguiente paso concreto.

## Paso 3 — Escribir el archivo de estado

Formato fijo, sin secciones extra:

```markdown
---
issue: <número o "sin-issue">
titulo: "<título corto de la tarea>"
estado: en_progreso
rama: <rama actual>
actualizado: <YYYY-MM-DD>
---

## Objetivo

<2-3 líneas: qué hay que lograr y por qué>

## Hecho

- <ítem completado y verificado>
- <ítem con referencia ruta:archivo si aplica>

## Pendiente

- <ítem que falta, en orden si lo hay>

## Próximo paso

<una sola acción concreta para reanudar, con ruta:línea si aplica>

## Notas

<decisiones tomadas, comandos de validación pendientes, riesgos; omitir la sección si está vacía>
```

- `estado` solo admite `en_progreso` o `bloqueada` (si `bloqueada`, explica el bloqueo en Notas).
- Un archivo por tarea; si ya existe para esa issue, se sobrescribe con el estado actual.

## Paso 4 — Tareas terminadas

Si la tarea se completó (issue cerrada o trabajo mergeado), **borra** su archivo de estado en vez de actualizarlo. El directorio solo contiene tareas vivas.

## Guardarraíles (nunca negociables)

- Registra como "Hecho" únicamente lo verificado (tests en verde, build OK, diff revisado); lo no verificado va a "Pendiente".
- No inventes contenido: si no sabes qué falta, escribe "sin determinar" en "Próximo paso" y dilo al usuario.
- La fecha sale de `date +%F`, no de memoria.
- Estos archivos se commitean (están fuera del `.gitignore` a propósito): no escribas secretos ni rutas absolutas de tu máquina.
