# MiniMax H3 — Configuración óptima para RTX 4070 12GB (32GB RAM)

> Máquina verificada `server_info:hardware` → `NVIDIA GeForce RTX 4070 12GB (12878086144)`, `ram_bytes 34282192896 (32GB)`, `Windows 11`, `ComfyUI 0.33.1`, `embedded 3.13.14`, `aimdo 0.4.13`, `pytorch 2.13.0+cu130`. Workflow base `user/default/workflows/minimax_h3_reference_to_video.json` (28 nodos, `MiniMaxH3ReferenceToVideo:136`).

Fuentes: `minimaxh3.video/minimax-h3-requirements`, `docs.comfy.org/tutorials/video/minimax/minimax-h3`, `github.com/Larryvrh/ComfyUI-MiniMax-H3-Turbo`, `minimaxh3tutorial.com/vram` (medición 11.649 MiB / 94.8% en 12GB).

## 1. Por qué 12GB es límite

No hay VRAM mínimo universal. El coste lo fija el **checkpoint + cuantización + resolución + frames + offload**, no la duración. Medición real en 12GB con `REF2VA pruned INT8, audio off` = **11.649 MiB VRAM + >43GB RAM** y apenas varía aunque el clip sea 40× más pequeño. Con `BF16` son 123.6GB en disco y requiere 4 GPUs.

Tu caso: `Model MiniMaxH3 19995MB Staged` + `TE 14956MB` + `VAE 4965MB` = ~40GB staged → solo cabe con offload a RAM. Con 12GB VRAM + 32GB RAM estás justo en el mínimo (ComfyUI recomienda 64GB RAM para 12GB VRAM). A 10s/0.98MP se cuelga (`comfyui.log:12:39:00.581` sin avance 30min, `vram_free 8.8GB` idle).

## 2. Archivos mínimos (42.5GB) — ya los tienes

| Archivo | Path | Tamaño | Nodo |
|---|---|---|---|
| `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | `models/diffusion_models/` | 20.97GB | `127` UNETLoader (Ref2Video) |
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `models/diffusion_models/` | 20.97GB | Solo T2V/I2V |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders/` | 15.69GB | `128` CLIPLoader |
| `minimax_h3_video_vae_fp16.safetensors` | `models/vae/` | 5.21GB | `119` |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae/` | 0.61GB | `120` |
| `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | `models/loras/` | 1.95GB | `145` LoRA Turbo (Ref2V) |
| `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | `models/loras/` | 1.95GB | T2V/I2V |

No instales ambos diffusions si solo usas Ref2Video (ahorras 21GB).

## 3. Resolución y frames nativos

- **Nativo:** short edge **768px** → `1344×768` en 16:9 (`115: aspect_ratio 16:9, megapixels 0.98`, múltiplo 32). No intentes 2K (solo hosted `H3-Regenerate-2K`).
- **Frames:** grid `17k+5` @24fps → `131: max(5,round(a*24))` alineado `%17`. `a = 132.value` (segundos): `124≈5s`, `243≈10s` (tu `f6600715`), `362≈15s`. 24fps es nativo (video shift 12 / audio shift 3); 60fps nativo no existe, se interpola después con RIFE.

## 4. Turbo — obligatorio en 12GB

- Ref2Video solo tiene `ref2v_turbo_4step` (LightX2V/ModelTC). T2V/I2V: `fl2v_turbo_8step` o `larryvrh v4 (6-8 steps)` (recomendado general).
- Actívalo con `146.value:true` → `141` switch modelo (LoRA) + `142` switch steps `20→4`. Guidance-free → `CFG 1.0`.
- **Steps útiles 4–8:** 4 = mínimo rápido (smearing en movimiento rápido), **6–8 = calidad** (autores recomiendan 6–8, >8 sobre-nitidez). Mantén `strength 1.0` (`145.strength_model`), baja a 0.6–0.8 solo si ruido.

| Modo | Sampler `123` | Scheduler `124` | Steps `124.steps` |
|---|---|---|---|
| Turbo Ref2V | `res_multistep` | `beta` (o `simple` en Turbo Sampler) | **4 (velocidad) / 6 (calidad)** |
| Base 20 pasos | `res_multistep` | `beta` | 20–25 |

## 5. Config óptima para tu 4070 12GB

### A) 5s catálogo — estable, máxima calidad 768p
```
115.megapixels: 0.98 (1344×768)
132.value: 5 → 124 frames @24fps
136.length: auto (131)
146.value: true (turbo ref2v 4step, strength 1.0)
124.steps: 6 (usa 4 si quieres más velocidad)
130.fps: 24, 115.multiple: 32, 136.ref_image_size: max (fidelidad) / match (velocidad)
```
~3min por clip, ~11.6GB VRAM pico (94.8%).

### B) 10s teaser — límite, baja resolución
```
115.megapixels: 0.6 (~1024×576)
132.value: 10 → 243 frames @24fps
146.value: true
124.steps: 4–6
```
~4–5min, evita OOM. No subas a 0.98MP a 10s (se cuelga como `5c183dbb`).

### C) 15s → no intentes a 768p en 12GB, usa cloud o 5090 32GB.

## 6. Checklist antes de queue

- [ ] `Smart App Control: On` → causa `WinError 4551 shm.dll`. Pon exclusiones `Add-MpPreference` en `python_embeded` + `ComfyUI` y desactiva `Control de aplicaciones → Smart App Control` + reinicia (ya hecho `Unblock-File` en `torch\lib\shm.dll`).
- [ ] Cierra navegador/otros — necesitas >40GB RAM sostenida, si pagina a disco se cuelga.
- [ ] `validate_workflow` → `workflow_deps` → `install_node` si falta.
- [ ] `free_memory` antes de 10s (pasó de `vram_free 8.8GB → 11.56GB`, `RAM 4.4GB → 25.6GB`).
- [ ] Limpia cola vieja (`comfy jobs ls` tenía 7 `queued` desde 26/08) o `prompt_id` nuevo queda detrás.

## 7. Prompt H3

Describe escena global primero, luego shots con tiempo, cámara y audio en un bloque. Usa `<Picture N>` para referencias y asigna rol explícito por imagen (`138.value`).

```
<Picture 1> niña vestido comunión, referencia identidad shot1, jardín...
Vibrant children's fashion campaign, crisp catalog lighting, hard cut...
[0s-1.2s] Shot one: <Picture 1> spins...
Audio: light footsteps, non_diegetic_music: N/A
```

Ref: `docs.comfy.org` + `VIDEO_PROMPT_WRITING_GUIDE_base_en.md`.

## 8. Troubleshooting

- `Out of VRAM during load` → verifica que usas `pruned_int8+nvfp4`, offload activo, baja a 0.6MP o acorta a 5s.
- `shm.dll 4551` → exclusión Defender + Smart App Control off + reinicio.
- `sqlalchemy missing` → lanza siempre con `python_embeded` (`run_nvidia_gpu.bat`), no con `Python312` sistema.
- `over-sharp artifacts` → baja steps de 8→6, no subas strength >1.0.

> Último test: `f6600715 10s 0.6MP turbo running` tras `free_memory` + `cancel b57715fd`. Si completa, valida workflow; si falla, probar `A` 5s 0.98MP 6 steps.
