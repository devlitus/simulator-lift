# 0010 — Babylon.js y Cannon.js desde npm como módulos ES

**Estado:** Aceptada · Sustituye parcialmente a [0008](0008-vite-como-bundler-y-despliegue-en-vercel.md) (la parte de Babylon/Cannon vendorizados como UMD) y actualiza [0009](0009-migracion-a-typescript-con-zod.md) (`any` en las vistas)

## Contexto

Desde el ADR 0008, Babylon.js 9.17.0, su cargador glTF y Cannon.js 0.6.2 se servían como scripts UMD desde `public/vendor/`, con globales `BABYLON` y `CANNON` declarados como `any`. Esto tenía tres costes:

- **Sin tipos**: todas las vistas tipaban los objetos de Babylon como `any`, y ESLint tenía `no-explicit-any` desactivado.
- **Tamaño**: el navegador descargaba Babylon entero, ~1,9 MB con gzip sumando los tres scripts, frente a 32 KB del código del juego.
- **Cargador a mano**: Babylon 9 ya no publica UMD del cargador glTF, así que `babylon.loaders.js` se generaba con esbuild fuera del proyecto.

El ADR 0008 ya apuntaba la migración a `@babylonjs/core` como mejora futura.

## Decisión

- **Dependencias**: `@babylonjs/core` y `@babylonjs/loaders` se instalan desde npm, fijados en **9.17.0**, la misma versión que estaba vendorizada. Lo mismo `cannon` **0.6.2**, con tipos de `@types/cannon`. Desaparecen `public/vendor/` y sus `<script>`.
- **Imports por ruta**: las vistas importan cada clase de su módulo (`@babylonjs/core/Meshes/meshBuilder`, `@babylonjs/core/Maths/math.vector`…), no del paquete raíz. El paquete raíz arrastra todo Babylon (el chunk inicial apenas bajaba de 1,9 a 1,63 MB con gzip), mientras que por rutas Vite descarta lo que no se usa.
- **Tipos**: los tipos sí se importan del paquete raíz con `import type`, que se borra al compilar y no afecta al bundle.
- **Efectos laterales**: las piezas que solo se registran como efecto lateral se importan una vez, juntas, en `src/main.ts`:
  - el cargador glTF;
  - el componente de física y el de la física V1;
  - el componente de sombras;
  - el de partículas;
  - los animatables.

  Si se usa una funcionalidad nueva de Babylon y la consola avisa de un componente sin importar (`… needs to be imported`), su import va en ese bloque.
- **Física**: se mantiene Cannon con la API V1 (ADR 0007). Solo cambia el origen: `import * as CANNON from 'cannon'` en vez de `window.CANNON`.
- **Sin `any`**: las vistas usan los tipos reales (`Scene`, `Mesh`, `TransformNode`, `AnimationGroup`…) y ESLint vuelve a tener `@typescript-eslint/no-explicit-any` como error.

## Alternativas consideradas

- **Importar del paquete raíz `@babylonjs/core`**: es lo más sencillo y da los mismos tipos, pero el chunk inicial apenas se reducía (1,63 MB con gzip). Se descartó tras medirlo.
- **Migrar a three.js**: obligaba a reescribir toda la capa visual, buscar sustitutos para física, partículas y animaciones, y no resolvía nada que no resuelva esta decisión.
- **Cambiar a Havok (física V2) a la vez**: cambia el comportamiento de las colisiones y conviene probarlo por separado. Queda para otra decisión.

## Consecuencias

- **Bundle**: el chunk inicial pasa de ~1,94 MB con gzip (vendor + app) a ~645 KB. El resto de Babylon (~360 KB con gzip) se reparte en chunks que solo se cargan si hacen falta.
- **Primer arranque de `pnpm dev`**: tarda algo más, porque Vite preempaqueta los módulos de Babylon.
- **Errores que el compilador comprueba ahora**:
  - valores que pueden ser nulos (`material.clone()`, `getShadowMap()`, `getLinearVelocity()`);
  - mallas que pueden ser instancias y no tienen eventos de render ni LOD propios.
- **Inspeccionar la escena desde la consola**: ya no hay `BABYLON` global. Hay que importar el mismo módulo preempaquetado que usa la app (por ejemplo, el de `Engine` desde `/node_modules/.vite/deps/`) y leer `Engine.LastCreatedScene`.
- **Actualizar Babylon**: es un `pnpm update` explícito de los dos paquetes a la misma versión, sin regenerar ningún UMD.
