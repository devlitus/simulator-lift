# assets/

Contenido binario del juego: modelos `.glb`, texturas y audio.

## Estado actual

- `granjero.glb` — modelo 3D del jugador con rig y animaciones, texturizado con
  materiales de colores planos (sin texturas) a partir de `granjero_00001_.png`
  (imagen de referencia con la que se generó la geometría). Fuente editable:
  `~/blender-mcp/granjero.blend`. Es el respaldo rigado: el que sirve el juego
  en `public/models/granjero.glb` es hoy `granjero_texturizado.glb`.
- `granjero_texturizado.glb` — modelo del jugador generado con Hunyuan3D-2
  (servidor local, imagen→3D con textura) a partir de `granjero_00001_.png`,
  con atlas de textura de 2048×2048 y sin rig ni animaciones. Limpio de
  artefactos (vértices soldados e islas eliminadas). Fuente editable:
  `assets/granjero_texturizado.blend`.
- `granjero_original.glb` — copia del modelo original sin texturizar ni recortar
  la peana (respaldo).
- `models/gallina.glb` — modelo 3D de la gallina: asset
  [Chicken de Quaternius](https://poly.pizza/m/ineV9pU5VL) (CC0, ~1.6k vértices,
  con animaciones idle/walk/etc. en el propio .glb para uso futuro). Acabado en
  Blender: materiales en mate, orientada hacia +x con los pies en y=0 (~0.55
  unidades de alto). Fuente editable: `~/blender-mcp/gallina_quaternius.blend`
  (script: `~/blender-mcp/gallina_quaternius_finish.py`).

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
