---
name: best-zimage-prompting
description: Use when generating images with Z-Image-Turbo (INT8-ConvRot or BF16/FP8/GGUF) in ComfyUI — natural-language prompt formula, sampler recipe, bilingual text rules and reference-image patterns for Hunyuan3D.
type: prompt
whenToUse: When the user asks to generate, improve or iterate an image with Z-Image-Turbo (workflow z_image_turbo_int8.json / image_z_image_turbo_int8 / zimage_gallina.json), or needs a reference image (character, animal, NPC) for image-to-3D.
---

# Z-Image-Turbo (INT8) — Prompting y receta ComfyUI

Z-Image-Turbo (Tongyi-MAI, Apache 2.0): DiT single-stream de 6B parámetros
(S3-DiT), destilado a ~8 NFEs. Rápido, fotorrealista, buen seguimiento de
instrucciones y render bilingüe EN+ZH. Lee **frases naturales**, no tags
estilo SD (`1girl, masterpiece, best quality` → resultado genérico).

Fuentes: model card oficial (`Tongyi-MAI/Z-Image-Turbo`, `Comfy-Org/z_image_turbo`),
docs de ComfyUI (`docs.comfy.org/tutorials/image/z-image/z-image-turbo`),
guías fal.ai / deAPI / fliki.ai / aireiter.com / opten.space, y el workflow
local `z_image_turbo_int8.json` (ver §5).

## 1. Lo que lo hace distinto (no lo trates como SDXL)

1. **Sin negative prompt.** Destilado con guidance a cero: el campo negativo
   se **ignora**. Toda restricción va dentro del prompt positivo como
   presencia (`sharp focus, clean background`) o exclusión explícita
   (`no watermark, no extra text`).
2. **Pasos casi fijos.** 8 NFEs es el punto dulce (en ComfyUI se expone como
   `steps 8–9`: 9 settings = 8 pasadas DiT). Más pasos (20-40) no mejora y
   puede meter artefactos tipo rejilla o "freír" la imagen.
3. **No toques el CFG para "arreglar" un prompt.** Guidance efectiva 0
   (CFG 1.0 en ComfyUI). Subirlo (>2.5) quema/satura. Si no acierta,
   reescribe el prompt o cambia la seed.
4. **Atención limitada.** Límite CLIP ~512 tokens; la calidad deriva a partir
   de ~75-100 tokens efectivos. Rango de trabajo: **30–120 palabras**
   (80–250 como techo). Lo importante, **al principio**.
5. **Prior por defecto = "beauty stock".** Sin cámara/lente/película ni
   rasgos no idealizados, todo sale glossy. El antídoto es vocabulario
   fotográfico concreto (§3), no adjetivos vagos (`beautiful, realistic`).

## 2. Fórmula de prompt (6 bloques, en este orden)

```
[Sujeto + rasgos] + [Acción/pose] + [Entorno] + [Iluminación] +
[Estilo/medio, UNO solo] + [Composición/cámara] + [Restricciones en positivo]
```

| Bloque | Qué poner | Ejemplo |
|---|---|---|
| Sujeto | quién/qué, edad, ropa, materiales, 1 rasgo no idealizado si es persona | `teenage sci-fi hero with spiky silver-white hair, sharp determined eyes` |
| Acción/pose | qué hace, cómo está colocado | `standing A-pose, holding an energy katana` |
| Entorno | lugar, hora, 1–2 props con posición | `rainy Shanghai backstreet at midnight, brick wall` |
| Iluminación | fuente + dirección + calidad (lo que más mueve el resultado) | `soft overhead softbox with golden rim light from upper-right` |
| Estilo | UN solo medio | `anime cel-shaded illustration` / `analog film photograph` / `oil painting with visible brushstrokes` (no mezclar 3) |
| Composición + restricciones | plano, lente, fondo, texto exacto, exclusiones | `full-body, centered, entire body visible, no cropping, no watermark` |

Reglas:

- 3–5 conceptos visuales fuertes por prompt, no más.
- Lenguaje natural y eficiente (`soft natural light`, `85mm f/1.4`).
- Estilo fotográfico = **1 cámara + 1 película/luz** como máximo
  (`shot on Phase One IQ4 with 80mm macro at f/9` + `shallow depth of field`).
  Apilar más diluye el efecto.
- Sin contradicciones (`photorealistic cartoon`, pedir BGM y prohibirla, etc.).

## 3. Diccionario mínimo (frases que sí mueven la aguja)

- **Cámaras:** `shot on Canon EOS R5, 85mm f/1.4` · `35mm street-photography
  framing` · `handheld iPhone snapshot with slight motion blur` ·
  `candid point-and-shoot snapshot, on-camera flash falloff` ·
  `medium-format film photograph, Kodak Portra tones`.
- **Luz:** `golden hour glow` · `soft diffused overcast light` ·
  `three-point studio lighting` · `neon lights, reflections on wet pavement` ·
  `dramatic contrast, soft shadows`.
- **Textura (anti-plástico):** `natural skin texture, visible pores` ·
  `fabric weave` · `soft film grain` · `sharp confident linework`.
- **Restricciones (en positivo):** `sharp focus on the subject, crisp fine
  detail` · `simple clean backdrop, uncluttered negative space` ·
  `natural hands with five clearly separated fingers` ·
  `plain unbranded surface, no visible logo or watermark` ·
  `no extra lettering, only the quoted title is readable`.

## 4. Texto dentro de la imagen (superpoder bilingüe)

Rinde EN + ZH legibles a la vez (etiquetas, neones, pósters). Reglas:

