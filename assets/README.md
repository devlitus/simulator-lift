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
- `models/marta.glb` — modelo 3D de Marta (la tendera) generado con
  Hunyuan3D-2 (servidor local, imagen→3D con textura 2048×2048) a partir de
  `assets/marta_referencia.png` (imagen generada con ComfyUI en Windows,
  workflow `image_z_image_turbo_int8`: Z-Image-Turbo, estilo chibi como el
  granjero). Limpio (vértices soldados 25k→20k, una sola isla de ~40k caras,
  sin borrar nada), con la cara girada de -Y a +Y (convención del juego) y
  los pies en z=0 (~1.96 de alto; la vista lo escala a ~1.5 m por caja
  envolvente). SIN rig ni animaciones (Marta no patrulla). Es el que sirve
   el juego en `public/models/marta.glb`. Fuentes editables:
   `assets/marta.blend` (malla limpia) y `assets/marta_referencia.png`.
- `models/lila.glb` — modelo 3D de Lila (la florista) generado con
  Hunyuan3D-2 (servidor local, imagen→3D con textura) a partir de
  `assets/lila_referencia.png` (imagen generada con ComfyUI en Windows,
  workflow `image_z_image_turbo_int8`: Z-Image-Turbo, estilo chibi como
  Marta pero con peto verde y flor roja en el pelo). Limpio (vértices
  soldados 25k→20k, una sola isla de ~40k caras, sin borrar nada), con la
  cara girada de -Y a +Y (convención del juego) y los pies en z=0 (~1.96
  de alto; la vista lo escala a ~1.5 m por caja envolvente). SIN rig ni
  animaciones (se desplaza con el root como las primitivas). Es el que
  sirve el juego en `public/models/lila.glb`. Fuentes editables:
  `assets/lila.blend` (malla limpia) y `assets/lila_referencia.png`.
  Rig y animación (`assets/lila_rig.blend`, script `~/blender-mcp/lila/rig_walk.py`):
  armature humanoide de 19 huesos con pesos procedurales, walk (1 s) e idle
  (2 s) como pistas NLA; la vista alterna walk/idle al patrullar. Membranas
  entre botas y espinillas eliminadas (se estiraban al andar).
- `models/gon.glb` — modelo 3D de Gon (el herrero) generado con
  Hunyuan3D-2 (servidor local, imagen→3D con textura) a partir de
  `assets/gon_referencia.png` (imagen generada con ComfyUI en Windows,
  workflow `image_qwen_image_edit_2511_int8`: Qwen-Image-Edit 2511 Int8 en
  modo edición semántica sobre `marta_referencia.png`, herrero chibi con
  camisa gris y delantal de cuero marrón). Limpio (vértices soldados
  25k→20k, una sola isla de ~40k caras, sin borrar nada), con la cara
  girada de -Y a +Y (convención del juego) y los pies en z=0 (~1.96 de
  alto; la vista lo escala a ~1.5 m por caja envolvente). CON rig propio
  de 19 huesos y animaciones `walk` masculino (1 s: zancada amplia, poco
  balanceo de cadera, contrarrotación de hombros, brazos rectos algo
  separados) e `idle` (respiración y cambios de peso, 2 s) como pistas NLA
  (plano de corte ax=0.345 entre muslo y manga interior para que no se
  desgarren al caminar). Es el que sirve
  el juego en `public/models/gon.glb`. Fuentes editables:
  `assets/gon.blend` (malla limpia), `assets/gon_rig.blend` (rig) y
  `assets/gon_referencia.png`; script `~/blender-mcp/gon/rig_walk.py`.
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

- `almacen.glb` — modelo 3D del almacén del granjero generado con Hunyuan3D-2
  (servidor local, imagen→3D con textura 2048×2048) a partir de
  `assets/almacen_referencia.png` (imagen generada con ComfyUI en Windows,
  workflow `z_image_turbo_int8.json`: Z-Image-Turbo, granero low-poly estilo
  Stardew Valley con paredes de madera, tejado rojo a dos aguas y puerta
  doble). Limpio (vértices soldados 23.7k→20k, una sola isla de ~40k caras),
  girado 180° en Z (convención del juego), base en y=0 y centrado en el
  origen (~1.96×1.83×1.96 unidades; la vista lo escala por caja envolvente).
  SIN rig ni animaciones (edificio estático). Fuentes editables:
  `assets/almacen.blend` (malla limpia) y `assets/almacen_referencia.png`.

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
