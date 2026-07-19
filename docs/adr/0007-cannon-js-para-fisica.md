# 0007 — Cannon.js (API V1 de Babylon) como motor de física

**Estado:** Aceptada (decisión heredada de la v1, documentada aquí de forma retroactiva)

## Contexto

El jugador y el mundo necesitan colisiones básicas (jugador contra suelo, casas, árboles, muros invisibles de borde de mapa). Babylon.js soporta varios plugins de física intercambiables vía `scene.enablePhysics(...)`.

## Decisión

Usar **Cannon.js** a través de `BABYLON.CannonJSPlugin` + `BABYLON.PhysicsImpostor` (API de física V1 de Babylon), vendorizado localmente en `vendor/cannon.js` y cargado como `<script>` global (`window.CANNON`), igual que `vendor/babylon.js`. El jugador usa un impostor de caja con `fixedRotation` y se mueve seteando velocidad lineal directamente (`setLinearVelocity`), no aplicando fuerzas.

## Alternativas consideradas

- **Havok (API V2, WASM)**: es lo que la documentación actual de Babylon.js recomienda para proyectos nuevos, con mejor rendimiento y física más robusta. Requiere cargar un módulo WASM (`HavokPhysics()`), lo que complica el "sin build, sin CDN, todo vendorizado" que tiene el proyecto hoy, y es claramente más de lo que este juego necesita (colisiones simples caja/estático, sin física dinámica compleja).
- **Ammo.js / Oimo.js**: alternativas JS/WASM de propósito similar a Cannon.js; se descartaron por no aportar nada sobre Cannon.js para este caso de uso y tener comunidades más pequeñas alrededor de Babylon.

## Consecuencias

- Suficiente para el alcance actual: todo objeto físico del mundo es estático (`mass: 0`) salvo el jugador.
- Si en el futuro se necesita física dinámica más rica (objetos que ruedan, ragdolls, vehículos), esta decisión debería revisarse a favor de Havok V2; el punto de cambio sería únicamente `src/main.js` (línea de `scene.enablePhysics`) y `src/player/playerView.js` (impostor del jugador), ya que el resto del código no depende directamente del motor de física.
