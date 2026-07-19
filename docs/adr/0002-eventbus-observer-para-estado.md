# 0002 — EventBus (Observer) como mecanismo de estado/comunicación entre sistemas

**Estado:** Aceptada

## Contexto

Con la lógica dividida en varios sistemas de dominio independientes (granja, economía, amistad, misiones), alguien tiene que coordinarlos: cuando se cosecha algo, las misiones de tipo `harvest` deben enterarse; cuando cambia el dinero o el inventario, la UI debe refrescarse; cuando se completa una misión con recompensa de amistad, `Friendship` debe recibir el aviso. Sin un mecanismo explícito, esa coordinación tiende a acumularse como llamadas directas cableadas a mano en el punto de entrada (así estaba en la v1: `main.js` pasaba callbacks `notify`/`addFriend` a cada sistema).

## Decisión

Un `EventBus` (`src/core/events.js`) plano con `on/off/emit`, y un catálogo cerrado de eventos con nombre y forma de payload documentados (`EVENTS`). Los sistemas de dominio **emiten** el evento correspondiente al cambio que produjeron (`FARM_HARVESTED`, `MONEY_CHANGED`, `FRIENDSHIP_CHANGED`, etc.) y **se suscriben** a los eventos de otros sistemas que les interesan, sin importarse entre sí directamente. `QuestSystem`, por ejemplo, no importa `FarmLogic`; solo escucha `FARM_HARVESTED`.

El estado en sí (`GameState`, `src/core/store.js`) es un objeto plano mutable compartido por referencia — no hay un store inmutable con reducers. Los sistemas lo mutan directamente y el bus solo lleva la *notificación* de que algo cambió, no el estado mismo.

## Alternativas consideradas

- **Redux/store inmutable con reducers**: da trazabilidad total (time-travel, undo) a costa de boilerplate (actions, reducers, selectors) que no aporta nada a un juego de un jugador sin necesidad de deshacer acciones. Se descarta por complejidad injustificada para el alcance actual.
- **Callbacks cableados a mano** (enfoque de la v1): funciona con 3-4 sistemas, pero cada sistema nuevo obliga a tocar el wiring de todos los que necesiten enterarse de él; no escala con más colaboradores tocando `main.js` a la vez.
- **ECS con eventos por componente**: mismo argumento que en [0001](0001-dominio-desacoplado-de-babylon.md): añade indirección sin necesidad real aquí.

## Consecuencias

- Añadir un sistema nuevo que reacciona a algo existente (p. ej. un futuro sistema de animales que suba de "felicidad" al cosechar) solo requiere suscribirse a `FARM_HARVESTED`; no hay que tocar `FarmLogic`.
- El catálogo `EVENTS` en `core/events.js` es la documentación viva de qué eventos existen y qué payload llevan — debe mantenerse al día al añadir uno nuevo.
- Riesgo conocido: al ser un bus global sin tipado de payload en tiempo de ejecución, un emit con la forma de payload equivocada solo se nota al probarlo (mitigado parcialmente con JSDoc en los comentarios de `EVENTS` y en los `emit`/`on` de cada sistema).
