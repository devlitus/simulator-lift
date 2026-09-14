# Plan: Casa y forja de Gon 3D

Rama: `feature/casa-gon-3d`.

## Objetivo

Sustituir la forja gris de primitivas en (-14, -10) por una casa de herrero
propia, con textura y el estilo de los demás edificios del pueblo: piedra
gris, entramado de madera, tejado de tejas y chimenea de forja. Referencia
isométrica completa sobre fondo liso, sin personajes ni texto.

## Trabajo

1. Crear la referencia con Z-Image-Turbo local: 1024×1024, 8 pasos, CFG 1.
2. Generar el modelo y la textura con Hunyuan3D local, liberando previamente
   los modelos de imagen para evitar competencia de memoria.
3. Limpiar en Blender: soldar antes de eliminar artefactos, verificar la
   profundidad y orientar la puerta hacia +z en el juego. Centrar la base.
4. Guardar `assets/casa_gon.blend`, la referencia y el workflow; exportar
   `assets/models/casa_gon.glb` y una copia idéntica en `public/models/`.
5. Integrar en `WorldView` con colisión independiente y respaldo de
   primitivas. Escalar por caja envolvente, apoyar en el suelo y dar sombras.
6. Documentar el asset, ejecutar `pnpm verify` y `pnpm build`, y revisar el
   edificio y su colisión en el navegador, incluyendo un fallo de carga.

## Aceptación

- La casa de Gon muestra el GLB con textura y la puerta hacia el camino.
- Está apoyada en el suelo y tiene volumen adecuado para su ubicación.
- El jugador no atraviesa la forja, incluso durante la carga.
- Si falla el modelo, se muestra la casa gris de primitivas.
- Se conservan la fuente editable, las texturas embebidas y la referencia.
- Las verificaciones del proyecto pasan.
