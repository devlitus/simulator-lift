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
- `main.ts`: interacción `E: Dormir hasta mañana` junto a la cama; fundido en
  la UI, día nuevo y el granjero despierta a su lado.
- Ayuda del HUD actualizada.

## Interior: un escenario propio

La puerta cambia de escenario en lugar de abrir la cabaña del exterior.

- `assets/casa_interior/`: referencia y texturas con ComfyUI (Z-Image-Turbo) y
  modelo por script en Blender. Vivienda de 16 × 10 m con salón comedor, cocina
  abierta, baño y dormitorio: diorama sin techo, con el muro sur y los tabiques
  bajos para ver todas las estancias a la vez.
- Todo el interior es transitable: un test recorre la planta desde el felpudo y
  falla si queda algún hueco libre aislado.
- Misma escena de Babylon, no una segunda: el jugador, la física y el bucle son
  únicos, y la casa está en `(400, 400)`, lejos del pueblo. Una segunda
  escena obligaría a duplicar la física y a trasladar al jugador entre ellas.
- `src/world/homeInterior.ts` (puro, con test): planta, colisiones y alcance de
  la cama y la salida. Estar dentro se deduce de la posición del jugador, así
  que no hay estado que guardar ni que pueda desfasarse; al cargar partida se
  empieza fuera, como siempre.
- `HomeInteriorView`: colisiones, GLB con primitivas de respaldo, luz del hogar
  limitada a la estancia y ventana que sigue la luz de fuera.
- Dentro, `WorldView` fija la luz y el fondo oscuro, y `main.ts` deja la cámara
  fija con toda la casa en el encuadre, acorta su `maxZ` para no dibujar el
  pueblo y oculta las misiones y el inventario. El tiempo sigue corriendo.
- `src/world/farmerPorch.ts` (puro, con test): se sube al porche solo por sus dos
  peldaños y se entra con `Intro`, únicamente sobre el felpudo, frente a la puerta.
- `main.ts`: `Intro: Entrar en casa` frente a la puerta y `Intro: Salir de casa` en el
  felpudo, con un fundido más breve que el de dormir.

## Verificación

- `pnpm verify` y `pnpm build`.
- Navegador: casa cargada, escala frente al granjero, colisión; entrar, caminar
  hasta la cama, mensaje antes de las 18:00, dormir después, despertar junto a
  la cama y salir al porche. Sin el GLB, estancia de primitivas.
