# assets/

Contenido binario del juego: modelos `.glb`, texturas y audio.

## Estado actual

- `granjero.glb` — modelo 3D del jugador texturizado con materiales de
  colores planos (sin texturas) a partir de `granjero_00001_.png` (imagen de
  referencia con la que se generó la geometría). Respaldo SIN rig ni
  animaciones. Fuente editable: `~/blender-mcp/granjero.blend`.
- `granjero_texturizado.glb` — modelo del jugador generado con Hunyuan3D-2
  (servidor local, imagen→3D con textura) a partir de `granjero_00001_.png`,
  con atlas de textura de 2048×2048. Limpio de artefactos (vértices soldados
  e islas eliminadas) y CON rig propio de 19 huesos y animaciones `walk`
  (ciclo de caminata humana, 1 s) e `idle` (respiración, 2 s), exportadas
  como pistas NLA. Es el que sirve el juego en `public/models/granjero.glb`.
  Fuente editable: `assets/granjero_texturizado.blend`. Scripts del rig y
  las animaciones: `~/blender-mcp/granjero/` (walk.py, idle.py, exportar.py;
  enviados a Blender con `~/blender-mcp/bcmd.py`).
- `granjero_original.glb` — copia del modelo original sin texturizar ni recortar
  la peana (respaldo).
- `models/gallina.glb` — modelo 3D de la gallina generado con Hunyuan3D-2
  (servidor local, imagen→3D con textura 2048×2048) a partir de
  `assets/gallina_referencia.png` (imagen generada con ComfyUI en Windows,
  workflow `zimage_gallina.json`: Z-Image-Turbo). Limpio (vértices soldados,
  una sola isla de ~19k vértices), con la cabeza hacia -x (el giro de 180°
  en Y del cargador glTF la deja mirando hacia +x en el juego, como la vaca)
  y los pies en y=0 (~0.55 unidades de alto). CON rig propio de 12 huesos y
  animaciones `walk` (paso bípedo con cabeceo, 1 s) e `idle` (respiración,
  miradas y picoteo, 2 s) como pistas NLA (mismo proceso que la vaca: huesos
  en espacio "gallina" con frente +Y convertidos con rot +90° Z; pesos
  procedurales; pico, ojos y cresta rígidos con la cabeza). Es el que sirve
  el juego en `public/models/gallina.glb`. Fuentes editables:
  `assets/gallina.blend` (malla limpia sin rig) y `assets/gallina_rig.blend`
  (rig).
- `models/vaca.glb` — modelo 3D de la vaca generado con Hunyuan3D-2 (servidor
  local, imagen→3D con textura 2048×2048) a partir de `assets/vaca_referencia.png`
  (imagen generada con ComfyUI en Windows, workflow `z_image_turbo_int8.json`).
  Limpio (vértices soldados, una sola isla de ~20k vértices), con la cabeza
  hacia -x (el giro de 180° en Y del cargador glTF la deja mirando hacia +x
  en el juego, como la oveja) y los pies en y=0 (~1.2 unidades de alto).
  CON rig propio de 15 huesos y animaciones `walk` (marcha lateral de
  cuadrúpedo, 1 s) e `idle` (respiración, 2 s) como pistas NLA (mismo proceso
  que la oveja: huesos en espacio "vaca" con frente +Y convertidos con rot
  +90° Z; pesos procedurales; cuernos rígidos con la cabeza). Es el que
  sirve el juego en `public/models/vaca.glb`. Fuentes editables:
  `assets/vaca.blend` (malla limpia sin rig) y `assets/vaca_rig.blend` (rig).
- `oveja_anim.glb` — oveja riggeada desde cero (14 huesos, pesos procedurales)
  con animaciones `walk` (marcha lateral de cuadrúpedo, 1 s) e `idle`
  (respiración, 2 s) como pistas NLA. Orientación y escala HORNEADAS en
  vértices y huesos (mirando +x, pies en 0, ~1.09 de alto): los transforms de
  envoltorio no afectan a esqueletizadas en Babylon. Es el que sirve el juego
  en `public/models/oveja.glb`. Fuente editable: `assets/oveja_rig.blend`.
  Scripts: `~/blender-mcp/oveja/` (rig_walk.py, validar.py).

## Cómo se publican los modelos

Vite solo publica lo que hay en `public/`, así que los `.glb` que usa el juego
van copiados en `public/models/` (servidos como `/models/...`); esta carpeta
`assets/` queda como fuente versionada. El cargador glTF lo aporta
`public/vendor/babylon.loaders.js` (bundle UMD generado con esbuild desde
`@babylonjs/loaders@9.17.0`; Babylon 9 ya no publica UMD propio), cargado en
`index.html` tras el core.

## Carga desde el código

`src/player/playerView.ts` carga el modelo con
`BABYLON.SceneLoader.ImportMeshAsync('', '/models/', 'granjero.glb', scene)` y,
si la carga falla, mantiene las primitivas (`MeshBuilder`) como *fallback*.
Misma convención para futuros modelos (NPCs, edificios…): siempre con fallback.

## Convención de carpetas

```
assets/
  models/   # .glb / .gltf fuentes
  textures/
  audio/
```
