# Plan: flores 3D texturizadas para el jardín de Lila

Rama: `feature/flores-lila-3d`.
Estado: en implementación.

## Objetivo y dirección artística

Reemplazar las seis flores decorativas compuestas por cilindros y esferas del
jardín de Lila por modelos GLB texturizados de lectura clara desde la cámara
isométrica. El conjunto tendrá tres variedades complementarias y distintas:
margarita blanca con centro amarillo, tulipán coral y espiga de lavanda. Las
formas serán estilizadas, low-poly y cálidas, coherentes con el pueblo.

## Alcance

- Crear una referencia y un GLB con textura embebida para cada variedad.
- Guardar sus fuentes editables y publicar copias en `public/models/`.
- Alternar las tres variedades en las seis posiciones que ya existen.
- Mantener las primitivas actuales como respaldo visual si falla una carga.
- No cambiar posiciones, colisiones ni reglas de juego.

## Pasos

1. Generar las referencias de las tres flores, una por imagen, con fondo liso,
   vista tres cuartos y sin elementos ajenos; registrar los prompts.
2. Convertir cada referencia a GLB texturizado con Hunyuan3D-2, limpiar las
   mallas en Blender (soldar vértices antes de eliminar islas), orientar la
   base al suelo y guardar los `.blend` editables.
3. Exportar los GLB fuente en `assets/models/` y publicar copias idénticas en
   `public/models/`.
4. Extraer la decoración de flores de `WorldView` a una carga asíncrona que
   escale y apoye cada modelo por su caja envolvente; borrar su respaldo solo
   tras una importación válida.
5. Documentar los assets y comprobar con `pnpm verify`, `pnpm build` y una
   revisión visual en el navegador.

## Criterios de aceptación

- El jardín alterna tres flores 3D texturizadas y visualmente distinguibles.
- Cada modelo se sirve desde `/models/`, queda apoyado en el terreno y arroja
  sombras.
- Una carga fallida deja visibles las flores de primitivas actuales.
- La verificación automática y la comprobación visual terminan sin errores.
