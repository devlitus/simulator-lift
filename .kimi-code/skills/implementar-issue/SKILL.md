---
name: implementar-issue
description: Prepara la implementación de una issue de GitHub — la lee, aclara dudas, crea su rama desde main y escribe el plan en docs/plans/ para aprobación
whenToUse: Cuando el usuario pida implementar, desarrollar o empezar a trabajar una issue de GitHub
arguments:
  - issue
---

Procedimiento determinista para empezar una issue de `devlitus/simulator-lift`. Termina con un plan escrito y una rama creada; la implementación NO empieza hasta que el usuario apruebe el plan.

## Paso 0 — Precondiciones

1. `git status --short`: el árbol debe estar limpio. Si hay cambios sin commitear, avisa y para — no mezcles trabajo de otra tarea en la rama nueva.
2. `gh` autenticado. Si `$issue` no es un número o no existe, reporta y para.

## Paso 1 — Leer la issue

```bash
gh issue view $issue --json title,body,comments
```

Extrae: objetivo, criterios de aceptación, tests necesarios, contexto y fuera de alcance (siguen la plantilla de `.github/ISSUE_TEMPLATE/tarea.yml`). Investiga también el código implicado para entender el estado real antes de juzgar la issue.

## Paso 2 — Dudas antes de tocar nada

Plantea preguntas al usuario SOLO si hay motivo concreto:

- El objetivo es ambiguo o admite dos interpretaciones distintas.
- Algún criterio de aceptación no es verificable (no se puede comprobar con un comando, test o comportamiento observable).
- Falta contexto que cambie el enfoque (decisiones de diseño sin tomar, dependencias con otras issues).
- El alcance es demasiado grande para una sola rama (propondría dividirla).

Si la issue es clara y completa, no preguntes por preguntar: sigue adelante.

## Paso 3 — Crear la rama

```bash
git checkout main && git pull --ff-only
git checkout -b {tipo}/issue-{N}-{slug}
```

- `{tipo}`: como en el historial (`feature/split-farm`), para ver de un vistazo qué clase de trabajo es. Se elige mecánicamente con la misma tabla del skill `commit` según el objetivo de la issue: `feature` (comportamiento nuevo), `fix` (corrección), `refactor`, `chore` (dependencias, tooling), `docs`, `test`.
- `{slug}`: 3-5 palabras clave del título, minúsculas, sin acentos, separadas por guiones.

Ej.: issue #6 sobre actualizar dependencias → `chore/issue-6-actualizar-dependencias`. Nunca trabajes la issue sobre `main`. No hagas push sin permiso explícito.

## Paso 4 — Escribir el plan

Crea `docs/plans/{N}.md` con esta estructura fija:

```markdown
# Issue #{N}: {título}

Enlace: {url de la issue}

## Objetivo

{copiado de la issue}

## Tareas

- [ ] 1. {tarea concreta, con los archivos reales que toca}
  - [ ] 1.1 {subtarea si la tarea lo necesita}
- [ ] 2. ...

## Verificación

| Criterio de aceptación | Comprobación |
|---|---|
| {criterio de la issue} | {comando / test / 🔶 manual en navegador} |

## Notas y decisiones

{enfoque elegido, alternativas descartadas, riesgos}
```

Las tareas deben salir del código real (léelo antes), no de suposiciones. La tabla de verificación debe poder ejecutarla después el skill `verificar`.

## Paso 5 — Esperar aprobación

Presenta un resumen corto (rama creada, ruta del plan, número de tareas) y **PARA**. No escribas código de la feature hasta que el usuario apruebe el plan. Si pide cambios, edita `docs/plans/{N}.md` y vuelve a presentarlo.

## Guardarraíles

- Sin plan aprobado no se implementa.
- Nada de commits ni push sin permiso explícito del usuario (el plan se commiteará cuando él decida, con el skill `commit`).
- Si la issue está a medias de otra sesión, consulta antes `.kimi-code/state/issue-{N}.md` con el skill `retomar` en vez de empezar de cero.
