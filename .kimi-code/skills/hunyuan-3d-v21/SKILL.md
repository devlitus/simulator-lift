---
name: hunyuan-3d-v21
description: Best practices for Hunyuan3D 2.1 image-to-3D (shape + PBR texture) in ComfyUI — input prep, VRAM recipes, shape/texture parameters, QA and export.
type: prompt
whenToUse: When the user asks to create a 3D model, mesh or GLB from an image, mentions Hunyuan / hunyuan_3d_v2.1 / image-to-3D / SaveGLB / VoxelToMesh, or works on a Hunyuan3D workflow.
---

# Hunyuan3D 2.1 — Image to 3D (ComfyUI)

Tencent Hunyuan3D 2.1. Two stages: **shape** (3.3B MoE DiT + DINOv2-Large + ShapeVAE) then **paint PBR** (2B: albedo + metallic + roughness).
Single-view only. Front of mesh = front of input image.

Repackaged model used here: `Comfy-Org/hunyuan3D_2.1_repackaged` → `hunyuan_3d_v2.1.safetensors` → `models/diffusion_models/`.

## 1. Input image (decides 80% of result)

- One centered object, full silhouette inside frame, plain or transparent background.
- Prefer RGBA with removed background (`rembg`). Internal resize is 518x518, but upload high-res with clean edges.
- Visible volume (rounded, photo/product) > flat logo, thin line drawing, crowded scene.
- No text, watermark, brand marks. Good lighting, strong silhouette.
- Bad inputs = melted backs, floating pieces, stretched geometry (model invents hidden sides).

## 2. Models / install (portable ComfyUI)

```
ComfyUI/models/diffusion_models/hunyuan_3d_v2.1.safetensors   # shape (repackaged)
ComfyUI/models/vae/hunyuan3d-vae-v2-1.ckpt                    # solo si el wrapper lo pide
hy3dpaint/ckpt/RealESRGAN_x4plus.pth                          # solo para paint + upscale
```

