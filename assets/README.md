# assets/

Contenido binario del juego: modelos `.glb`, texturas y audio.

## Estado actual

- `granjero.glb` — modelo 3D del jugador, texturizado con materiales de colores
  planos (sin texturas) a partir de `granjero_00001_.png` (imagen de referencia
  con la que se generó la geometría). Fuente editable: `~/blender-mcp/granjero.blend`.
- `granjero_original.glb` — copia del modelo original sin texturizar ni recortar
  la peana (respaldo).
- `models/gallina.glb` — modelo 3D de la gallina, mismo pipeline: imagen de
  referencia `gallina_00001_.png` (Z-Image Turbo en ComfyUI), malla
  `models/gallina_original.glb` (Hunyuan3D 2.0 en ComfyUI) y acabado en Blender
  (peana recortada, colores planos, orientada hacia +x con los pies en y=0,
  0.55 unidades de alto). Fuente editable: `~/blender-mcp/gallina.blend`
  (script: `~/blender-mcp/gallina_finish.py`).

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
