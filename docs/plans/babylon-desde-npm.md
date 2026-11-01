# Plan: Babylon.js desde npm con tipos reales

Rama: `chore/babylon-desde-npm`.

## Objetivo

Dejar de cargar Babylon.js y Cannon.js como scripts UMD vendorizados y
pasar a importarlos como módulos ES desde npm, con tipos reales en las
vistas. El juego debe verse y comportarse exactamente igual. Es la «mejora
futura» que dejó apuntada el ADR 0008.

## Situación actual

- `index.html` carga `/vendor/babylon.js` (8,2 MB), `babylon.loaders.js`
  (270 KB) y `cannon.js` (390 KB) antes del módulo principal. En total son
  ~1,9 MB con gzip, frente a 32 KB del código del juego.
- `src/global.d.ts` declara `BABYLON` y `CANNON` como `any`, y todos los
  objetos de Babylon se tipan como `any` en las 6 vistas (`main.ts`,
  `worldView`, `playerView`, `farmView`, `npcView` y `animalView`).
- La física usa la API V1: `CannonJSPlugin` y `PhysicsImpostor`, con 22 usos.
- El dominio no importa Babylon (ADR 0001), así que este cambio no toca
  `data/` ni la lógica pura, ni los tests.

## Pasos

1. **Dependencias**: añadir `@babylonjs/core` y `@babylonjs/loaders`
   fijados en **9.17.0** (la versión vendorizada, para no mezclar el cambio
   de empaquetado con uno de versión) y `cannon` 0.6.2 (la misma de
   `public/vendor/cannon.js`).
2. **Imports en las vistas**: sustituir el global `BABYLON.X` por imports
   con nombre (`import { Vector3, MeshBuilder, … } from '@babylonjs/core'`),
   archivo por archivo, sin cambiar la lógica. Añadir los imports de efecto
   que el build UMD traía incluidos:
   - `@babylonjs/loaders/glTF` (registro del cargador de GLB);
   - los componentes de escena de sombras, física y partículas si no los
     arrastra el barrel.
3. **Física sin cambio de motor**: mantener Cannon (ADR 0007) importándolo
   desde npm y pasándolo a `CannonJSPlugin`. Pasar a Havok (API V2) es un
   cambio de comportamiento y queda fuera de esta rama.
4. **Tipos reales**: quitar `declare const BABYLON/CANNON` de
   `src/global.d.ts` y tipar los campos y parámetros que hoy son `any`
   (`Scene`, `Mesh`, `TransformNode`, `AnimationGroup`, `ShadowGenerator`,
   `ParticleSystem`…). Donde la API devuelva tipos amplios (nodos del GLB,
   `getNodeByName`), se estrecharán con comprobaciones en lugar de `any`.
   Los errores de tipo que salgan se corrigen en esta rama. Si alguno
   destapa un bug real, se anota aquí.
5. **Limpieza**: borrar `public/vendor/babylon.js`, `babylon.loaders.js`
   y `cannon.js` y sus `<script>` de `index.html`.
6. **Bundle**: medir `pnpm build` antes y después. Si importar desde el
   barrel `@babylonjs/core` no reduce el tamaño de forma apreciable, pasar a
   imports por ruta (`@babylonjs/core/Maths/math.vector`…), que permiten el
   tree-shaking de verdad. Se decidirá con los números en la mano.
7. **Documentación**: nuevo **ADR 0010** («Babylon.js y Cannon.js desde npm
   como módulos ES»), que sustituye la parte de vendorizado del ADR 0008.
   Actualizar el índice de ADRs, la nota de `AGENTS.md` sobre `public/vendor/`
   y `assets/README.md` (habla del cargador en `public/vendor/`).

## Verificación

- `pnpm verify` en verde. Hoy el `format:check` falla por varios JSON ajenos
  a esta rama; se arreglará aquí con `prettier --write` sobre esos archivos
  para que el gate quede limpio.
- `pnpm build`: comparar el tamaño del JS con la línea base (1,9 MB con gzip
  entre vendor y app).
- A mano en el navegador: carga de todos los GLB, sombras, caminar e idle,
  colisiones (casas, almacén con su puerta, vallas y bordes), el riego con
  la regadera y el agua, animales y NPCs, guardar y cargar partida, y
  ningún error en la consola.

## Riesgos

- El plugin de física V1 en módulos ES depende de recibir el objeto
  `CANNON` explícitamente. Ya se le pasa hoy (`window.CANNON`), así que
  basta con cambiar el origen.
- Vite preempaqueta `@babylonjs/core` la primera vez que arranca `pnpm dev`.
  Ese primer arranque será algo más lento.
- Si alguna API de la 9.17 marca avisos de obsolescencia (por ejemplo
  `SceneLoader.ImportMeshAsync`), se dejan como están: actualizarlas es otro
  cambio.

## Resultado

- **Bundle**: el chunk inicial pasa de ~1,94 MB con gzip (vendor + app) a
  645 KB, un 67 % menos. Con el import desde el paquete raíz solo bajaba a
  1,63 MB, así que se pasó a imports por ruta (paso 6).
- **Tipos**: no queda ningún `any` en `src/` y `no-explicit-any` vuelve a ser
  error en ESLint. `src/global.d.ts` sobra porque `@types/cannon` ya declara
  el módulo `cannon`.
- **Lo que comprobó el tipado**:
  - valores que pueden ser nulos: `material.clone()`, `getShadowMap()`,
    `getLinearVelocity()` y la copia de un modelo;
  - mallas que pueden ser instancias sin eventos de render ni LOD;
  - nodos de hueso que no son `TransformNode`.

  Ninguno fallaba en la práctica.
- **Prueba en el juego** (dev y build de producción):
  - modelos, sombras y física;
  - colisiones del almacén, con las mismas cifras que antes;
  - `walk` e `idle`, y el riego con la regadera, la animación y el agua;
  - NPCs que patrullan y el diálogo con Marta.

  La consola no muestra avisos.
- **Formato**: `pnpm verify` pasa entero; se formatearon los JSON que lo hacían
  fallar.
