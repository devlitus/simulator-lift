# 0009 — Migración a TypeScript con esquemas Zod para el contenido

**Estado:** Aceptada · Sustituye a [0003](0003-javascript-con-jsdoc-en-vez-de-typescript.md)

## Contexto

El ADR 0003 optó por JavaScript + JSDoc para no introducir un paso de build. Con Vite ya adoptado ([0008](0008-vite-como-bundler-y-despliegue-en-vercel.md)) ese costo desaparece, y el propio ADR 0003 dejaba trazado el camino de migración. Además, el contenido de `data/` y el guardado de `localStorage` solo se comprobaban en tiempo de desarrollo: un save corrupto o un dato mal escrito fallaba en mitad de la partida.

## Decisión

1. **Todo `src/` y `data/` pasa a `.ts`** con `strict: true`. Los `@typedef` de JSDoc se convirtieron en `interface`/`type` reales (`GameState`, `TileCrop`, `Quest`, los sub-estados `FarmState`/`EconomyState`/`FriendshipState`/`QuestState`, etc.).
2. **Zod como fuente de verdad de los tipos de contenido**: `data/schemas.ts` define los esquemas (`CropSchema`, `NpcSchema`, `QuestSchema`, `GiftSchema`, `BalanceSchema`, `FarmConfigSchema`, `FriendshipLevelSchema`) y los tipos se derivan con `z.infer`. Cada archivo de `data/` valida su contenido con `.parse()` al cargarse: un dato mal formado revienta en el arranque con un error claro.
3. **El guardado también se valida**: `src/core/save.ts` define `SaveSchema` (campos opcionales, porque `applySave` siempre toleró saves parciales) y `applySave` hace `safeParse` — un save corrupto de localStorage se rechaza entero y el juego arranca con partida nueva.
4. El `EventBus` ahora es **tipado**: `EventPayloads` en `src/core/events.ts` mapea cada evento a su payload; emitir o suscribirse con el tipo equivocado es error de compilación.
5. Babylon/Cannon siguen siendo globales UMD sin tipos (`any` declarado en `src/global.d.ts`); las vistas los usan como `any` y ESLint tiene `no-explicit-any` desactivado por ese motivo.

La regla del ADR 0001 se mantiene intacta: el dominio no importa BABYLON. Los imports del dominio hacia `data/schemas.ts` son type-only o de esquemas puros (Zod no arrastra runtime del motor).

## Alternativas consideradas

- **Seguir con JSDoc**: funcionaba, pero sin build ya no había nada que justificara el peor autocompletado, la ausencia de uniones discriminadas cómodas y la falta de validación en runtime.
- **Interfaces TS a mano + Zod aparte**: duplica cada forma (interface + esquema) y se desincronizan; con `z.infer` hay una sola fuente de verdad.
- **Zustand para el estado global**: se evaluó y se descartó. No hay React ni suscripciones por selector que lo aprovechen; el patrón actual (objeto `GameState` plano mutado por los sistemas de dominio + EventBus para notificar, ADR 0002) cubre lo mismo con menos indirección. Introducirlo habría significado reescribir el wiring de todos los sistemas sin ganancia observable.

## Consecuencias

- `pnpm typecheck` (`tsc --noEmit`, strict) cubre todo `src/` y `data/`; los tests de Vitest corren los `.test.ts` directamente.
- Añadir contenido en `data/` ahora tiene doble red: error de tipo en el editor y error de validación Zod en el arranque.
- Un save manipulado o de una versión incompatible ya no puede dejar el estado a medio cargar.
