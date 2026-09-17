# Plan: árboles 3D texturizados para el pueblo

Rama: `feature/arboles-3d-texturizados`.
Estado: implementación y verificación completadas.

## Objetivo y dirección artística

Sustituir los troncos y copas esféricas creados por primitivas en
`WorldView.buildTree` por tres variantes propias de árbol estático en GLB,
con texturas embebidas y una estética low-poly cálida coherente con el pueblo:
tronco de madera marrón, ramas visibles y copa verde redondeada con volúmenes
claros. Las variantes compartirán proporción y paleta, pero cambiarán la
silueta de la copa para que los diez árboles existentes no parezcan copias
exactas.

Cada árbol tendrá una altura objetivo de aproximadamente 4 m, base centrada
en el origen y apoyada en `y = 0`. La colisión seguirá siendo un cilindro o
caja invisible e independiente del GLB, estable durante la carga y si esta
falla.

## Alcance

- Crear las referencias y tres modelos texturizados: `arbol_01`, `arbol_02`
  y `arbol_03`.
- Publicarlos en `public/models/` e integrarlos alternados en las diez
  posiciones actuales de `WorldView.buildTrees`.
- Conservar el árbol de primitivas como respaldo visual cuando no pueda
  cargarse un GLB.
- No cambiar la distribución, las reglas de colisión ni la lógica de juego.

## Pasos

1. **Referencias con ComfyUI**
   - Iniciar el servidor local de ComfyUI y comprobar la memoria libre de la
     RTX 4070 antes de generar.
   - Generar una referencia limpia para cada variante: un único árbol
     estilizado low-poly, completo y centrado, vista tres cuartos, fondo liso
     y luz suave; sin texto, personajes ni paisaje.
   - Guardar las imágenes, workflow, prompts, semillas y parámetros en
     `assets/arboles/` para que el proceso sea reproducible.
2. **Conversión imagen a 3D texturizado**
   - Arrancar el servidor local Hunyuan3D-2 con texturizado y usar Blender MCP
     para generar cada GLB desde su referencia.
   - Si una llamada supera el tiempo de espera, comprobar el resultado y los
     registros del servidor antes de repetirla; no lanzar varias generaciones
     pesadas a la vez.
3. **Limpieza y acabado en Blender**
   - Para cada malla: soldar vértices duplicados antes de eliminar islas,
     conservar el componente principal y eliminar geometría flotante.
   - Revisar UV, materiales, normales, textura embebida, triángulos y base.
     Optimizar cada variante para su repetición por el mapa, preservando
     tronco, ramas y lectura de la copa.
   - Aplicar la orientación vertical correcta mediante matriz mundial, centrar
     la base en el origen y guardar los `.blend` editables.
   - Exportar `assets/arbol_0N.glb` y publicar copias idénticas en
     `public/models/arbol_0N.glb`.
4. **Integración en Babylon**
   - Extender `WorldView` con una carga asíncrona reutilizable de las tres
     variantes; basar escala y apoyo sobre la caja envolvente real del modelo.
   - Alternar variantes determinísticamente en las ubicaciones actuales,
     registrar sus mallas como emisoras de sombras y desechar solo las
     primitivas de respaldo tras una carga correcta.
   - Mantener por árbol una colisión invisible, de masa estática, sin depender
     de la geometría importada.
5. **Documentación y verificación**
   - Documentar fuentes, dimensiones, presupuesto real de geometría, texturas
     y rutas en `assets/README.md`.
   - Ejecutar `pnpm verify` y `pnpm build`.
   - Probar en el navegador: las diez ubicaciones muestran los GLB, el suelo
     no deja huecos, la escala se lee desde la cámara isométrica, hay sombras
     y el jugador no atraviesa los troncos. Forzar una carga fallida para
     confirmar que siguen visibles los árboles de primitivas con colisión.

## Criterios de aceptación

- Hay tres variantes de árbol low-poly con textura embebida, fuente Blender
  editable, GLB fuente, referencia y parámetros reproducibles.
- Los diez árboles del mapa cargan variantes de GLB, con orientación, apoyo y
  escala correctos.
- La carga fallida conserva un árbol visible y bloquea físicamente al jugador.
- Los assets se sirven desde `/models/`, sin errores en consola.
- `pnpm verify` y `pnpm build` terminan correctamente y existe una revisión
  visual de juego.

## Resultado

- Se generaron tres referencias con Z-Image-Turbo a 1024×1024, 8 pasos, CFG
  1.0 y las semillas `1709202601`–`1709202603`; sus workflows reproducibles
  están en `assets/arboles/`.
- Hunyuan3D-2mini convirtió las referencias en GLB con texturas embebidas. Las
  mallas se limpiaron en Blender, se orientaron y se optimizaron a 11.624 /
  11.996 / 11.996 triángulos. Las fuentes son `assets/arbol_0N.blend` y los
  GLB publicados son `public/models/arbol_0N.glb`.
- Los diez puntos del mapa alternan las tres variantes. La carga correcta
  descarta las primitivas; existen diez colisionadores `treeHit` independientes
  que permanecen aunque un GLB no cargue.
- En la revisión con navegador se comprobaron los diez meshes importados, sus
  sombras y una colisión que desvía al jugador al avanzar contra un tronco.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (54 tests) y `pnpm build` se
  completaron correctamente. El `pnpm verify` completo queda condicionado por
  el formato preexistente de `opencode.json`, ajeno a esta rama; los workflows
  y archivos modificados por esta tarea pasan Prettier y `git diff --check`.
