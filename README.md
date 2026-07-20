# Pueblo 3D — Simulador de vida (Babylon.js)

Simulador de vida tipo pueblo en 3D inspirado en Stardew Valley: granja con cultivos y riego, recinto con animales (compra, pienso y productos diarios), relaciones con NPCs, misiones y economía. Todo construido con primitivas de Babylon.js (cajas, cilindros, esferas), sin modelos externos.

La arquitectura del proyecto (separación dominio/vista, EventBus, contenido en datos, tipado, testing) está descrita y justificada en [`arquitectura.md`](arquitectura.md) y en las decisiones registradas en [`docs/adr/`](docs/adr/).

## Cómo ejecutarlo

El proyecto usa **pnpm** y **Vite** (ver [ADR 0008](docs/adr/0008-vite-como-bundler-y-despliegue-en-vercel.md)):

```bash
pnpm install
pnpm dev        # dev-server con HMR en http://localhost:5173
pnpm build      # build de producción en dist/
pnpm preview    # sirve el build de producción en local
```

**No hace falta internet en runtime**: Babylon.js 9.17.0 y Cannon.js 0.6.2 están vendorizados en `public/vendor/` (verificados contra el CDN oficial) y Vite los copia tal cual a `dist/`. El despliegue está pensado para Vercel, que detecta Vite y publica `dist/` automáticamente.

## Controles

- **WASD / Flechas** — moverse
- **E** — interactuar (plantar / regar / cosechar / alimentar / hablar / vender)
- **1 / 2 / 3** — elegir semilla
- **H** — ayuda · **Esc** — cerrar ventanas

## Estructura de carpetas

```
index.html            # canvas + HUD (DOM) + carga de src/main.ts
css/style.css         # estilos del HUD, diálogos, tienda, notificaciones
public/vendor/         # babylon.js 9.17.0 y cannon.js 0.6.2 (UMD locales, sin CDN)

data/                  # CONTENIDO Y BALANCE DE JUEGO — editar aquí, no en src/
  schemas.ts             esquemas Zod de todo el contenido (los tipos salen de aquí)
  balance.ts             dinero, semillas, pienso y animales iniciales
  animals.ts             especies de animales (precio, producto, color), pienso y recinto (PEN)
  crops.ts               tipos de cultivo (precio, tiempo de crecimiento, color...)
  farm.ts                dimensiones de la parcela + días de marchitez
  friendship.ts          niveles de amistad y puntos por conversación
  gifts.ts               regalos comprables
  npcs.ts                NPCs: identidad, posición/ruta, diálogos por nivel
  quests.ts              misiones

src/
  core/                 infraestructura transversal (no es un dominio de juego)
    constants.ts           constantes técnicas del motor (velocidad, radios...)
    events.ts               EventBus tipado + catálogo EVENTS (patrón Observer)
    store.ts                 forma y construcción del estado central (GameState)
    save.ts                  serialización + validación Zod + SaveRepository (localStorage)
    types.ts                 tipos transversales (Interaction, DialogButton)
  animals/               dominio de animales de granja
    animalLogic.ts          reglas puras: comprar/alimentar/producir cada día
    animalView.ts            meshes y paseo por el recinto (Babylon), sin reglas propias
  crops/                 dominio de cultivos
    farmLogic.ts            reglas puras: plantar/regar/crecer/marchitar/cosechar
    farmView.ts              meshes de la parcela (Babylon), sin reglas propias
  economy/
    economy.ts               compras (semillas, regalos, pienso), venta de cosecha y productos
  npcs/                  dominio de vecinos y relaciones
    friendship.ts            puntos y niveles de amistad
    npcView.ts                meshes, patrulla por waypoints, diálogo
  player/
    playerView.ts             avatar, física, movimiento (sin reglas de negocio)
  quests/
    questSystem.ts            máquina de estados de misión y recompensas
  world/
    worldView.ts               terreno, edificios, colisiones, ciclo día/noche
  ui/
    ui.ts                     HUD, diálogos, tienda, ayuda (reactivo a EventBus)
  main.ts                punto de entrada: wiring de todo lo anterior + game loop

assets/                # reservado para modelos/texturas/audio futuros (vacío en v1)
docs/adr/              # decisiones de arquitectura (formato ADR)
```

**Criterio de organización:** por dominio, no por tipo de archivo. Cada carpeta de `src/` (salvo `core/` y `ui/`) es un sistema del juego y agrupa su lógica pura junto a su vista Babylon — ver [ADR 0005](docs/adr/0005-estructura-de-carpetas-por-dominio.md). La lógica de dominio (`farmLogic.ts`, `animalLogic.ts`, `economy.ts`, `friendship.ts`, `questSystem.ts`) no importa `BABYLON` en ningún momento y se puede probar sin abrir un navegador — ver [ADR 0001](docs/adr/0001-dominio-desacoplado-de-babylon.md).

