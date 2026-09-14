# Baldosas de los caminos

Tres variantes de piedra arenisca cálida y gastada, con esquinas suaves,
contorno ligeramente diferente y textura orientada de forma distinta.
Cada modelo tiene 252 vértices de fuente y 500 triángulos, con huella de
0,98×0,98 m y altura de 0,035 m. La base está en z=0 en Blender.

## Fuentes y generación

- `baldosa_referencia.png`: referencia creada con Z-Image-Turbo INT8 ConvRot
  local, 1024×1024, seed 14092027, 8 pasos, CFG 1, sampler `res_multistep`,
  scheduler `simple` y fondo gris claro.
- `zimage_workflow.json`: workflow reproducible de ComfyUI.
- Hunyuan3D-2mini turbo, textura Hunyuan3D-2 con offload a CPU, octree 256,
  20 pasos, guidance 5 y seed predeterminada 1234.
- `preparar.py`: acabado en Blender sobre la malla recién importada; soldar
  antes de retirar islas, recalcular normales, reducir de 40.000 a 500
  triángulos, normalizar dimensiones y crear variantes con contorno y giro
  distintos. Las UV se conservan para respetar el atlas generado.
- Textura de color de 1024×1024 embebida en cada GLB; materiales mates,
  rugosidad 0,9 y metalicidad 0. Las imágenes se empaquetan en el `.blend`.
- Fuente editable: `../baldosas_camino.blend`, con las tres variantes
  separadas para compararlas en Blender.
- Exportaciones: `../models/baldosa_camino_01.glb`,
  `../models/baldosa_camino_02.glb`, `../models/baldosa_camino_03.glb`.
- Copias servidas: `../../public/models/baldosa_camino_0{1,2,3}.glb`.

## Integración

`WorldView` distribuye 126 piedras sobre los dos caminos actuales, usando
una rejilla compartida de 1,1 m y juntas de tierra. El cruce no duplica las
piezas y las baldosas de los extremos se ajustan a la franja existente.
Cada variante se importa una sola vez y comparte geometría y material
mediante instancias de Babylon. Las piedras reciben sombras y no tienen
impostor físico: el terreno sigue siendo la superficie transitable.

Las 126 cajas de respaldo solo se retiran cuando están listas las tres
variantes. Si falla una carga, se retiran las importaciones parciales y se
conservan las cajas sobre la tierra. Captura: `vista_juego.png`.

## Verificación

- 126 instancias; cero solapamientos medidos en sus cajas envolventes.
- Bases a 0,04 m y superficie máxima a 0,075 m; reciben sombras.
- El jugador cruza de z=-0,5 a z=-7,09 sin bloqueo ni salto.
- Al bloquear la segunda variante quedan 126 cajas de respaldo, sin
  fuentes ni instancias parciales de la primera variante.
- `pnpm verify`: 54 tests correctos; `pnpm build` correcto.
