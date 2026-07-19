# 0006 — Vitest para probar el dominio puro; sin pruebas automatizadas de Babylon

**Estado:** Aceptada

## Contexto

arquitectura.md pide una estrategia de testing que distinga qué se prueba con pruebas unitarias (lógica de negocio pura) y qué se verifica manualmente o con pruebas de integración (interacción con Babylon.js). Gracias a [0001](0001-dominio-desacoplado-de-babylon.md), toda la lógica de negocio (`FarmLogic`, `Economy`, `Friendship`, `QuestSystem`, `buildSave`/`applySave`/`SaveRepository`) es JavaScript plano sin DOM ni WebGL.

## Decisión

- **Pruebas unitarias con Vitest** (`npm test`), colocadas junto a cada módulo de dominio (`src/crops/farmLogic.test.js`, `src/economy/economy.test.js`, `src/npcs/friendship.test.js`, `src/quests/questSystem.test.js`, `src/core/save.test.js`). Cubren: plantar/regar/crecer/marchitar/cosechar, compra/venta con fondos insuficientes, subida de nivel de amistad y su notificación, las tres máquinas de estado de misión (`talkAll`/`deliver`/`harvest`) incluida su recompensa, y el guardado/restauración de partida (con un `storage` en memoria como *test double* de `localStorage`).
- **Verificación manual en navegador** para todo lo que depende de Babylon: renderizado de meshes, física/colisiones, cámara, ciclo día-noche, HUD/diálogos en el DOM real. No se automatiza con un framework de integración (p. ej. Playwright) por ahora: el proyecto es aún de un tamaño donde probar manualmente el flujo completo (moverse, plantar, regar, cosechar, hablar, tienda, misión, guardar/cargar) toma minutos y el retorno de automatizarlo no compensa su mantenimiento.

Se eligió Vitest sobre Jest por ser nativo de ESM/`import` (el proyecto usa `"type": "module"` y no tiene ni necesita Babel/transpilación para el código de dominio) y por integrarse sin configuración adicional con Vite si el proyecto migra a él más adelante (ver [0003](0003-javascript-con-jsdoc-en-vez-de-typescript.md)).

## Alternativas consideradas

- **Jest**: es el estándar de facto, pero su soporte de ESM nativo históricamente requiere configuración extra (o transformarlo con Babel), lo que introduciría exactamente el paso de build que [0003](0003-javascript-con-jsdoc-en-vez-de-typescript.md) evita.
- **Automatizar también las vistas con Playwright/Puppeteer**: da cobertura de regresión visual/funcional real, pero para el tamaño actual del proyecto es una inversión de mantenimiento (selectores, esperas, flakiness) que no se justifica frente a la verificación manual guiada por un checklist.

## Consecuencias

- Cualquier regla de negocio nueva debe llegar con su test junto al módulo que la implementa; es la forma barata de detectar que, por ejemplo, cambiar el balance de `WILT_DAYS` no rompe silenciosamente la máquina de estados de la parcela.
- Las vistas y el wiring de `src/main.js` quedan fuera de la cobertura automática: un cambio ahí requiere probar manualmente el juego (ver README, sección de verificación) antes de dar por cerrada una tarea.
