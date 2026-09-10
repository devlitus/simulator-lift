# Plan: modelos 3D para los animales

Rama: `feature/modelo-3d-animales`. Primera tanda: solo la **gallina** (prueba
de pipeline); oveja y vaca se harán después con el mismo proceso si el
resultado se valida.

## Decisión (v2)

Tras una primera iteración con el pipeline IA (Z-Image Turbo → Hunyuan3D 2.0 →
Blender), se descartó el resultado generado y se optó por un **asset
descargado**: [Chicken de Quaternius](https://poly.pizza/m/ineV9pU5VL)
(**CC0**, ~1.6k vértices, con animaciones idle/walk/run/jump integradas).
Ventaja adicional: el mismo autor tiene el *Farm Animal Pack* con oveja, vaca,
cerdo… en el mismo estilo, para las especies futuras.

## Pipeline final

1. **Descarga** del GLB desde poly.pizza.
2. **Acabado en Blender** (headless): eliminar malla residual, materiales en
   mate (roughness 0.9), orientación hacia +x con los pies en y=0, exportar a
   `assets/models/gallina.glb` con animaciones y copiar a `public/models/`.
   Nota: los transform de nodos envoltorio no afectan a mallas esqueletizadas
   en Babylon; la orientación/escala se verifica SIEMPRE en Babylon (página de
   test o el propio juego), no solo con renders de Blender.
3. **Carga en el juego**: `src/animals/animalView.ts` carga
   `/models/gallina.glb` con `SceneLoader.ImportMeshAsync` (una descarga por
   especie; cada animal es una instancia de la jerarquía); si falla, se quedan
   las primitivas actuales (misma convención que `playerView`).
4. **Verificación**: `pnpm verify` + comprobación manual en el navegador.

## Convenciones que respetar

- `assets/README.md`: fuentes en `assets/models/`, copia servida en
  `public/models/`, siempre con fallback a primitivas.
- Sin cambios en lógica de dominio: solo vista.
