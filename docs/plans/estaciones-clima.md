# Estaciones del año y clima

Rama: `feature/estaciones-clima`

## Objetivo

Que el paso de los días cambie el juego: el año se divide en cuatro estaciones
(primavera, verano, otoño, invierno) y cada día tiene un clima (soleado, nublado
o lluvia). Cada cultivo solo se puede plantar y crecer en sus estaciones; la
lluvia riega sola la parcela; la escena (cielo, luz, césped, partículas de
lluvia) refleja la estación y el clima, y el HUD los muestra.

## Tareas

- [x] 1. Datos (`data/`)
  - [x] 1.1 `data/schemas.ts`: `SeasonSchema` (`id`, `name`, `icon`, `rainChance`, `cloudChance`, `grassTint`), `SeasonsConfigSchema` (`daysPerSeason`, `seasons[]`) y campo `seasons: SeasonId[]` (mín. 1) en `CropSchema`.
  - [x] 1.2 Nuevo `data/seasons.ts`: 4 estaciones × **7 días** (≈ 17 min reales por estación), probabilidades de lluvia por estación (primavera 35 %, verano 15 %, otoño 30 %, invierno 20 % —en invierno «nieve» sin efecto de riego—).
  - [x] 1.3 `data/crops.ts`: asignar estaciones (zanahoria: primavera+otoño, tomate: verano, calabaza: otoño) y añadir 3 cultivos para que ninguna estación quede vacía: fresa 🍓 (primavera), maíz 🌽 (verano), col 🥬 (invierno).
- [x] 2. Dominio puro nuevo `src/calendar/calendar.ts` (sin Babylon)
  - [x] 2.1 `seasonOf(day)`, `dayOfSeason(day)`, `year(day)` derivados de `state.day` (la estación no se guarda: sale del día).
  - [x] 2.2 `rollWeather(day, rng)` con RNG inyectable; el día 1 siempre es soleado.
  - [x] 2.3 `inSeason(crop, season)`.
  - [x] 2.4 Tests `calendar.test.ts`: límites de estación (día 7→8, 28→29 vuelve a primavera), año, clima determinista con RNG fijo.
- [x] 3. Estado, eventos y guardado
  - [x] 3.1 `src/core/store.ts`: `weather: WeatherKind` en `GameState` (inicial `'sol'`).
  - [x] 3.2 `src/core/events.ts`: `DAY_NEW` pasa a llevar `{ day, season, weather }`; nuevo `SEASON_CHANGED { season }`.
  - [x] 3.3 `src/core/save.ts`: guardar/cargar `weather` (opcional en `SaveSchema`, saves viejos siguen cargando) + test en `save.test.ts`.
- [x] 4. Reglas de granja (`src/crops/farmLogic.ts`)
  - [x] 4.1 `newDay({ season, rain })`: si llueve, todos los surcos vivos cuentan como regados antes de crecer.
  - [x] 4.2 Al cambiar de estación, los cultivos fuera de temporada se marchitan (notificación «🍂 Se acabó la temporada de…»).
  - [x] 4.3 `plant()` rechaza semillas fuera de temporada con aviso.
  - [x] 4.4 Tests en `farmLogic.test.ts` para 4.1–4.3.
- [x] 5. Economía y tienda
  - [x] 5.1 `src/economy/economy.ts`: `buySeed()` rechaza semillas fuera de temporada (test).
  - [x] 5.2 `src/ui/ui.ts`: la tienda de semillas marca las de otras estaciones como «fuera de temporada» (botón deshabilitado) e indica sus estaciones.
- [x] 6. Wiring (`src/main.ts`)
  - [x] 6.1 En `DAY_NEW`: tirar el clima, guardarlo en `state.weather`, pasar estación y lluvia a `farmLogic.newDay()`, emitir `SEASON_CHANGED` si toca, y notificar («🌧️ Hoy llueve: la granja se riega sola»).
  - [x] 6.2 Al regar a mano con lluvia: aviso de que ya está regado (sin gastar agua).
- [x] 7. HUD (`src/ui/ui.ts`, `index.html`, `css/`)
  - [x] 7.1 Junto al día: `🌸 Primavera · día 3/7 · 🌧️` (estación, día de la estación y clima).
  - [x] 7.2 La ayuda (`toggleHelp`) explica estaciones y lluvia.
