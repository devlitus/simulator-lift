# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Simulador de vida tipo pueblo en 3D (estilo Stardew Valley) con Babylon.js: granja, NPCs con amistad, misiones y economía. **TypeScript estricto + Vite** (ADR 0008/0009); el gestor de paquetes es **pnpm**. Babylon.js 9.17.0 y Cannon.js están vendorizados en `public/vendor/` como scripts UMD (globales `BABYLON` y `CANNON`, declarados como `any` en `src/global.d.ts`) — Vite los copia tal cual sin empaquetarlos. El despliegue objetivo es Vercel (detecta Vite y publica `dist/`).

El idioma del proyecto es el español: comentarios, docs y textos de juego se escriben en español.

## Comandos

```bash
pnpm dev           # dev-server de Vite con HMR en http://localhost:5173
pnpm build         # build de producción en dist/
pnpm preview       # sirve dist/ en local
pnpm test          # tests de dominio con Vitest
pnpm vitest run src/crops/farmLogic.test.ts   # un solo archivo de test
pnpm lint          # ESLint (flat config + typescript-eslint, reglas mínimas)
pnpm typecheck     # tsc --noEmit (strict) sobre src/ y data/
pnpm format        # Prettier
```

## Arquitectura

Regla central (ADR 0001): **la lógica de dominio no importa BABYLON nunca**. `farmLogic.ts`, `economy.ts`, `friendship.ts` y `questSystem.ts` son clases puras que operan sobre el estado y el bus, y son lo único que se testea con Vitest (tests colocados como `*.test.ts` junto al código). Los archivos `*View.ts` (farmView, npcView, playerView, worldView) contienen los meshes de Babylon y no llevan reglas de juego; se verifican a mano en el navegador (ADR 0006). Los objetos de Babylon se tipan como `any` (UMD sin tipos).

Comunicación entre sistemas: `EventBus` (Observer) **tipado** — el mapa `EventPayloads` de `src/core/events.ts` asocia cada evento de `EVENTS` a su payload (ADR 0002). Los sistemas de dominio emiten eventos; vistas y UI se suscriben. El estado central (`GameState`, un objeto plano mutable) se define y construye en `src/core/store.ts` y se pasa por referencia a todos los sistemas; se descartó Zustand por no aportar sobre este patrón (ADR 0009).

`src/main.ts` es el único punto de wiring: crea motor/escena, instancia dominio + vistas + UI, gestiona input de teclado, cámara isométrica y el game loop. No contiene reglas de juego. El guardado va por `SaveRepository` (localStorage) en `src/core/save.ts`, con autoguardado en cada `DAY_NEW`; los saves se validan con `SaveSchema` (Zod) al cargar y un save corrupto se rechaza entero.

Organización por dominio, no por tipo de archivo (ADR 0005): cada carpeta de `src/` salvo `core/` y `ui/` es un sistema del juego con su lógica pura y su vista juntas.

## Contenido vs. código

Todo el contenido y balance del juego vive en `data/` como datos (ADR 0004): cultivos (`crops.ts`), NPCs con diálogos por nivel de amistad (`npcs.ts`), misiones (`quests.ts`), regalos, balance inicial, dimensiones de la parcela. Los esquemas Zod de todo ese contenido están en `data/schemas.ts`; los tipos (`CropDef`, `NpcDef`, `QuestDef`…) se derivan con `z.infer` y cada archivo de datos valida su contenido con `.parse()` al cargarse (falla en el arranque si el dato está mal). Para añadir un cultivo/NPC/misión/regalo se edita solo `data/` — los sistemas los recogen automáticamente. Los tipos de misión soportados son `talkAll`, `deliver` y `harvest`. Constantes técnicas del motor (velocidades, radios de interacción) van en `src/core/constants.ts`, no en `data/`.

## Convenciones

- Las decisiones de arquitectura se registran como ADR en `docs/adr/`; si cambias algo estructural, añade o actualiza un ADR.
- TypeScript `strict`; los tipos de contenido salen de los esquemas Zod (una sola fuente de verdad).
- `public/` y `dist/` están fuera de lint/format.
- `assets/` está reservado para modelos/texturas futuros (vacío en v1).
