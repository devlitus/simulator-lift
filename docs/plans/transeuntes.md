# Plan: transeúntes por el pueblo

Rama: `feature/transeuntes`. Diez vecinos de ambiente que pasean por los
caminos para que el pueblo se vea vivo.

## Decisiones

- **Separados de los NPC de amistad**: no entran en `data/npcs.ts`, así no
  cuentan para la amistad, el guardado ni la misión `talkAll`. Solo saludan
  (E) con una frase de las suyas, rotando.
- **Todos distintos**: piel, camisa, pantalón, pelo, tocado (sombrero, gorra,
  pañuelo, moño o nada), altura, complexión, velocidad y pausa propias.
- **Modelos propios con rig**: una referencia por personaje en ComfyUI
  (Z-Image-Turbo) y modelado chibi por script en Blender, con walk/idle
  (`assets/transeuntes/`). Mientras carga el GLB, o si falla, queda un muñeco
  de primitivas articulado.
- **Rutas como circuitos cerrados** sobre los caminos, cada sentido por su
  lado. Se paran un rato en cada punto y también si el jugador se les pone
  delante (y le miran), como mucho 2 s: si no se aparta, siguen.

## Pasos

1. `data/schemas.ts`: `VillagerSchema`. `data/villagers.ts`: los diez.
2. `src/npcs/villagerRoute.ts` (puro): avance por la ruta, pausas y ceder el
   paso. Tests en `villagerRoute.test.ts`, incluido que toda ruta vaya por
   los caminos.
3. `assets/transeuntes/`: referencias de ComfyUI y `generar.py` (Blender):
   diez GLB con rig y animaciones en `public/models/transeunte_<id>.glb`.
4. `src/npcs/villagerView.ts`: carga los GLB (walk/idle con la cadencia
   ajustada a la velocidad), muñecos de respaldo e interacción.
5. `src/main.ts`: instancia, `update` en el bucle y candidato de interacción.
