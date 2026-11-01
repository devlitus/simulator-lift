# Plan: Tomás 3D en el juego

Rama: `feature/tomas-3d`. Tomás era el único vecino que seguía con las
primitivas de colores (cilindro, esfera y caja de sombrero).

## Decisión

Modelado **procedural en Blender** por script (como la casa del granjero y
la regadera), no Hunyuan3D: así es reproducible, ligero y de colores planos
coherentes con las tiendas del mercado. Sin rig: Tomás no patrulla
(`waypoints: null`), se queda tras el mostrador del rancho.

## Pasos

1. `assets/tomas/generar.py`: personaje chibi (sombrero de paja, bigote,
   camisa roja, peto vaquero, botas), cara hacia +Y, pies en z=0. Guarda
   `assets/tomas.blend`, exporta `assets/models/tomas.glb` y la copia en
   `public/models/tomas.glb`, métricas y preview.
2. `src/npcs/npcView.ts`: cargar `tomas.glb` con `_loadNpcModel`, con las
   primitivas como respaldo.
3. Documentar en `assets/README.md` y `assets/tomas/README.md`.

## Criterios de aceptación

- `/models/tomas.glb` responde 200 y Tomás usa el modelo, no las primitivas.
- Tras el mostrador mira hacia el cliente (+Z en Babylon).
- `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
