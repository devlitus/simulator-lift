# Plan: cámara de seguimiento fija estilo Stardew con zoom de rueda

## Contexto

La cámara anterior perseguía al personaje y giraba suavizada hacia su espalda
(`camYaw` en `main.ts`, que además orientaba el input del jugador en
`playerView.update`). Al usuario le desorientaba el giro. Se probó primero una
cámara libre estilo RTS (WASD paneaba la cámara, flechas movían al personaje),
pero obligaba a gestionar cámara y personaje por separado y tampoco convenció.

Decisión final (estilo Stardew Valley):

- La cámara **sigue al personaje centrada** con **orientación fija** (pitch
  45°, mirando hacia -z). Nunca gira.
- **Suavizado exponencial** (~5/s) al seguir.
- **Rueda del ratón** = zoom (conservado de la versión RTS).
- **WASD / flechas** mueven al personaje, con mapeo fijo al mundo (sin
  `camYaw`).

## Cambios

### 1. `src/core/constants.ts`

Constantes de zoom: `camZoomStart: 12`, `camZoomMin: 6`, `camZoomMax: 30`.

### 2. `src/main.ts` — cámara de seguimiento

- `camTarget` (Vector3) arranca en la posición del jugador y converge a
  `player.position` con `alpha = 1 - exp(-5·dt)` (independiente del framerate).
- Posición de cámara = `camTarget + (0, zoom, zoom)` (altura = distancia →
  45°). Se mira al objetivo suavizado (`camLookAt`, y=1), no al jugador
  directo: así la orientación queda exactamente fija.
- Listener `wheel` sobre el canvas con `preventDefault`; `camZoom` ±1.5 por
  tick entre min y max.

### 3. `src/player/playerView.ts` — input sin rumbo de cámara

- Fuera el parámetro `camYaw` y el getter `facingYaw` (solo los usaba la
  cámara orbital).
- La cámara mira desde +z hacia -z, así que el mapeo es directo al mundo:
  W/arriba = -z (arriba en pantalla), D/derecha = -x (derecha en pantalla).

### 4. `index.html` y `README.md` — controles

- `WASD / Flechas` — moverse
- `Rueda del ratón` — zoom de la cámara

## Verificación

1. `pnpm verify` (format + lint + typecheck + 54 tests de dominio).
2. Prueba en navegador (`pnpm dev`): WASD mueve al personaje y la cámara lo
   sigue centrada con suavizado; la rueda hace zoom; la orientación no cambia
   nunca.
