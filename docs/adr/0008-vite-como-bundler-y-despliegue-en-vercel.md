# 0008 — Vite como bundler y dev-server, con despliegue en Vercel

**Estado:** Aceptada · Sustituye parcialmente a [0003](0003-javascript-con-jsdoc-en-vez-de-typescript.md) (la parte de «sin paso de build»)

## Contexto

El proyecto se servía como módulos ES nativos con cualquier servidor estático (`python3 -m http.server`). Surge el objetivo de desplegar el juego en Vercel y, junto con la migración a TypeScript ([0009](0009-migracion-a-typescript-con-zod.md)), hace falta un paso de compilación en desarrollo y en build.

## Decisión

Adoptar **Vite** como dev-server y bundler:

- `pnpm dev` / `pnpm start` — dev-server con HMR en `http://localhost:5173`.
- `pnpm build` — build de producción en `dist/` (lo que Vercel publica).
- `pnpm preview` — sirve el build de producción en local.
- `index.html` en la raíz sigue siendo la entrada; carga `/src/main.ts` como módulo.
- **Babylon.js y Cannon.js siguen vendorizados como UMD**, ahora en `public/vendor/`: Vite copia `public/` tal cual a `dist/` sin empaquetarlo. Se cargan con `<script src="/vendor/...">` antes del módulo principal, igual que antes (globales `BABYLON`/`CANNON`). Así el bundle de la app queda en ~90 KB y Babylon no pasa por el transform de Vite.
- El gestor de paquetes es **pnpm** (con `allowBuilds: esbuild` en `pnpm-workspace.yaml`, porque pnpm bloquea por defecto los scripts postinstall).

Para Vercel no hace falta configuración extra: detecta el framework Vite y publica `dist/`.

## Alternativas consideradas

- **Vercel sin bundler** (publicar los archivos estáticos tal cual): habría bastado para desplegar la versión JS, pero no permite TypeScript ni validación en build, y renuncia a HMR y a minificación.
- **Importar Babylon desde npm** (`@babylonjs/core`) en vez del UMD vendorizado: daría tipos reales y tree-shaking, pero implica reescribir todas las vistas al API modular y revisar el plugin de física V1 (Cannon). Queda como mejora futura; no era necesario para el objetivo (desplegar).

## Consecuencias

- Ya **hay** paso de build: para jugar en local hace falta `pnpm install` + `pnpm dev`. Se pierde el «abrir con cualquier servidor estático» que defendía el ADR 0003.
- El despliegue es reproducible: `vite build` + publicar `dist/` (Vercel lo hace solo).
- `dist/` está ignorado por lint/format y no se versiona.
