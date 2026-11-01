# Energía del jugador y horario

Rama: `feature/energia-horario`

## Objetivo

Que el día tenga ritmo: las labores de la granja cansan, dormir en la cama de
casa recupera la energía y quedarse despierto hasta tarde tiene un coste. Así la
casa y la cama, que ya existían, pasan a formar parte del bucle diario.

## Tareas

- [x] 1. Datos (`data/`)
  - [x] 1.1 `data/schemas.ts`: `EnergyConfigSchema` (`max`, `costs` por labor, `lowWarning`, `passOutHour` < 6, `faintEnergy`, `faintMoneyLoss`, `faintMaxLoss`) dentro de `BalanceSchema`; tipo `FarmAction`.
  - [x] 1.2 `data/balance.ts`: 100 de energía; plantar 3, regar 2, cosechar 1, limpiar 2 (una barra no llega para plantar y regar los 24 surcos); desmayo a las 02:00 → media energía y −10 % del dinero (máx. 100 🪙).
- [x] 2. Dominio puro
  - [x] 2.1 `src/player/energy.ts`: clase `Energy` (`spend`, `canAfford`, `rest`, `faint`), avisos de «poca energía» y «agotado».
  - [x] 2.2 `src/world/sleep.ts`: `shouldPassOut(hour, passOutHour)` e `isPastMidnight(hour)`.
  - [x] 2.3 `src/crops/farmLogic.ts`: medidor de energía inyectable (`FarmEnergy`); cada labor se valida primero y solo entonces gasta energía; agotado no cambia nada.
- [x] 3. Estado, eventos y guardado: `energy` en `GameState`, evento `ENERGY_CHANGED`, `energy` opcional en `SaveSchema` (saves viejos cargan con la barra llena).
- [x] 4. Wiring (`src/main.ts`): dormir llama a `energy.rest()` antes del día nuevo (el autoguardado ya la recoge); a medianoche se avisa; a las 02:00 `passOut()` cierra ventanas, funde a negro, aplica `energy.faint()` y despierta en casa.
- [x] 5. Vista/HUD: barra ⚡ en la barra superior (verde/ámbar/rojo), coste en la pista de cada surco y pista «😩 Estás agotado» sin acción; ayuda actualizada.
- [x] 6. Tests: `energy.test.ts`, `sleep.test.ts`, `farmLogic.test.ts`, `save.test.ts` y escenario `src/scenarios/energy.test.ts`.

## Verificación

| Criterio | Comprobación |
|---|---|
| Labores gastan energía; agotado no se trabaja | `pnpm vitest run src/crops src/player` |
| Desmayo a la hora límite, penalización con tope | `pnpm vitest run src/world/sleep.test.ts src/player` |
| La energía se guarda; saves viejos cargan | `pnpm vitest run src/core/save.test.ts` |
| Bucle completo | `pnpm vitest run src/scenarios/energy.test.ts` |
| Gate completo | `pnpm verify` |
| HUD, desmayo a las 02:00 y despertar en casa | ✅ manual en navegador (día 2, 50/100, 100 → 90 🪙) |
