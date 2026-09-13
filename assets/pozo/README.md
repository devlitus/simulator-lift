# Pozo de la plaza

Referencia generada con **Qwen Image 2512** en ComfyUI. Modelado propio en
Blender 5.0.1 siguiendo `blender-game-assets`: brocal hueco de piedra, madera,
tejas de terracota, torno, cuerda y cubo. Prop estático con atlas PBR horneado.

## Generación de la referencia

- Workflow de galería: `image_qwen_Image_2512`.
- Copia reproducible: `qwen_workflow.json`, con prompts positivo y negativo.
- Modelo: `qwen_image_2512_fp8_e4m3fn.safetensors`.
- Encoder: `qwen_2.5_vl_7b_fp8_scaled.safetensors`.
- VAE: `qwen_image_vae.safetensors`.
- Resolución: 1024×1024. Seed: **13092026**.
- Modo estándar: 50 pasos, CFG 4, Euler/simple, shift 3,1, denoise 1.
- La LoRA Lightning instalada era inválida: el intento acelerado falló al
  cargarla. La generación final usa `enable_turbo_mode = false`.
- Job completado: `68243d86-51bb-423e-84c3-0f54ea94d32f`.
- Imagen: `../pozo_referencia.png`. La imagen sirve como referencia de
  diseño; la geometría y los materiales se construyen en Blender.

## Fuentes y publicación

- `../pozo.blend`: fuente editable, malla procedural, LOD, colisión de
  referencia y estudio para previsualizar.
- `generar.py`: construcción determinista, limpieza, UV, bake y exportación.
- `pozo_color.png`: color base, sRGB, 1024×1024.
- `pozo_orm.png`: oclusión ambiental (R), rugosidad (G), metalicidad (B),
  datos lineales, 1024×1024.
- `pozo_normal.png`: normales tangentes, datos lineales, 1024×1024, solo LOD0.
- `metricas.json`: revisión topológica de las mallas fuente.
- `preview.png`: vista tres cuartos del asset en Blender.
- `../pozo.glb` y `../../public/models/pozo.glb`: GLB con texturas embebidas.

| Malla | Triángulos fuente | Distancia en Babylon |
| --- | ---: | --- |
| `SM_Pozo_LOD0` | 4.800 | Menos de 22 m |
| `SM_Pozo_LOD1` | 2.400 | 22–38 m |
| `SM_Pozo_LOD2` | 1.440 | Desde 38 m |

Una primitiva y un material por LOD; solo se dibuja el LOD activo. Los LOD
lejanos comparten color/ORM y prescinden del mapa de normales del LOD0.
La reducción del último LOD se limita al 30 % para conservar las duelas
del cubo cerradas. Las tres mallas fuente tienen cero aristas no manifold
y cero caras de área nula. El GLB final contiene 4.800 / 2.400 / 1.436
triángulos, comprobados mediante sus índices y al importarlo en Babylon.

Escala métrica, pivote base-centro, transformaciones aplicadas. Frente en
-Y de Blender, +Z al importar en Babylon. La vista normaliza la altura a
2,2 m con la caja envolvente y apoya el modelo sobre el camino en
`(-3, 0.04, -4)`. Colisión fija de 1,6×1×1,6 m, independiente del GLB.

## Reproducir desde la raíz del repositorio

Requiere Blender 5 con Cycles CPU y el exportador glTF operativo. Cada fase
guarda el `.blend`; las fases de bake deben ejecutarse antes de exportar.

```bash
blender --background --python assets/pozo/generar.py -- construir
blender --background assets/pozo.blend --python assets/pozo/generar.py -- hornear_color
blender --background assets/pozo.blend --python assets/pozo/generar.py -- hornear_orm
blender --background assets/pozo.blend --python assets/pozo/generar.py -- hornear_normal
blender --background assets/pozo.blend --python assets/pozo/generar.py -- exportar
blender --background assets/pozo.blend --python assets/pozo/generar.py -- preparar_preview
blender --background assets/pozo.blend --render-frame 1
```

`exportar` publica el GLB automáticamente. La colisión `UCX_Pozo`, la
fuente procedural y el estudio quedan en Blender, excluidos de ese GLB.
