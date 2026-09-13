# Plan: Lila 3D en el juego

Rama: `feature/lila-3d`. Sigue el skill `generar-asset-3d` y el precedente
de Marta (`docs/plans/marta-3d.md`): modelo propio generado con
Hunyuan3D-2 local + integración en la vista con fallback a primitivas.

## Decisión

Modelo generado con **Hunyuan3D-2 local** (servidor en `127.0.0.1:8081`,
imagen→3D con textura) a partir de una **imagen de referencia generada
con ComfyUI** (workflow `image_z_image_turbo_int8`: Z-Image-Turbo, estilo
chibi igual que Marta pero con peto verde y flor roja en el pelo). CON rig
humanoide propio de 19 huesos y animaciones `walk` (1 s) e `idle` (2 s)
como pistas NLA (`assets/lila_rig.blend`, script
`~/blender-mcp/lila/rig_walk.py`): la vista alterna walk/idle según Lila
patrulle o esté parada (patrón `playerView`); sin grupos en el GLB, el
código la deja estática con fallback.

## Pasos

1. **Referencia**: generar con ComfyUI y guardar en
   `assets/lila_referencia.png` (cuerpo entero, de frente, pose A, fondo
   liso).
2. **Generación** (skill `generar-asset-3d`, Paso 1): `generate_hunyuan3d_model`
   (MCP blender) con la referencia. Tarda unos minutos con textura.
3. **Acabado en Blender** (sesión interactiva vía MCP): soldar vértices
   (`remove_doubles`, 25k→20k), comprobar isla única (no borrar nada),
   verificar por vista que la cara está en -Y, girar 180° sobre Z del mundo
   + apply (convención del juego), pies a z=0 (~1.96 de alto), exportar a
   `assets/models/lila.glb` y guardar fuente en `assets/lila.blend`.
4. **Publicar**: copiar a `public/models/lila.glb`. Documentar en
   `assets/README.md`.
5. **Vista** (`src/npcs/npcView.ts`, sin tocar dominio): generalizar
   `_loadMarta` a `_loadNpcModel(world, root, primitivas, file)` y cargar
   `/models/lila.glb` para `lila` con el mismo patrón (escala a ~1.5 m por
   caja envolvente real, apoyo en suelo, sombras, fallback a primitivas si
   falla).
6. **Verificación**:
   - `pnpm verify` (format:check + lint + typecheck + test).
   - En local (`pnpm dev` + `agent-browser`): `/models/lila.glb` responde
     200; Lila usa el modelo (no el cilindro verde); al hablar con ella se
     gira hacia el jugador (se le ve la cara, no la espalda).

## Criterios de aceptación

- Lila usa el modelo GLB propio con textura; Gon sigue con primitivas.
- Sin GLB (p. ej. 404), Lila se ve con las primitivas de siempre.
- `pnpm verify` en verde.
