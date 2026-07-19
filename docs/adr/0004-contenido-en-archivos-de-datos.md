# 0004 — Contenido de juego en archivos de datos (`data/`) separados de la lógica

**Estado:** Aceptada

## Contexto

arquitectura.md exige que añadir contenido (un cultivo, un NPC, una misión) no requiera modificar el código de los sistemas, sino solo editar datos. En la v1 (`legacy/js/config.js`) esto ya apuntaba en esa dirección pero mezclaba balance de juego con constantes técnicas del motor en un mismo archivo.

## Decisión

Todo el contenido y balance de juego vive en `data/*.js`, uno por dominio: `crops.js`, `npcs.js`, `quests.js`, `gifts.js`, `friendship.js` (niveles y puntos), `farm.js` (dimensiones de la parcela y marchitez), `balance.js` (economía inicial). Los sistemas de dominio y sus vistas reciben estos objetos por constructor; ninguno tiene un cultivo, NPC o misión hardcodeado en su lógica. Las constantes puramente técnicas del motor (velocidad del jugador, radio de interacción, duración del día en segundos reales) quedan aparte, en `src/core/constants.js`, para no mezclarlas con balance editable por diseño.

Ejemplo concreto — añadir una "sandía" nueva: basta con una entrada en `data/crops.js`:

```js
sandia: { name: 'Sandía', icon: '🍉', seedPrice: 30, sellPrice: 90, daysToGrow: 5, color: '#3a9d4f' },
```

`FarmLogic` la acepta automáticamente (itera `Object.keys(cropsData)`), la tienda la lista sola (`GameUI.renderShop` itera `this.crops`), el inventario la muestra sola, y `FarmView` genera su mesh con el color indicado sin tocar código. No hace falta editar ningún archivo de `src/`.

## Alternativas consideradas

- **JSON en vez de módulos `.js`**: es el formato "de datos" más neutral y no permite ejecutar código, pero obliga a cargarlo con `fetch` (asíncrono, y falla con `file://` igual que los módulos ES) o con un bundler que lo importe; además no admite comentarios, que aquí se usan para explicar el balance (p. ej. por qué `WILT_DAYS = 2`). Los `.js` de datos son estáticamente analizables por el mismo `tsc --checkJs` (ver [0003](0003-javascript-con-jsdoc-en-vez-de-typescript.md)), lo que JSON no ofrece sin un paso extra.
- **Editor visual / archivo de configuración externo (YAML, hoja de cálculo)**: útil si hay diseñadores no técnicos en el equipo; para el alcance y equipo actual (potencialmente un solo desarrollador o pocos colaboradores técnicos) es una capa de indirección sin usuario que la necesite todavía.

## Consecuencias

- Añadir contenido es una operación de una sola carpeta (`data/`), documentada en el README bajo "Cómo añadir contenido nuevo".
- Los datos siguen siendo código JS: un error de sintaxis en `data/crops.js` rompe la carga como cualquier otro módulo (aceptable: se detecta de inmediato al abrir el juego, y `tsc --checkJs` ya valida su forma antes de eso).