## Cómo añadir contenido nuevo

Todo el contenido vive en `data/` como datos, no como código (ver [ADR 0004](docs/adr/0004-contenido-en-archivos-de-datos.md)):

- **Un cultivo nuevo:** añade una entrada a `data/crops.ts` (nombre, icono, precios, días para crecer, color). La tienda, el inventario, la granja y el guardado lo recogen automáticamente.
- **Un animal nuevo:** añade una entrada a `data/animals.ts` (precio, producto que deja alimentado, color). La tienda, el recinto y el guardado lo recogen automáticamente. Especies nuevas sin fábrica propia en `animalView.ts` se dibujan como gallinas; añade un builder si quieres otro aspecto.
- **Un NPC nuevo:** añade una entrada a `NPC_DEFS` en `data/npcs.ts` (posición, ruta de waypoints opcional, diálogos por nivel de amistad, si tiene tienda). `NPCSystemView` lo crea solo.
- **Una misión nueva:** añade un objeto a `QUEST_DEFS` en `data/quests.ts`. Tipos soportados hoy: `talkAll` (hablar con N NPCs), `deliver` (entregar X de un ítem a un NPC), `harvest` (cosechar X y volver con un NPC).
- **Un regalo nuevo:** añade una entrada a `data/gifts.ts` (precio y puntos de amistad que otorga).
- **Estaciones, etc.:** el punto de enganche para lógica diaria es `bus.on(EVENTS.DAY_NEW, ...)` en `src/main.ts`.

## Calidad de código

```bash
pnpm test          # tests unitarios de dominio (Vitest)
pnpm lint          # ESLint (typescript-eslint)
pnpm format        # Prettier (aplica formato)
pnpm typecheck     # tsc --noEmit (strict) sobre src/ y data/
```

Ver [ADR 0009](docs/adr/0009-migracion-a-typescript-con-zod.md) (TypeScript + Zod: los tipos de contenido se derivan de esquemas y el contenido/guardado se valida en runtime) y [ADR 0006](docs/adr/0006-vitest-para-tests-de-dominio.md) (qué se prueba y qué se verifica a mano).

## Decisiones técnicas

- **Motor**: Babylon.js 9.17.0 (build UMD local en `public/vendor/babylon.js`).
- **Física**: Cannon.js vía `CannonJSPlugin` (API V1 de Babylon) — ver [ADR 0007](docs/adr/0007-cannon-js-para-fisica.md).
- **Cámara**: isométrica fija con seguimiento suave (`FreeCamera` con offset fijo, sin input de ratón). Encaja con el género: vista clara de la granja y del pueblo, controles simples y sin mareo.
- **Estado/comunicación entre sistemas**: EventBus (Observer) — ver [ADR 0002](docs/adr/0002-eventbus-observer-para-estado.md).
- **Guardado**: `localStorage` vía `SaveRepository` (`src/core/save.ts`), autoguardado cada día nuevo; el save se valida con Zod al cargar.

## Simplificaciones conscientes (v1)

- Sin animaciones esqueléticas: los personajes son primitivas que se trasladan/rotan (una animación completa requeriría modelos externos y rigging — ver `assets/README.md`).
- La interacción es contextual con una sola tecla (E): no hay cambio de herramienta ni regadera con recarga.
- Los NPCs no tienen colisión física (patrullan por waypoints y el jugador los atraviesa); los animales tampoco (pasean por el recinto y el jugador los atraviesa).
- El día avanza solo; no hay cama para dormir.

## Posibles mejoras futuras

1. Estaciones del año que cambien colores del mundo y qué cultivos crecen.
2. ~~Animales (gallinas/vacas) con productos diarios~~ — hecho (`data/animals.ts` + `src/animals/`).
3. Modelos `.glb` con animaciones (ver convención propuesta en `assets/README.md`).
4. Más NPCs con horarios completos y gustos de regalo individuales.
5. Persistencia en la nube / multijugador ligero con WebSockets.
6. ~~Migración a TypeScript real + Vite~~ — hecho (ver [ADR 0008](docs/adr/0008-vite-como-bundler-y-despliegue-en-vercel.md) y [ADR 0009](docs/adr/0009-migracion-a-typescript-con-zod.md)).
7. Importar Babylon desde npm (`@babylonjs/core`) para tener tipos reales y tree-shaking.
