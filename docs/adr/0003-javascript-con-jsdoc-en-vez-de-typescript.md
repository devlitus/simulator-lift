# 0003 — JavaScript + JSDoc tipado en vez de TypeScript compilado

**Estado:** Sustituida por [0008](0008-vite-como-bundler-y-despliegue-en-vercel.md) y [0009](0009-migracion-a-typescript-con-zod.md) (2026-07-19)

## Contexto

arquitectura.md pide tipado estricto en las interfaces entre sistemas (forma de un `Cultivo`, `NPC`, `Misión`, etc.). El proyecto hoy no tiene paso de build: `index.html` carga `src/main.js` como módulo ES nativo del navegador, y Babylon.js/Cannon.js se sirven como `<script>` UMD vendorizados en `vendor/`. Cualquier servidor estático basta para jugarlo (`npm start` → `python3 -m http.server`).

## Decisión

Mantener JavaScript puro en tiempo de ejecución y añadir **tipado estático solo en tiempo de desarrollo**, vía JSDoc + `tsconfig.json` con `allowJs`/`checkJs`/`noEmit`:

- Cada archivo de `data/` anota su export con `@type` referenciando un `@typedef` (`CropDef`, `NpcDef`, `QuestDef`, `GiftDef`, `BalanceConfig`).
- Cada clase de dominio anota su constructor con `@param` usando el subconjunto mínimo de `GameState` que efectivamente usa (ver `FarmState`, `EconomyState`, `FriendshipState`, `QuestState` en sus respectivos módulos).
- `npm run typecheck` corre `tsc --noEmit` y falla si algo no encaja (probado: 0 errores sobre todo `src/` y `data/`).
- Los globals `BABYLON`/`CANNON` (cargados por `<script>`, no por import) se declaran en `src/global.d.ts`.

No se introduce ningún bundler ni paso de compilación: los `.js` que corren en el navegador son exactamente los que se editan.

## Alternativas consideradas

- **Migrar todo a `.ts` + Vite**: da tipado más ergonómico (genéricos, tipos exhaustivos en uniones, autocompletado sin `@type`) y un dev-server con HMR. A cambio, introduce un paso de build obligatorio: ya no basta abrir `index.html` con cualquier servidor estático, hay que instalar dependencias y compilar antes de jugar. Para el alcance actual (proyecto pequeño, sin colaboradores aún, prioridad en tener v1 jugable) el costo no se justifica.
- **JavaScript sin ningún tipado**: es la opción más simple, pero no cumple el requisito explícito de arquitectura.md de tipado estricto en las interfaces entre sistemas, y deja pasar en silencio errores de forma (p. ej. pasar `state.produce` donde se esperaba `state.seeds`).

## Consecuencias

- Se gana chequeo de tipos en el editor y en CI (`npm run typecheck`) sin tocar cómo se ejecuta el juego.
- Los `@typedef` viven junto a donde tiene más sentido definirlos (p. ej. `CropDef` en `src/crops/farmLogic.js`, no en un archivo de tipos centralizado), y se referencian por import type-only desde otros módulos.
- **Camino de migración a TypeScript real** si el proyecto crece (más colaboradores, necesidad de genéricos o tipos discriminados más estrictos): los `@typedef` ya son la base de los futuros `interface`/`type`; el paso sería (1) introducir Vite, (2) renombrar `.js`→`.ts` módulo por módulo empezando por `core/` y `data/`, (3) convertir los `@typedef` a `type`/`interface` reales. No hace falta rehacer el diseño, solo el mecanismo de tipado.