- Native ComfyUI chain: `ImageOnlyCheckpointLoader` → `Hunyuan3Dv2Conditioning` + `EmptyLatentHunyuan3Dv2` → `ModelSamplingAuraFlow` → `KSampler` → `VAEDecodeHunyuan3D` → `VoxelToMesh` → `SaveGLB`.
- Full PBR (albedo/specular/roughness + multiviews): custom node `visualbruno/ComfyUI-Hunyuan3d-2-1` (needs custom_rasterizer + DifferentiableRenderer wheels, Windows: usar `dist/*.whl` con `python_embeded`).
- Workflows del proyecto: `C:\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows`. Trabajar sobre copia, nunca sobre el original.
- Output de este proyecto: raíz `W:\render3D\` (regla AGENTS.md §4), además del GLB que guarde el nodo SaveGLB.

## 3. VRAM (crítico — RTX 4070 12GB)

| Stage | VRAM | Nota |
|---|---|---|
| Shape | ~10GB | Cabe en 12GB |
| Texture / paint | ~21GB | NO cabe directo en 12GB |
| Shape + texture seguido | ~29GB | Requiere offload |
| Low VRAM mode | ~15GB | `--low_vram_mode` / offload CPU |

Receta 12GB: shape sí (steps 25-30, octree 256-384). Textura: `low_vram_mode`, `view_size 512`, `texture_size 1024`, `max_num_view 6`, `resolution 512`. Si OOM en bake → bajar `texture_size` primero, luego `view_size`.

## 4. Shape parameters

| Param | Default / prod | Rango | Uso |
|---|---|---|---|
| `steps` (`num_inference_steps`) | 30 (25 sweet Comfy, 50 prod) | 5-50 | 15-20 previews, 25-30 calidad/velocidad, 40-50 final |
| `guidance_scale` | 5.0-7.5 | 0-15 | Más = más fiel a imagen, menos diversidad |
| `octree_resolution` | 384 | 128-512 | 256 preview ~50K verts, 384 ~100K, 512 ~200K (memoria cúbica) |
| `seed` | fijo | — | Fijar para comparar, variar para explorar |
| `mc_level` | 0.0 | — | Threshold marching cubes, no tocar |
| `box_v` | 1.01 | — | No tocar |
| `num_chunks` | 8000 | — | Subir si OOM en decode |

Post: `Post Process Trimesh` con `remove_floaters=true`, `reduce_faces` según destino (`max_facenum` bajo para real-time, alto para render).

## 5. Texture / PBR parameters

| Param | Default | Rango | Uso |
|---|---|---|---|
| `max_num_view` | 6 | 6-9 (hasta 32 avanzado) | 6 base, 9-10 mejor costuras |
| `resolution` / `view_size` | 512 | 512,768,1024 | 512 base 12GB, 768 calidad |
| `texture_size` | 1024 | 512-4096 (nodo max 2048) | 1024 base, 2048 detalle (VRAM!) |
| `steps` paint | 10 | 1-100 | Paint es barato, 10 basta |
| `guidance_scale` paint | 3.0 | 1-10 | Alineación textura |
| `unwrap_mesh` | true | — | Dejar on salvo UVs propias buenas |
| `upscale_multiviews` | None | — | Real-ESRGAN antes de bake para detalle |

Salidas paint: albedo/base color + specular/metallic + roughness. Para AO/normal/high→low bake → Substance Painter / Blender.

## 6. Export y QA

- `GLB`: preview texturado, web, entrega rápida. `OBJ + maps`: pipeline pro. `STL`: solo geometría. `PLY`: revisión mesh.
- Revisar en 2ª herramienta (visor 3D/Blender): frente, espalda, underside, silueta, seams, escala, topología, piezas flotantes, polycount.
- Mesh IA = primer pase rápido, no asset final: espera cleanup, retopo, ajuste escala, edición texturas, revisión licencias.
- Guardar siempre: imagen fuente + seed + steps/guidance/octree/views/resolution + versión modelo + notas revisión.

## 7. Troubleshooting

- `CUDA OOM` en shape → `octree 384→256`, steps 50→25, `num_chunks`↑, cerrar resto, `low_vram_mode`.
- `OOM` en bake → `texture_size 2048→1024`, luego `view_size 768→512`, `max_num_view 9→6`.
- Fondo no eliminado → convertir a RGBA / `rembg` manual antes de LoadImage.
- Geometría pobre → subir steps a 40+, probar otra seed, mejorar imagen entrada (no subir guidance a lo loco).
- Artefactos textura → verificar mesh limpio primero (floaters fuera), apretar cámaras antes de subir resolución.
- `custom_rasterizer / DifferentiableRenderer` falta → instalar wheels `dist/` con `python_embeded`, o compilar (`setup.py install` + `compile_mesh_painter.sh`).
- Nodos wrapper incompletos (ej. Kijai solo shape) → usar `visualbruno/ComfyUI-Hunyuan3d-2-1` para multiview + PBR completos.

## 8. Checklist antes de queue

- [ ] Imagen: objeto único, centrado, fondo limpio/transparente, sin texto?
- [ ] Workflow: copia en `user/default/workflows`, validado (`validate_workflow`)?
- [ ] Shape: steps 25-30, guidance 5-7.5, octree según VRAM, seed fijada?
- [ ] 12GB: `texture_size 1024`, `view_size 512`, `views 6` o solo shape?
- [ ] Export GLB + guardar settings para auditoría?

## 9. Alternativa CPU sin PBR (12GB, verificado 2026-09-10)

Si la PBR oficial no es viable (pide 21GB; wrapper `visualbruno` exige compilar
`custom_rasterizer` + `DifferentiableRenderer` y sus wheels solo llegan a cp312,
pero el portable usa Python 3.13 → sin MSVC no compila):

1. Quedarse con comps ≥500 verts (fuera floaters), `merge_vertices`.
2. Proyección ortográfica frontal (+Z): mapear bbox X→ancho objeto en foto,
   bbox Y→alto objeto en foto.
3. Muestrear foto en vértices con `normal.z > 0.25`, resto por difusión
   laplaciana (~120 iters, `scipy.sparse`) desde bordes visibles.
4. Exportar GLB con vertex colors (`trimesh` escribe `COLOR_0`).
5. QA con render z-buffered en `matplotlib`/PIL (el scatter disperso engaña).

Resultado: frente fiel a la foto, trasera suavizada. Base válida para
retoque en Blender/Substance. PBR real → máquina 24GB+.

## 10. QA en Blender (WSL, verificado 2026-09-10)

Blender 5.0.1 en Ubuntu WSL (`wsl -e blender`). Headless con EEVEE CPU.

- El Python de Blender es el del sistema (3.14) pero **no** carga user site:
  `numpy`/`Pillow` van en `~/.local` (`pip install --user`, sin sudo) y el
  script debe hacer `sys.path.insert(0, "/home/carle/.local/lib/python3.14/site-packages")`
  **antes** del `import_scene.gltf` (el importer exige numpy).
- Tras `read_factory_settings(use_empty=True)`, `scene.world` es None → crearlo.
- El GLB con vertex colors importa el atributo como `Color`: material =
  `ShaderNodeVertexColor(layer=Color)` → `Principled BSDF.Base Color`.
- Frente del mesh (trimesh +Z) queda en -Y de Blender: cámara en
  `(cx, cy - 2.6*r, cz)` mirando al centro (radio bounding-sphere `r`).
- EEVEE sin GPU da avisos EGL/ZINK pero renderiza igual (~25s/frame 1024px).
- Guardar previews en raíz del proyecto (`W:\render3D\` = `/mnt/w/render3D/`).
- MCP Blender (global, `opencode.jsonc`): servidor `blender` via
  `C:\Users\carle\.local\bin\blender-mcp.exe` (instalado con `uv tool`).
  Requiere reiniciar la sesión de opencode + Blender GUI abierto en WSL con el
  addon BlenderMCP activo (sirve en `127.0.0.1:9876`, reenviado a WSL2).

ARGUMENTS: descripción del objeto + path imagen entrada + con/sin textura + destino (preview / game / print).
