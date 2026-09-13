# Plan: Gon 3D en el juego

Rama: `feature/gon-3d`. Sigue el skill `generar-asset-3d` y el precedente
de Marta (`docs/plans/marta-3d.md`) y Lila (`docs/plans/lila-3d.md`):
modelo propio generado con Hunyuan3D-2 local + integración en la vista
con fallback a primitivas.

## Decisión

- **Referencia con Qwen** (a petición): Qwen-Image T2I base no es ejecutable
  en este ComfyUI (faltan `qwen_image_fp8_e4m3fn` y LoRA Lightning de base;
  solo está el UNet `bf16`, inviable en 12 GB de VRAM). En cambio,
  **Qwen-Image-Edit 2511 Int8 sí está en verde** (`local_check.runnable`)
  con sus pesos en local (UNet int8 + LoRA Lightning 4 pasos bf16). Se usa
  en modo edición semántica partiendo de `assets/marta_referencia.png`
  (misma composición frontal, pose A, fondo liso) para obtener a Gon:
  herrero chibi masculino con delantal de cuero, misma línea que Marta/Lila.
- Modelo 3D generado con **Hunyuan3D-2 local** (servidor en `127.0.0.1:8081`,
  imagen→3D con textura 2048×2048) a partir de `assets/gon_referencia.png`.
- CON rig humanoide propio de 19 huesos y animaciones `walk` masculino
  (1 s) e `idle` (2 s) como pistas NLA (`assets/gon_rig.blend`, script
  `~/blender-mcp/gon/rig_walk.py`, adaptado de `lila/rig_walk.py` con
  medidas de Gon y marcha masculina): la vista alterna walk/idle según
  Gon patrulle o esté parado (patrón `playerView`); sin grupos en el GLB,
  el código lo deja estático con fallback.

## Pasos

1. **Referencia** (Qwen-Image-Edit 2511 Int8, template
   `image_qwen_image_edit_2511_int8`): copiar `assets/marta_referencia.png`
   al `input/` de ComfyUI, prompt de edición semántica (herrero chibi,
   delantal de cuero, pelo oscuro corto, brazos fuertes; mantener pose A
   frontal de cuerpo entero y fondo liso). Guardar en
   `assets/gon_referencia.png` (cuerpo entero, de frente, fondo liso).
2. **Generación** (skill `generar-asset-3d`, Paso 1): `generate_hunyuan3d_model`
   (MCP blender) con la referencia. Tarda ~60 s con textura.
3. **Acabado en Blender** (sesión interactiva vía MCP): soldar vértices
   (`remove_doubles`), comprobar isla única (no borrar nada), verificar por
   vista que la cara está en -Y, girar 180° sobre Z del mundo + apply
   (convención del juego), pies a z=0, exportar a `assets/models/gon.glb`
   y guardar fuente en `assets/gon.blend`. **Rig** (headless):
   `~/blender-mcp/gon/rig_walk.py` (adaptado del de Lila con las medidas
   de Gon) reconstruye el rig de 19 huesos con pesos procedurales, anima
   walk masculino + idle, verifica numéricamente el ciclo (cierre f25-f1
   ≈ 0), deja renders en `/tmp/opencode/gon_anim/` y exporta el GLB con
   pistas NLA (fuente en `assets/gon_rig.blend`). Iterar los pesos si los
   renders muestran pinchos o desgarros (plano de corte ax=0.345 entre
   muslo y manga interior).
4. **Publicar**: copiar a `public/models/gon.glb`. Documentar en
   `assets/README.md`.
5. **Vista** (`src/npcs/npcView.ts`, sin tocar dominio): cargar
   `/models/gon.glb` para `gon` con el mismo patrón (escala a ~1.5 m por
   caja envolvente real, apoyo en suelo, sombras, fallback a primitivas si
   falla). Actualizar el comentario (ya no "Gon sigue con primitivas").
6. **Verificación**:
   - `pnpm verify` (format:check + lint + typecheck + test).
   - En local (`pnpm dev` + `agent-browser`): `/models/gon.glb` responde
     200; Gon usa el modelo (no el cilindro gris); camina animado entre
     sus waypoints (walk/idle); al hablar con él se gira hacia el jugador
     (se le ve la cara, no la espalda).

## Criterios de aceptación

- Gon usa el modelo GLB propio con textura; Marta y Lila no cambian.
- Sin GLB (p. ej. 404), Gon se ve con las primitivas de siempre.
- `pnpm verify` en verde.