1. Texto exacto **entre comillas dobles**, nunca parafraseado:
   `the sign reads "夜市 / NIGHT MARKET"`.
2. Tipografía y posición aparte: `bold red neon characters on top, thinner
   English font below, centered hanging sign`.
3. Corto: etiquetas y titulares, no párrafos ni menús densos.
4. Si hay que prohibir un idioma, en el **positivo**:
   `English text only, no Chinese characters on the sign`.

## 5. Receta ComfyUI (instalación local, RTX 4070 12GB)

Workflow: `user/default/workflows/z_image_turbo_int8.json` (nodo
`f2fdebf6-…`, formato API). Modelos (todos de `Comfy-Org/z_image_turbo`,
nota Markdown del workflow):

```
models/diffusion_models/z_image_turbo_int8_convrot.safetensors  # INT8-ConvRot, nativo desde ComfyUI v0.27
models/text_encoders/qwen_3_4b_fp8_mixed.safetensors             # encoder Qwen3-4B
models/vae/ae.safetensors                                       # VAE (como Flux 1)
```

| Parámetro | Valor | Por qué |
|---|---|---|
| Steps | **8** (8–9) | Destilado para ~8 NFEs; más = peor o igual |
| CFG / guidance | **1.0** (= guidance 0) | Subirlo quema la imagen |
| Sampler / scheduler | `res_multistep` + `simple` (oficial); `euler` + `simple`/`ddim_uniform` válido y rápido | Receta del template oficial |
| Resolución | 1024×1024 base; panoramas 1536×640; retrato ref 1024×1536 | Nativa de entrenamiento |
| Seed | **fija** al iterar prompt; variar solo para explorar | Comparar redacción sin salto de composición |
| Batch | 2–4 variantes al finalizar | Curar en vez de confiar en una muestra |

Variantes por VRAM (mismo prompt, misma receta): BF16 (~12 GB, 14–16 GB
VRAM), FP8 e4m3fn (mejor calidad) / e5m2 (más rápido) para ~8 GB, GGUF
Q5–Q8 + nodo `ComfyUI-GGUF` para 6–12 GB. Procedimiento MCP: trabajar sobre
copia del workflow, `list_workflow_slots` / `set_workflow_slot` para el
prompt, `validate_workflow` antes de `run_workflow(wait=False)` +
`job(action="wait")`.

## 6. Patrón de este proyecto: referencia para Hunyuan3D

Las imágenes Z-Image de este repo no son el producto final: son la
**referencia frontal para image-to-3D** (granjero, marta, gallina, vaca).
Hunyuan3D necesita silueta completa y limpia, así que el prompt añade un
bloque de constraints 3D:

```
Full-body character concept art, front view, standing A-pose, [sujeto + ropa + paleta],
[estilo chibi / proporciones del juego], clean simple light gray studio background,
centered composition, entire body visible from head to feet, no cropping,
official character design reference sheet
```

Ejemplo real (workflow local, 1024×1536, seed fija, steps 8):

```
Full-body character concept art, front view, standing A-pose, teenage sci-fi hero
with spiky silver-white hair and sharp determined eyes, wearing futuristic
samurai-inspired armor that fuses traditional Japanese kimono silhouette with
high-tech plating, glowing cyan energy lines along the armor seams, red and white
color scheme with gold trim, flowing short haori-style cape torn at the edges,
holding an energy katana with humming blue plasma blade, anime cel-shaded
illustration style, clean simple light gray studio background, sharp confident
linework, vibrant saturated colors, dynamic yet readable silhouette, official
character design reference sheet, centered composition, entire body visible
from head to feet, no cropping
```

Checklist referencia-3D: ¿cuerpo entero sin recorte? ¿pose A frontal?
¿fondo liso claro? ¿sin texto/logos/marcas? ¿silueta legible en miniatura?
Si algo falla, reescribir el prompt antes de tocar steps/CFG.

## 7. Troubleshooting

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Cara plástica / mirada fija | sin acción ni textura | añadir acción real + `candid, unposed` + dirección de mirada + `natural skin texture` |
| Texto deriva / palabras extra | texto largo o sin comillas | acortar, entrecomillar exacto, fijar tamaño/posición, quitar copy secundario |
| Manos raras | acción de manos sin describir | describir la acción visible + `natural five-finger anatomy`; probar varias seeds |
| Escena abarrotada | demasiados props/estilos | máx 2 props con posición; reducir lenguaje de estilo antes de subir steps |
| Imagen quemada / "frita" | CFG o steps altos | CFG → 1.0, steps → 8 |
| Negra / ruido | VAE o precisión mal | comprobar `ae.safetensors`; en VRAM baja pasar a FP8/GGUF |
| OOM | resolución o modelo | 1216×832 o GGUF + `PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128` |

## 8. Checklist antes de queue

- [ ] ¿Frases naturales (no tags SD), sujeto primero, <120 palabras?
- [ ] ¿Un solo estilo + una sola cámara?
- [ ] ¿Luz con fuente, dirección y calidad?
- [ ] ¿Restricciones en el positivo (nada en negative)?
- [ ] ¿Texto exacto entrecomillado con fuente/posición, o `no text` si es referencia-3D?
- [ ] ¿Steps 8, CFG 1.0, sampler/scheduler de receta, seed fija, resolución nativa?
- [ ] ¿Workflow validado (`validate_workflow`)?

ARGUMENTS: descripción de la imagen deseada (+ si es referencia para Hunyuan3D: personaje/animal, estilo chibi del juego, fondo liso).
