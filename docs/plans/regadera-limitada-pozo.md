# Plan: Regadera con agua limitada y recarga en el pozo

Rama: `feature/regadera-limitada-pozo`.

## Objetivo

Hoy la regadera tiene agua infinita. Pasa a tener capacidad para **5 riegos**:
cada riego gasta uno y, cuando se vacía, el granjero tiene que ir al **pozo**
junto a la parcela y pulsar E para llenarla de nuevo.

## Pasos

1. **Dato**: `WATERING_CAN_CAPACITY = 5` en `data/farm.ts` (balance, junto a
   `WILT_DAYS`).
2. **Estado**: `GameState.water` (riegos que quedan), arranca lleno en
   `createInitialState`; se guarda y carga en `save.ts` (campo opcional para
   que los saves antiguos sigan valiendo).
3. **Dominio (`FarmLogic`)**: `water()` rechaza si `state.water === 0` y avisa
   de ir al pozo; si riega, resta 1. Nuevo `refillWater()`: llena hasta la
   capacidad (devuelve false si ya estaba llena). Ambos emiten
   `INVENTORY_CHANGED` para refrescar el HUD.
4. **Vista**: `WorldView.well` con la posición del pozo; en `main.ts` una
   interacción "E: Llenar la regadera en el pozo". En `FarmView`, un surco
   sin regar con la regadera vacía muestra "Regadera vacía — llénala en el
   pozo" sin acción.
5. **UI**: el inventario muestra `💧 x/5` (en gris si está vacía); la ayuda
   explica el pozo.
6. **Tests**: unitarios de `FarmLogic` (gasta, bloquea a 0, recarga), save, y
   los escenarios recargan en el pozo cuando hace falta; el fuzz incluye la
   acción `refillWater` y el invariante `0 ≤ water ≤ capacidad`.

## Ampliación: pozo junto a la parcela y animación del cubo

7. **Pozo**: se mueve a `(3.7, 10.3)`, al sur de la parcela. Al elegir la
   interacción, las que tienen acción ganan a los avisos sin acción, para
   que "llenar la regadera" no quede tapada por un surco cercano.
8. **Tecla P, desde la manivela**: la recarga se hace con P y solo desde el
   lado de la manivela (`WorldView.wellCrank`); desde otro lado la pista
   indica que hay que ir allí. E sigue para el resto; `Interaction.key`
   indica la tecla de cada interacción.
9. **Animación (`src/world/wellView.ts`, ~2,1 s)**: el cubo baja al fondo
   con la cuerda estirándose y la manivela girando, y vuelve a subir. Al
   llegar arriba `main.ts` llama a `FarmLogic.refillWater()`, así que el
   agua se suma entonces, no al pulsar. El granjero espera quieto mirando
   el pozo. Sin el GLB del pozo se llena al momento.
10. **Modelo**: `assets/pozo/generar.py` cuelga el cubo de la cuerda y
    exporta cubo, cuerda y manivela como mallas sueltas (ver
    `assets/pozo/README.md`).
