# Plan: Almacén del granjero 3D en el juego

Rama: `feature/almacen-3d`. Sigue el skill `generar-asset-3d` y el precedente
de Marta (`docs/plans/marta-3d.md`): modelo propio generado con Hunyuan3D-2
local + integración en la vista con fallback a primitivas.

## Decisión

Modelo generado con **Hunyuan3D-2 local** (servidor en `127.0.0.1:8081`,
imagen→3D con textura 2048×2048) a partir de `assets/almacen_referencia.png`
(imagen generada con ComfyUI en Windows, workflow `z_image_turbo_int8.json`:
Z-Image-Turbo, granero low-poly estilo Stardew Valley con tejado rojo a dos
aguas). Sin rig ni animaciones: es un edificio estático y el código tolera
`animationGroups` vacío.

Solo vista, sin dominio: el almacén no tiene mecánica propia en esta iteración.

## Pasos

1. **Referencia y generación**: ya hechas (skill `generar-asset-3d`): el GLB
   está en `assets/almacen.glb` (malla limpia, giro de convención 180° en Z,
   base en y=0) y publicado en `public/models/almacen.glb`.
2. **Orientación de la puerta**: medida por muestreo de la textura sobre las
   caras (blancos horizontales): la puerta del GLB mira hacia **+z en Babylon**
   (sur), como las casas del pueblo. No hace falta rotación extra.
3. **Vista** (`src/world/worldView.ts`, sin tocar dominio): `buildStorage()`
   **sustituye a la caja de ventas** (la eliminamos de `buildDecor`): va al
   este de la parcela, en `(13.5, 5)`, separado de los surcos (la última
   columna llega hasta x≈10.7), con la puerta mirando a la parcela (oeste,
   -x): el GLB mira hacia +z y el root gira -π/2 en Y.
   - Colisión: caja invisible fija (~2.5×2.4×2.5) para que el granjero no
     pueda atravesarlo, independiente de que cargue el GLB o las primitivas.
   - Primitivas de respaldo con el estilo del pueblo (base de madera, tejado
     rojo a dos aguas, puerta al este).
   - `_loadStorage()` carga `/models/almacen.glb` con el patrón de
     `playerView._loadFarmer` (escala a ~2.2 m por caja envolvente real,
     apoyo en suelo, sombras) y sustituye las primitivas si carga.
   - La interacción de venta (`world.sellBin`, usada por `main.ts`) queda en
     el mismo punto: ahora se vende en la puerta del almacén.
4. **Verificación**:
   - `pnpm verify` (format:check + lint + typecheck + test).
   - En local (`pnpm dev` + `agent-browser`): `/models/almacen.glb` responde
     200; el almacén usa el GLB; no hay errores de consola.

## Criterios de aceptación

- El almacén sustituye a la caja de ventas: modelo GLB texturizado al este de
  la parcela, con la puerta mirando a la parcela (oeste).
- Sin GLB (p. ej. 404), se ve el almacén de primitivas con colisión.
- El jugador no puede atravesar el almacén.
- La interacción de venta sigue funcionando en la puerta del almacén.
- `pnpm verify` en verde.
