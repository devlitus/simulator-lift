# 0001 — Separar lógica de juego (dominio puro) de las vistas Babylon

**Estado:** Aceptada

## Contexto

El simulador crecerá con más sistemas (cultivos, NPCs, misiones, economía) y potencialmente más colaboradores. Si las reglas de negocio (cuándo madura un cultivo, cuánto sube la amistad, cuándo se completa una misión) viven mezcladas con la creación de meshes de Babylon, no se pueden probar sin arrancar un motor 3D, y cualquier cambio de renderizado arriesga romper una regla de juego sin que se note.

## Decisión

Cada sistema con reglas de negocio se divide en dos archivos dentro de su carpeta de dominio:

- **Lógica** (p. ej. `src/crops/farmLogic.js`, `src/economy/economy.js`, `src/npcs/friendship.js`, `src/quests/questSystem.js`): clases planas que solo mutan `GameState` y emiten eventos. No importan `BABYLON` ni conocen la escena.
- **Vista** (p. ej. `src/crops/farmView.js`, `src/npcs/npcView.js`, `src/world/worldView.js`): crea y actualiza meshes a partir del estado que expone la lógica, y traduce input del jugador en llamadas a la lógica.

`PlayerView` y `WorldView` no tienen una contraparte de lógica separada porque no encapsulan reglas de negocio propias (solo física/movimiento y ciclo día-noche).

## Alternativas consideradas

- **Todo en una clase por sistema** (como en la v1, `legacy/js/crops.js`): más rápido de escribir al principio, pero cada cambio visual obliga a tocar el mismo archivo que las reglas de crecimiento, y no hay forma de testear "¿madura un cultivo tras 2 días regado?" sin Babylon cargado.
- **Entity Component System (ECS) genérico**: encaja bien en juegos con muchas entidades homogéneas e interacciones cruzadas complejas. Aquí hay pocos tipos de entidad (parcela, NPC, jugador) con reglas muy distintas entre sí; un ECS añadiría una capa de indirección (componentes, sistemas, queries) sin beneficio claro para este alcance. Se descarta por sobre-ingeniería.

## Consecuencias

- La lógica de dominio se puede probar con Vitest en Node, sin DOM ni WebGL (ver [0006](0006-vitest-para-tests-de-dominio.md)).
- Las vistas quedan "tontas": solo leen `status()`/estado y disparan acciones; no duplican reglas.
- Costo: por cada sistema con reglas hay dos archivos en vez de uno, y las vistas necesitan conocer la forma del estado de dominio (mitigado con JSDoc, ver [0003](0003-javascript-con-jsdoc-en-vez-de-typescript.md)).
