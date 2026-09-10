# Plan: modelos 3D para los animales

Rama: `feature/modelo-3d-animales`. Primera tanda: solo la **gallina** (prueba
de pipeline); oveja y vaca se harán después con el mismo proceso si el
resultado se valida.

## Pipeline (mismo que el granjero)

1. **Imagen de referencia** con ComfyUI (Z-Image Turbo, local): gallina de
   dibujos 3D estilo chibi, coherente con `assets/granjero_00001_.png`
   (personaje completo, fondo neutro oscuro, colores planos).
2. **Malla 3D** con ComfyUI (Hunyuan3D 2.0, local): image→3D produce un `.glb`
   sin texturizar (equivalente a `granjero_original.glb`).
3. **Acabado en Blender** (headless, script): texturizar con materiales de
   colores planos, escalar al tamaño de juego (~0.5 unidades de alto, origen
   en los pies, mirando hacia +x como asume `animalView.update`), exportar
   `assets/models/gallina.glb` y copiarlo a `public/models/`.
4. **Carga en el juego**: `src/animals/animalView.ts` carga
   `/models/gallina.glb` con `SceneLoader.ImportMeshAsync`; si falla, se
   quedan las primitivas actuales (misma convención que `playerView`).
5. **Verificación**: `pnpm verify` + comprobación manual en el navegador.

## Convenciones que respetar

- `assets/README.md`: fuentes en `assets/models/`, copia servida en
  `public/models/`, siempre con fallback a primitivas.
- Los colores del modelo deben respetar el `color` de `data/animals.ts`
  (gallina `#f2eee0`) para coherencia con el resto de la UI.
- Sin cambios en lógica de dominio: solo vista.
