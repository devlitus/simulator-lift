---
name: generar-asset-3d
description: Genera un modelo 3D con textura (Hunyuan3D local), lo limpia y orienta en Blender y lo integra en el juego
whenToUse: Cuando el usuario pida crear/generar un modelo 3D, un asset con texturas para el juego, o sustituir/añadir un .glb de un personaje, animal u objeto
---

Proceso completo imagen→3D→juego, probado en este repo. Sigue los pasos en orden; las trampas conocidas están marcadas con ⚠️.

## Paso 0 — Prerequisitos (una vez por sesión)

1. Servidor Hunyuan3D local: `/home/carle/works/Hunyuan3D-2/start_server.sh` (arranca con `--enable_tex`; ~40 s con los modelos en caché). Verificar: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/docs` → `200`.
2. Blender abierto con el addon Blender MCP conectado y `hunyuan3d_api_url = http://127.0.0.1:8081` en sus preferencias.
3. ⚠️ El texturizado pica ~21 GB de RAM (offload a CPU): no lanzar otras cargas pesadas durante la generación.

## Paso 1 — Generar el modelo con textura

- Solo funciona **imagen→3D** (`input_image_url` con ruta absoluta). ⚠️ Texto→3D NO está disponible (el servidor tiene el pipeline texto→imagen desactivado a propósito; no intentar habilitarlo, no cabe en VRAM/RAM).
- Llamar a `generate_hunyuan3d_model` (MCP blender) con la imagen de referencia. Tarda ~60 s con textura.
- ⚠️ La llamada MCP puede dar *timeout*: la generación continúa en el servidor y normalmente el modelo aparece importado en Blender igualmente. Si no, el GLB está en `/home/carle/works/Hunyuan3D-2/gradio_cache/<uid>.glb` — importarlo a mano con `bpy.ops.import_scene.gltf`.
- ⚠️ El mensaje "NETWORK ERROR DUE TO HIGH TRAFFIC" del servidor es genérico = cualquier error interno. Mirar `Hunyuan3D-2/server.log` para el traceback real. Si el proceso desapareció, fue OOM: revisar RAM/swap de WSL (`.wslconfig`).

## Paso 2 — Limpieza en Blender (orden crítico)

En modo Edición sobre el mesh importado:

1. **Primero** soldar: seleccionar todo + `mesh.remove_doubles(threshold=0.0001)`. El mesh viene con los vértices duplicados por cara.
2. **Después** borrar islas: componentes conexas por caras, conservar solo la mayor (`bmesh`, recorrer `link_faces`).
3. ⚠️ Si se borran islas SIN soldar antes, cada cara es su propia isla y se elimina el modelo entero.

## Paso 3 — Orientación (convención del juego)

El modelo generado mira al lado contrario del que espera el juego (al caminar, se vería la cara). Girar 180° así:

```python
from mathutils import Matrix
import math
obj.matrix_world = Matrix.Rotation(math.pi, 4, 'Z') @ obj.matrix_world
bpy.ops.object.transform_apply(rotation=True)
```

- ⚠️ NUNCA `obj.rotation_euler.z += math.pi`: la rotación de importación glTF (90° en X) hace que ese euler compuesto no sea un giro vertical limpio. Siempre matriz sobre el eje Z del mundo + apply.
- ⚠️ En Babylon, los meshes importados de glTF traen `rotationQuaternion`: asignar `rotation.y` no tiene efecto sobre ellos (en pruebas in-page usar `rotationQuaternion.multiply(...)`).

## Paso 4 — Guardar y publicar

1. Exportar selección: `bpy.ops.export_scene.gltf(filepath=..., export_format='GLB', use_selection=True)` a `assets/<nombre>.glb` (fuente versionada). El aviso "Draco mesh compression is not available" es inofensivo.
2. Copiar el mismo GLB a `public/models/<nombre>.glb` (Vite solo sirve `public/`, como `/models/...`).
3. Guardar el `.blend` fuente en `assets/<nombre>.blend` — sin él, cerrar Blender pierde el trabajo de limpieza.
4. Actualizar `assets/README.md` con la entrada del nuevo asset.

## Paso 5 — Integración en el juego

- Los `*View.ts` cargan con `BABYLON.SceneLoader.ImportMeshAsync('', '/models/', '<nombre>.glb', scene)` y **siempre con fallback** a primitivas si la carga falla (ver `src/player/playerView.ts:_loadFarmer`).
- Escalar y apoyar en el suelo con la caja envolvente real, nunca constantes a medida del modelo:

```ts
const { min, max } = model.getHierarchyBoundingVectors(true);
const escala = ALTURA_OBJETIVO / (max.y - min.y);
model.scaling = new BABYLON.Vector3(escala, escala, escala);
model.position.y = -min.y * escala;
```

- El modelo generado no trae rig ni animaciones; el código debe tolerar `animationGroups` vacío.

## Paso 6 — Verificación

1. `pnpm verify` (format + lint + typecheck + tests) en verde.
2. Prueba visual real: `pnpm dev`, abrir http://localhost:5173 con el skill `agent-browser` y captura de pantalla. Para simular teclas mantenidas:
   `agent-browser eval "window.dispatchEvent(new KeyboardEvent('keydown', {key:'w'})); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', {key:'w'})), 1500); 'ok'"`
3. Para un personaje: al caminar hacia delante (W) debe verse la espalda; si se ve la cara, volver al Paso 3.
