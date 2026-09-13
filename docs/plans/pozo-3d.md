# Plan: sustituir el pozo por un modelo 3D texturizado

Rama: `feature/issue-8-pozo-3d` (ya existente).
Estado: aprobado por el usuario; implementación y verificación completadas.

## Objetivo y dirección artística

Sustituir el cilindro del pozo en `src/world/worldView.ts` por un GLB propio,
con materiales y texturas, integrado en la estética estilizada del pueblo.
Pozo circular de piedra gris cálida, postes y torno de madera, tejado rojizo
a dos aguas, cuerda y cubo. Silueta clara desde la cámara del juego.
Posición actual: x = -3, z = -4. Base de aproximadamente 1,6 m de diámetro y
altura total orientativa de 2,2 m, a validar con el personaje y el camino.

## Preparación comprobada

- ComfyUI activo en Windows; RTX 4070 con 12 GB de VRAM.
- Workflow de galería `image_qwen_Image_2512`: variante local solicitada,
  comprobación `local_check.runnable = true`; modelo 2512 FP8 instalado.
- Blender conectado; escena vacía.
- El pozo actual es decorativo y tiene colisión estática.
- Skills: `prompt-best-qwen`, `blender-game-assets` y convenciones de
  publicación de `generar-asset-3d`.

## Pasos

1. **Referencia con Qwen Image 2512**
   - Trabajar sobre una copia del workflow; revisar sus slots y notas.
   - Generar una imagen de un único pozo, completo y centrado, vista tres
     cuartos, fondo neutro, luz difusa, sin texto ni elementos de escenario.
   - Fijar y documentar prompt, seed y parámetros. Comenzar en 1024×1024;
     comprobar memoria disponible y validar el workflow antes de ejecutarlo.
   - Guardar la imagen en `assets/pozo_referencia.png` y revisar su diseño.
2. **Modelo y texturas en Blender**
   - Modelar el prop estático tomando la imagen como referencia: brocal
     hueco, postes, tejado, torno y cubo; unidades métricas y pivote base-centro.
   - Aplicar `blender-game-assets`: blocking, malla optimizada, limpieza,
     normales, transformaciones aplicadas, UV sin solapes involuntarios.
   - Objetivo LOD0: 2.000–5.000 triángulos. Preparar LOD1/LOD2 reducidos y
     colisión simple separada, conservando la silueta y las piezas útiles.
   - Crear materiales PBR de piedra, madera y tejado; hornear mapas a un
     atlas de 1024 px, ampliable a 2048 si la revisión visual lo justifica.
   - Revisar frente, laterales, trasera, hueco, costuras UV y tamaño real.
3. **Fuentes y publicación**
   - Guardar `assets/pozo.blend`, GLB fuente `assets/pozo.glb`, mapas y
     parámetros reproducibles de generación/modelado junto a los assets.
   - Publicar el GLB con texturas embebidas en `public/models/pozo.glb`.
   - Documentar proceso, presupuesto real y rutas en `assets/README.md`.
4. **Integración en la vista**
   - Añadir construcción/carga del pozo siguiendo el patrón del almacén.
   - Cargar `/models/pozo.glb` de forma asíncrona; escalar y apoyar sobre el
     camino usando su caja envolvente real, con sombras y orientación revisadas.
   - Mantener primitivas de respaldo hasta completar la carga; si falla,
     conservarlas. La colisión estática será independiente del GLB.
   - Conectar los LOD exportados con el sistema de distancia de Babylon.
5. **Verificación**
   - Ejecutar `pnpm verify` y `pnpm build`.
   - Prueba real con `agent-browser`: carga del GLB y texturas, captura con
     la cámara del juego, escala, apoyo, sombras, LOD y colisión al caminar.
   - Simular fallo de carga del GLB y verificar respaldo visible y colisión.

## Criterios de aceptación

- El pozo de la plaza muestra el modelo propio con texturas embebidas.
- La silueta, el brocal hueco y los materiales se leen desde la cámara del juego.
- El jugador no lo atraviesa y el camino sigue siendo transitable.
- La carga fallida conserva un pozo visible con colisión.
- Existen referencia, fuente Blender editable, GLB publicado y documentación.
- Verificaciones automáticas en verde y revisión visual documentada.

## Resultado

- Referencia generada con Qwen Image 2512, seed 13092026, 1024×1024,
  50 pasos, CFG 4. Se utilizó el modo estándar tras detectar la LoRA de
  aceleración inválida. Workflow conservado en `assets/pozo/qwen_workflow.json`.
- Modelo propio de Blender con atlas PBR de 1024×1024 y LOD. GLB de
  3.809.940 bytes, tres imágenes embebidas; copia fuente y pública idénticas.
- Geometría fuente: 4.800 / 2.400 / 1.440 triángulos; cero aristas no
  manifold y cero caras de área nula. El GLB importa 4.800 / 2.400 / 1.436.
- Revisión de frente y trasera en `assets/pozo/preview.png` y
  `assets/pozo/preview_trasera.png`.
- Babylon: texturas cargadas a 1024×1024; selección de LOD0/1/2 comprobada
  a 10/30/45 m; respaldo ausente tras la carga correcta y visible al abortar
  la petición del GLB. Colisión fija y paso lateral comprobados con teclado.
- `pnpm verify`: formato, lint, TypeScript y los 54 tests en verde.
- `pnpm build`: compilación de producción correcta.
- Revisión visual en Chromium con renderizado por software: el juego
  desactiva sombras en este modo. Las previews de Blender muestran iluminación
  y sombras; el modelo se registra como emisor de sombra en la vista.
