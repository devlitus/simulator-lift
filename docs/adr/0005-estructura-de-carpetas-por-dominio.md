# 0005 — Estructura de carpetas por dominio, no por tipo de archivo

**Estado:** Aceptada

## Contexto

Hay dos formas habituales de organizar un frontend/juego mediano: por **tipo técnico** (`/models`, `/views`, `/controllers`) o por **dominio** (`/crops`, `/npcs`, `/quests`). El proyecto empezó a migrar hacia una carpeta `src/domain/` (lógica de todos los sistemas) separada de carpetas por dominio para las vistas (`src/crops/`, `src/npcs/`...) — una mezcla inconsistente de ambos criterios que dificultaba saber dónde buscar algo.

## Decisión

Organizar `src/` por dominio: cada carpeta es un sistema del juego (`crops/`, `npcs/`, `quests/`, `economy/`, `player/`, `world/`, `ui/`) y contiene tanto su lógica pura como su vista Babylon cuando ambas existen (p. ej. `src/crops/farmLogic.js` + `src/crops/farmView.js`). `src/core/` es la excepción explícita: infraestructura transversal (EventBus, estado central, guardado, constantes técnicas) que no pertenece a ningún dominio de juego y es usada por todos.

Al trabajar en "cómo se calcula el precio de venta" o "qué pasa cuando se completa una misión", todo lo relevante está en una sola carpeta (`economy/`, `quests/`), en vez de saltar entre `domain/` y una carpeta de vista con el mismo nombre de sistema pero en otro lugar del árbol.

## Alternativas consideradas

- **Por tipo de archivo** (`/logic`, `/views`, `/data`): es el criterio que se estaba mezclando a medias. Escala mal: con 6+ sistemas, cada carpeta de tipo acumula archivos de dominios no relacionados entre sí, y un cambio de feature (p. ej. "misiones") toca dos carpetas lejanas en el árbol en vez de una.
- **Mantener `domain/` separado de las vistas** (estado intermedio real del repo antes de esta decisión): evita que un archivo de dominio "sepa" en qué carpeta vive su vista, pero en la práctica el acoplamiento conceptual ya existe (`FarmLogic` y `FarmView` siempre cambian juntos); separar sus carpetas no reducía el acoplamiento, solo la localidad.

## Consecuencias

- Un colaborador nuevo que vaya a "añadir animales" sabe que crea `src/animals/` con su lógica y su vista, siguiendo el patrón de `src/crops/`.
- `src/core/` debe mantenerse deliberadamente pequeño: si algo que hoy vive ahí empieza a tener reglas de un dominio específico, debe moverse a su carpeta de dominio.
