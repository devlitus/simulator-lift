---
name: retomar
description: Consulta las tareas a medias guardadas en .kimi-code/state/ y reanuda una verificando su estado real
whenToUse: Cuando el usuario pregunte qué tareas hay pendientes, en qué estado se dejó algo, o pida retomar/continuar una tarea de otra sesión
arguments:
  - tarea
---

Procedimiento determinista para consultar y reanudar tareas guardadas. El archivo de estado es una pista, no la verdad: siempre se verifica contra el repo antes de actuar.

## Paso 1 — Listar estados

```bash
ls .kimi-code/state/*.md 2>/dev/null
```

- Si no hay ninguno (o solo existe `README.md`), informa: no hay tareas registradas a medias. Fin.
- Si hay varios y el usuario no indicó cuál (`$tarea` vacío), muestra un resumen con `issue`, `titulo`, `estado`, `actualizado` y "Próximo paso" de cada uno, y pregunta cuál retomar. Fin.

## Paso 2 — Leer la tarea elegida

Lee el archivo correspondiente (si `$tarea` es un número, `issue-<N>.md`). Si no existe, dilo y muestra los que sí hay.

## Paso 3 — Verificar contra la realidad

Antes de dar nada por hecho, comprueba:

```bash
git status --short
git branch --show-current
git log --oneline -5
```

- ¿La rama registrada existe y es la actual? Si no, indícalo y pregunta si hay que cambiar de rama.
- ¿Lo marcado como "Hecho" sigue presente en el código? Verifica las referencias `ruta:línea` que aparezcan.
- ¿Hay cambios sin commitear que el estado no menciona?

## Paso 4 — Presentar y reanudar

Resume en este orden:

1. Objetivo de la tarea y estado (`en_progreso` / `bloqueada`, desde cuándo).
2. Qué está hecho (confirmado contra el código).
3. Qué falta.
4. El próximo paso concreto.

Si la verificación contradice el archivo (trabajo ya mergeado, ítems hechos fuera de registro), dilo explícitamente y propón actualizar o borrar el archivo antes de seguir.

## Guardarraíles (nunca negociables)

- Nunca asumas que un ítem de "Pendiente" sigue siendo necesario sin mirar el código; puede haberse resuelto en otra sesión.
- No borres ni actualices archivos de estado sin que el usuario lo pida (eso es trabajo del skill `pausar`).
- Si el estado es ambiguo o contradictorio, pregunta al usuario en vez de adivinar.
