# Plan: casa del granjero donde dormir

Rama: `feature/casa-granjero`.
Estado: implementado y verificado (`pnpm verify`, `pnpm build` y navegador).

## Objetivo

El granjero tiene una casa propia junto a la granja. Al llegar a su puerta
puede dormir: la pantalla funde a negro, empieza el día siguiente a las
06:00 (con su autoguardado) y el granjero despierta delante de la puerta.

## Asset

- `assets/casa_granjero/generar.py`: modelado procedural determinista en
  Blender (sin IA), como el pozo. Cabaña de troncos sobre zócalo de piedra,
  tejado a dos aguas de tejas, chimenea de piedra, porche con escalón,
  puerta con farol, ventanas con contraventanas y jardineras.
- Materiales de colores planos con variación por tabla/teja/piedra en un
  atributo de color de vértice (estilo low-poly del pueblo); sin rig.
- Escala métrica, pivote base-centro, frente en -Y de Blender (+Z en Babylon).
- Fuentes: `assets/casa_granjero.blend`, `assets/casa_granjero.glb`,
  `assets/casa_granjero/preview.png`; publicado en
  `public/models/casa_granjero.glb`.

## Integración

- `WorldView.buildFarmerHouse()`: colisión fija independiente del GLB,
  primitivas de respaldo y carga asíncrona con escala por caja envolvente.
  Posición `(-6.5, 14)`, al sur del recinto y al oeste del spawn, con la
  puerta mirando a la cámara. Zona libre de decorado en `SceneryView`.
- `WorldView.sleep(day)`: salta a las 06:00 y emite `DAY_NEW`.
- Regla de dominio pura `canSleep(hour)` en `src/world/sleep.ts` (con test):
  solo se puede dormir desde las 18:00 (o de madrugada). Hora mínima en
  `data/balance.ts` (`sleepFromHour`).
- `main.ts`: interacción `E: Dormir hasta mañana` junto a la puerta; fundido
  en la UI, día nuevo y el granjero reaparece en la puerta.
- Ayuda del HUD actualizada.

## Verificación

- `pnpm verify` y `pnpm build`.
- Navegador: casa cargada, escala frente al granjero, colisión, mensaje antes
  de las 18:00 y dormir después.
