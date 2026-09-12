# Plan: vaca 3D en el juego

Rama: `feature/vaca-3d`. Sigue `docs/plans/modelo-3d-animales.md` (pipeline
gallina) para la vaca.

## Decisión

Modelo generado con **Hunyuan3D-2 local** (servidor en `127.0.0.1:8081`,
imagen→3D con textura) a partir de una **imagen de referencia aportada por
el usuario**. Vía Quaternius descartada a petición del usuario. ComfyUI no
está instalado ni responde en `127.0.0.1:8188`, así que no forma parte del
pipeline (la skill `generar-asset-3d` tampoco lo usa).

## Pasos

1. **Acabado en Blender** (headless, `blender --background`, NO en la sesión
   interactiva): abrir `Cow.blend`, materiales en mate (roughness 0.9),
   orientación hacia +x con los pies en y=0 y altura ~1.2, exportar a
   `assets/models/vaca.glb` con animaciones y guardar fuente en
   `~/blender-mcp/vaca_quaternius.blend`.
   Nota (lección oveja): los transforms de nodos envoltorio no afectan a
   mallas esqueletizadas en Babylon; hornear orientación/escala en la
   exportación y verificar SIEMPRE en Babylon, no solo en Blender.
2. **Publicar**: copiar a `public/models/vaca.glb`. Documentar en
   `assets/README.md` (fuente, licencia CC0 + enlace).
3. **Vista** (`src/animals/animalView.ts`, sin tocar dominio):
   - `buildCow()` carga `/models/vaca.glb` con `loadModel` en modo clon
     (fallback a primitivas si falla).
   - Reproducción walk/idle por instancia con `_attachAnims` generalizado
     (antes `_attachSheepAnims`): clona esqueleto + grupos por vaca;
     `update()` alterna walk/idle como la oveja. La vaca NO lleva el medio
     giro en Y: su fichero mira hacia -x y el cargador lo deja en +x
     (igual que la gallina); solo la oveja (fichero +x) lo necesita.
4. **Verificación**:
   - `pnpm verify` (format:check + lint + typecheck + test).
   - En local (`pnpm dev` + `agent-browser`): partida con 2 vacas vía save
     en localStorage; consola sin errores; capturas del redil; las dos
     vacas con poses independientes (una andando, otra quieta);
     `/models/vaca.glb` responde 200; las vacas miran en dirección de
     marcha (cabeza al frente, no andan de espaldas).

## Hallazgo de orientación (importante)

El modelo Hunyuan mira hacia -Y de Blender tras importar; el `-90° Z` de la
skill lo llevaría a -X, no a +X. Se detectó por textura (ojos en x≈-0.46) y
se fijó el rig con rot +90° Z (frente +Y de diseño → -X de fichero). El
primer rig quedó espejado (cabeza/cola y patas Del/Tras intercambiadas) y se
rehízo. Lección: ante un fichero simétrico, verificar el lado de la cabeza
por textura, no por cotas.

## Criterios de aceptación

- Las vacas del redil usan el modelo GLB, no cajas.
- Sin GLB (p. ej. 404), se ven las primitivas de siempre.
- `pnpm verify` en verde.
