# Plan: oveja 3D animada en el juego

Rama: `feature/oveja-3d` (ya creada). Continúa `docs/plans/modelo-3d-animales.md (pipeline
gallina) para la oveja, con modelo propio riggeado en Blender.

## Lección del plan anterior (importante)

> Los transforms de nodos envoltorio no afectan a mallas esqueletizadas en
> Babylon; la orientación/escala se verifica SIEMPRE en Babylon, no solo con
> renders de Blender.

Por eso el GLB final lleva la orientación (+X) y escala (0.65) **horneadas**
en vértices y huesos, sin vacío `OvejaRoot`.

## Pasos

1. **Re-exportar** `assets/oveja_anim.glb` con transforms horneados
   (`~/blender-mcp/oveja/rig_walk.py` v2: malla y huesos ya en espacio final,
   sin wrapper). Misma animación walk (25 f) + idle (49 f), pistas NLA.
2. **Publicar**: copiar a `public/models/oveja.glb`. Documentar en
   `assets/README.md`.
3. **Vista** (`src/animals/animalView.ts`, sin tocar dominio):
   - `buildSheep()` carga `/models/oveja.glb` con el mismo `loadModel` que la
     gallina (fallback a primitivas si falla).
   - Reproducción walk/idle por instancia: clonar esqueleto + grupos de
     animación del template sobre cada clon; `update()` alterna walk (moviendo)
     / idle (en pausa), como `playerView._animar`.
   - Al eliminar un animal, liberar grupos y esqueleto clonados.
4. **Verificación**:
   - `pnpm verify` (format:check + lint + typecheck + test).
   - En local (`pnpm dev` + `agent-browser`): partida sembrada con 2 ovejas vía
     save en localStorage; consola sin errores; capturas del redil; las dos
     ovejas con poses independientes (una andando, otra quieta); `/models/oveja.glb`
     responde 200.

## Lección: el cargador glTF gira 180° en Y

El `__root__` importado trae `rotationQuaternion = 180° Y` (conversión
diestro→zurdo del cargador): todo GLB mira hacia -x en el juego aunque el
fichero esté bien (+x verificado en el JSON del GLB). Además, con cuaternio
presente `rotation` (euler) se ignora. La oveja lo compensa componiendo otro
medio giro en el propio `rotationQuaternion` (`_attachSheepAnims`). La
gallina y el granjero probablemente miran también a -x: revisar al animarlos.

## Criterios de aceptación

- Las ovejas del redil usan el modelo GLB (lana, cabeza, patas), no esferas.
- Se mueven con ciclo walk y paran en idle sin errores en consola.
- Con 2+ ovejas, cada una anima según su estado (no sincronizadas a la fuerza).
- Sin GLB (p. ej. 404), se ven las primitivas de siempre.
- `pnpm verify` en verde.
