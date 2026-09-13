# Plan: gallina 3D en el juego

Rama: `feature/gallina-3d`. Sigue `docs/plans/modelo-3d-animales.md` (pipeline
gallina original) para la nueva gallina, con las mismas reglas que la vaca
(`docs/plans/vaca-3d.md`) y la oveja (`docs/plans/oveja-animada.md`): modelo
propio con rig y animaciones `walk`/`idle`, no un asset externo.

## Decisión

Modelo generado con **Hunyuan3D-2 local** (servidor en `127.0.0.1:8081`,
imagen→3D con textura) a partir de una **imagen de referencia aportada por
el usuario**. Vía Quaternius descartada (la especie se eliminó en
`feature/eliminar-gallina` precisamente para sustituir el asset externo).

## Pasos

1. **Referencia**: guardar la imagen aportada por el usuario en
   `assets/gallina_referencia.png`.
2. **Generación** (skill `generar-asset-3d`, Paso 1): `generate_hunyuan3d_model`
   (MCP blender) con la referencia. Tarda ~60 s con textura.
3. **Acabado en Blender** (headless, `blender --background`, NO en la sesión
   interactiva): soldar vértices, borrar islas, materiales en mate
   (roughness 0.9), orientación hacia +x con los pies en y=0 y altura ~0.55,
   exportar a `assets/models/gallina.glb` y guardar fuente en
   `assets/gallina.blend`.
   Nota (lección vaca): ante un fichero simétrico, verificar el lado de la
   cabeza por textura (ojos), no por cotas; si el rig queda espejado, rehacer.
4. **Rig propio + animaciones** (mismo proceso que vaca/oveja): huesos en el
   espacio de diseño convertidos según orientación, pesos procedurales,
   animaciones `walk` e `idle` como pistas NLA, guardadas en
   `assets/gallina_rig.blend`.
5. **Publicar**: copiar a `public/models/gallina.glb`. Documentar en
   `assets/README.md` (fuente, proceso).
6. **Vista** (`src/animals/animalView.ts`, sin tocar dominio): reintroducir la
   especie `gallina` en `data/animals.ts` + `buildChicken()` que carga
   `/models/gallina.glb` con `loadModel` en modo clon (fallback a primitivas
   si falla), con `_attachAnims` y el medio giro en Y solo si el fichero mira
   hacia +x (verificar en Babylon, no solo en Blender).
7. **Verificación**:
   - `pnpm verify` (format:check + lint + typecheck + test).
   - En local (`pnpm dev` + `agent-browser`): partida con gallinas vía save
     en localStorage; consola sin errores; `/models/gallina.glb` responde
     200; las gallinas miran en dirección de marcha (cabeza al frente).

## Criterios de aceptación

- Las gallinas del redil usan el modelo GLB propio con walk/idle, no cajas.
- Sin GLB (p. ej. 404), se ven las primitivas de siempre.
- `pnpm verify` en verde.
