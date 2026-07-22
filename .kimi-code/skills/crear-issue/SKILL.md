---
name: crear-issue
description: Crea una issue en GitHub siguiendo la plantilla del repo (objetivo, criterios de aceptación verificables, tests necesarios)
whenToUse: Cuando el usuario pida crear, abrir o redactar una issue o tarea en GitHub
arguments:
  - descripcion
---

Procedimiento determinista para crear issues en `devlitus/simulator-lift`. La fuente de verdad de los campos es `.github/ISSUE_TEMPLATE/tarea.yml`: léelo antes de redactar y respeta sus secciones. Todo el contenido va en español.

## Paso 1 — Recoger la información

De `$descripcion` y del contexto de la conversación extrae: objetivo, contexto técnico (archivos, salidas de comandos, issues relacionadas) y posibles criterios. Si la petición es vaga, investiga el repo antes de redactar (lee los archivos implicados, ejecuta comandos de diagnóstico como `pnpm outdated` si aplica) para que la issue tenga datos reales y no generalidades.

Pregunta al usuario SOLO si falta el objetivo o no se pueden proponer criterios razonables con la evidencia disponible.

## Paso 2 — Redactar siguiendo la plantilla

- **Título**: imperativo, corto, qué se hace y dónde.
- **Objetivo**: resultado final observable, no pasos.
- **Criterios de aceptación**: checklist `- [ ]`, cada uno verificable de forma objetiva — un comando (`pnpm verify`, un test concreto), un escenario en `src/scenarios/`, o un comportamiento observable marcado como verificación manual en navegador (las vistas `*View.ts` no tienen tests automáticos, ADR 0006).
- **Tests necesarios**: unitarios junto al dominio y/o escenario de aceptación; `N/A` si no aplica.
- **Contexto / Fuera de alcance / Notas**: rellena solo lo que aporte; omite secciones vacías en el cuerpo final.

Reglas: una issue = un objetivo (si la petición mezcla dos, propón dividirla). Cada criterio debe poder comprobarlo después el skill `verificar` ejecutando algo real.

## Paso 3 — Crear

```bash
gh issue create --repo devlitus/simulator-lift --title "<título>" --body "<cuerpo>"
```

Usa heredoc para el cuerpo. Devuelve al usuario la URL y un resumen de 3-5 líneas de lo redactado.

## Guardarraíles

- No inventes datos técnicos (versiones, rutas, comandos): verifícalos en el repo antes de escribirlos.
- No crees la issue si el objetivo sigue ambiguo tras investigar: pregunta primero.
- No añadas labels ni assignees salvo que el usuario lo pida.
