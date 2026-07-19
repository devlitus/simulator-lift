# Registro de decisiones de arquitectura (ADR)

Cada archivo documenta una decisión de diseño relevante para el mantenimiento a largo plazo del proyecto, con el formato: Contexto → Decisión → Alternativas consideradas → Consecuencias.

| # | Decisión |
|---|---|
| [0001](0001-dominio-desacoplado-de-babylon.md) | Separar lógica de juego (dominio puro) de las vistas Babylon |
| [0002](0002-eventbus-observer-para-estado.md) | EventBus (Observer) como mecanismo de estado/comunicación entre sistemas |
| [0003](0003-javascript-con-jsdoc-en-vez-de-typescript.md) | ~~JavaScript + JSDoc tipado en vez de TypeScript compilado~~ (sustituida por 0008/0009) |
| [0004](0004-contenido-en-archivos-de-datos.md) | Contenido de juego en archivos de datos (`data/`) separados de la lógica |
| [0005](0005-estructura-de-carpetas-por-dominio.md) | Estructura de carpetas por dominio (`src/<dominio>/`) en vez de por tipo de archivo |
| [0006](0006-vitest-para-tests-de-dominio.md) | Vitest para probar el dominio puro; sin pruebas automatizadas de Babylon |
| [0007](0007-cannon-js-para-fisica.md) | Cannon.js (API V1 de Babylon) como motor de física |
| [0008](0008-vite-como-bundler-y-despliegue-en-vercel.md) | Vite como bundler y dev-server, con despliegue en Vercel |
| [0009](0009-migracion-a-typescript-con-zod.md) | Migración a TypeScript con esquemas Zod para el contenido |
