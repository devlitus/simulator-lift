# Plan: Marta 3D en el juego

Rama: `feature/marta-3d`. Sigue el skill `generar-asset-3d` y el precedente
de la gallina (`docs/plans/gallina-3d.md`): modelo propio generado con
Hunyuan3D-2 local + integración en la vista con fallback a primitivas.

## Decisión

Modelo generado con **Hunyuan3D-2 local** (servidor en `127.0.0.1:8081`,
imagen→3D con textura 2048×2048) a partir de una **imagen de referencia
generada con ComfyUI** (workflow `image_z_image_turbo_int8`: Z-Image-Turbo,
estilo chibi igual que `assets/granjero_reference.png`). Sin rig ni
animaciones en v1: Marta no patrulla (`waypoints: null`, se queda en su
tienda), así que el modelo estático basta; el código tolera
`animationGroups` vacío.

## Pasos

1. **Referencia**: generar con ComfyUI y guardar en
   `assets/marta_referencia.png` (cuerpo entero, de frente, fondo liso).
2. **Generación** (skill `generar-asset-3d`, Paso 1): `generate_hunyuan3d_model`
   (MCP blender) con la referencia. Tarda ~60 s con textura.
3. **Acabado en Blender** (sesión interactiva vía MCP): soldar vértices
   (`remove_doubles`, 25k→20k), comprobar isla única (no borrar nada),
   verificar por render que la cara está en -Y, girar 180° sobre Z del mundo
   + apply (convención del juego), pies a z=0 (~1.96 de alto), exportar a
   `assets/models/marta.glb` y guardar fuente en `assets/marta.blend`.
4. **Publicar**: copiar a `public/models/marta.glb`. Documentar en
   `assets/README.md`.
5. **Vista** (`src/npcs/npcView.ts`, sin tocar dominio): `buildNPC` carga
   `/models/marta.glb` solo para `marta` con el patrón de
   `playerView._loadFarmer` (escala a ~1.5 m por caja envolvente real, apoyo
   en suelo, sombras, fallback a primitivas si falla).
6. **Verificación**:
   - `pnpm verify` (format:check + lint + typecheck + test).
   - En local (`pnpm dev` + `agent-browser`): `/models/marta.glb` responde
     200; Marta usa el modelo (no el cilindro rosa); al hablar con ella se
     gira hacia el jugador (se le ve la cara, no la espalda).

## Criterios de aceptación

- Marta usa el modelo GLB propio con textura; Gon y Lila siguen con primitivas.
- Sin GLB (p. ej. 404), Marta se ve con las primitivas de siempre.
- `pnpm verify` en verde.
