# Plan: Regadera y animación de riego del granjero

Rama: `feature/regadera-riego`.

## Objetivo

Al regar un cultivo (E sobre un surco sin regar), el granjero saca una
regadera, la inclina sobre el surco durante un momento y cae agua; después
la guarda. Hoy el riego es instantáneo y sin feedback en el personaje.

## Lo que hay

- `granjero.glb` (publicado desde `assets/granjero_texturizado.blend`) trae
  un esqueleto `Rig` con `hand.R`, `forearm.R`, `upper_arm.R`… y dos
  animaciones exportadas como pistas NLA: `walk` e `idle`
  (`playerView._cargarAnimaciones`).
- `FarmLogic.water(index)` riega al instante y emite `FARM_CHANGED` y un
  `NOTIFY`; no hay ningún evento específico de riego.
- ComfyUI está levantado (127.0.0.1:8188). El servidor de Hunyuan3D está
  apagado.

## Pasos

1. **Imagen de referencia (ComfyUI)**: regadera low-poly estilo cartoon
   (cuerpo metálico verde o azul, asa arriba, pitorro largo con alcachofa),
   fondo neutro, con el mismo workflow Z-Image-Turbo que las flores
   (`assets/flores_lila/generar_referencias_comfy.py`). Se guarda en
   `assets/regadera/regadera_referencia.png`.
2. **Modelo (Blender, por script)**: la regadera es una pieza sencilla, así
   que se modela con primitivas en Blender (cuerpo, asa, pitorro y alcachofa)
   con colores planos sacados de la referencia, en lugar de Hunyuan3D. Así
   la malla queda limpia y ligera, y con un empty `spout_tip` en la
   alcachofa. El script queda versionado en `assets/regadera/modelar_regadera.py`,
   y se exportan `assets/regadera/regadera.blend`, `assets/regadera.glb` y
   `public/models/regadera.glb`.
3. **Animación `water` (Blender)**: en `granjero_texturizado.blend`, una
   acción nueva `water` (~1,2 s) sobre el `Rig`: brazo derecho al frente,
   muñeca inclinada hacia abajo a media animación y vuelta a reposo. Se
   exporta como pista NLA junto a `walk` e `idle` y se vuelve a publicar
   `public/models/granjero.glb`. Antes de exportar se comprueba que `walk` e
   `idle` siguen intactos.
4. **Dominio**: nuevo evento tipado `FARM_WATERED` con `{ index }`, que
   `FarmLogic.water` emite al regar con éxito. Lleva un test en
   `farmLogic.test.ts`. La regla de juego no cambia (el riego sigue siendo
   inmediato).
5. **Vista del jugador (`playerView.ts`)**:
   - La regadera se carga con fallback a primitivas y se cuelga de
     `hand.R` (`attachToBone`), oculta por defecto.
   - Al recibir `FARM_WATERED`, el granjero se gira hacia el surco, muestra
     la regadera, reproduce `water` una vez y la oculta al terminar. Mientras
     dura, no se mueve (`player.busy`, que `main.ts` respeta igual que el
     `canMove` de los modales).
   - Agua: un sistema de partículas pequeño que sale de `spout_tip` en la
     parte central de la animación.
   - Si el GLB no trae `water`, la regadera se inclina por código (giro
     simple sobre el nodo de la mano) para que siempre haya feedback.
   - `farmView` necesita la posición del surco: `FARM_WATERED` lleva el
     índice y `playerView` obtiene la posición a través de la vista de la
     granja, o el evento incluye `x`/`z`. Elegiremos lo segundo si queda más
     simple.
6. **Escenario**: no hace falta uno nuevo. El riego ya está cubierto por
   los escenarios y solo se añade un evento.

## Verificación

- `pnpm verify` en verde, con el test nuevo del evento.
- A mano: regar un surco muestra la regadera en la mano, la animación, el
  agua y el surco mojado; el granjero no se mueve mientras riega; caminar
  e idle siguen como antes.

## Riesgos

- Reexportar `granjero.glb` desde Blender puede alterar `walk` e `idle` si
  el `.blend` ha cambiado desde la última exportación. Se comprobará
  comparando el GLB nuevo con el actual: mismos huesos, mismos grupos de
  animación y misma escala.

## Cambios durante la implementación

- La regadera no se engancha por código con `attachToBone`: se emparenta al
  hueso `hand.R` en Blender (`assets/regadera/animar_riego.py`) y viaja dentro
  de `granjero.glb`. Así su orientación en la mano se fija y se revisa con
  un render, y el juego solo la muestra u oculta. `regadera.glb` queda como
  pieza fuente en `assets/` (no se publica en `public/models/`).
- El rig mira hacia +Y en Blender: el brazo va al frente con pitch positivo.
- Babylon expresa los frames de las animaciones glTF a 60 fps, así que la
  duración del riego se calcula con el `framePerSecond` de la animación.
- Comprobado tras reexportar: mismos 19 huesos (solo cambia el orden de la
  lista), misma malla y medidas del granjero, y `walk` e `idle` con las
  mismas pistas y duraciones.
