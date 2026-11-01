# Plan: interior del almacén

Rama: `feature/almacen-interior`.
Estado: implementado y verificado (tests, lint, tipos, `pnpm build` y navegador).

## Objetivo

El almacén pasa a tener un escenario interior propio, como la casa. Solo se
entra por su puerta principal y todo el suelo es transitable, en los dos niveles.

## Contenido

- Una estantería por recurso: tres de cosecha (zanahoria, tomate, calabaza) en la
  planta baja y tres de productos (huevo, lana, leche) en el altillo. Un test falla
  si un cultivo o un animal de `data/` se queda sin la suya.
- Zona del pienso con un box por animal (gallina, oveja y vaca), en la planta baja.
- Dos niveles: el altillo cubre la mitad del fondo y se sube por una escalera de mano.

## Decisiones

- Física real en dos alturas, no un truco de la vista: el altillo es una losa a
  2,6 m. Lo de abajo no llega a la losa y lo de arriba se apoya en ella, así que
  cada nivel tiene sus colisiones sin filtros. Una barandilla continua impide caer.
- La escalera es una interacción con Intro: el granjero la recorre sin colisiones,
  por una ruta fija (`LADDER_PATH`).
- Con el granjero bajo el altillo, este se vuelve translúcido para que se le vea
  con la cámara a 45°. Por eso el GLB lleva dos mallas.
- La fachada del almacén se cierra: desaparece el hueco de la puerta y el corte a
  media altura, que ya no hacen falta.
- Sin mecánicas nuevas: el inventario sigue siendo global y las estanterías solo
  informan de cuánto hay de su recurso. Semillas y regalos no tienen estantería.

## Asset

`assets/almacen_interior/`: referencia y texturas con ComfyUI (Z-Image-Turbo) y
modelo por script en Blender. Se sirve como `public/models/almacen_interior.glb`.

## Verificación

`pnpm verify`, `pnpm build` y recorrido en el navegador.