- [x] 8. Vista (`src/world/worldView.ts` + nuevo `src/world/weatherView.ts`)
  - [x] 8.1 `weatherView.ts`: partículas de lluvia (y copos en invierno) que siguen a la cámara; se apagan en interiores.
  - [x] 8.2 Nublado/lluvia: cielo y niebla más grises, sol más débil (multiplicador sobre el ciclo actual de `update()`).
  - [x] 8.3 Tinte del césped por estación (`diffuseColor` del material del suelo con `grassTint` de los datos): verde vivo, amarillento, ocre, blanquecino.
- [x] 9. Escenario de aceptación `src/scenarios/seasons.test.ts`: recorrer un año completo con RNG fijo — plantar fresa en primavera, cosechar, ver que se marchita al llegar el verano, que la lluvia riega y que el día 29 vuelve a ser primavera del año 2.

## Verificación

| Criterio | Comprobación |
|---|---|
| Estación y año salen del día | `pnpm vitest run src/calendar` |
| La lluvia riega sola; fuera de temporada no se planta ni crece | `pnpm vitest run src/crops` |
| La tienda no vende semillas fuera de temporada | `pnpm vitest run src/economy` + 🔶 manual en la tienda |
| El clima se guarda y saves viejos cargan | `pnpm vitest run src/core/save.test.ts` |
| Bucle de un año completo | `pnpm vitest run src/scenarios/seasons.test.ts` |
| Gate completo | `pnpm verify` |
| HUD muestra estación, día y clima | 🔶 manual en navegador |
| Lluvia/nieve visibles fuera y ocultas dentro; cielo gris | 🔶 manual en navegador |
| Césped cambia de tono con la estación | 🔶 manual (dormir hasta el día 8) |

## Cambios respecto al plan aprobado

- **Sin cultivos nuevos (1.3)**: el almacén tiene estanterías y piezas 3D (`Item_<cultivo>` en su GLB) modeladas solo para zanahoria, tomate y calabaza, y sus tests exigen una estantería por cultivo. Añadir fresa, maíz y col obliga a remodelar el almacén: queda para otra rama. Los tres cultivos se reparten para que ninguna estación quede vacía: zanahoria (primavera, otoño, invierno), tomate (primavera, verano; así la misión de Gon se hace desde el día 1) y calabaza (verano, otoño).
- **`DAY_NEW` mantiene su payload `{ day }` (3.2)**: lo emite `WorldView`, que no sabe de clima. Se añaden `SEASON_CHANGED` y `WEATHER_CHANGED`, que también se emiten al cargar partida para que la vista se sincronice.
- **`beginDay()` en `calendar.ts`**: fija estación y clima del día nuevo; `main.ts` solo cablea el resultado a la granja, y el escenario usa la misma función.
- **`GameState.season`** existe como valor derivado de `day` (se recalcula en `beginDay` y `applySave`, nunca se guarda) para que `FarmLogic` y `Economy` comprueben la temporada sin hacer cuentas de calendario. En sus subestados es opcional: sin estación no hay reglas de temporada.
- **La lluvia riega al empezar el día** (`farmLogic.rain()` tras `newDay()`): lo regado por la lluvia de hoy crece mañana, igual que un riego a mano.
- **Césped de invierno**: el tinte multiplica la textura y solo puede oscurecer (también el emisivo se multiplica por ella), así que el invierno es un verde apagado y frío, no blanco; la nieve hace el resto.

## Notas y decisiones

- **7 días por estación**: con días de 150 s, 28 días serían ~70 min por estación, demasiado para el contenido actual. Es un dato en `data/seasons.ts`, fácil de cambiar.
- **La estación no se guarda**, se deriva de `state.day`: una sola fuente de verdad. El clima sí se guarda para que recargar no cambie el tiempo de hoy.
- **RNG inyectable** en `rollWeather` para que tests y escenarios sean deterministas (ADR 0001).
- **Invierno con nieve**: no riega, es solo visual; la zanahoria es el único cultivo de invierno para que la estación no quede muerta.
- Fuera de alcance: festivales, cumpleaños por estación, tormentas que dañan cultivos, árboles con hojas por estación.
- Cambio estructural pequeño (nuevo dominio `calendar/` y payload de `DAY_NEW`): no requiere ADR nuevo, encaja en ADR 0001/0002/0005.
