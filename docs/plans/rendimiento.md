# Rendimiento del juego

Rama: `perf/rendimiento`.

## Objetivo

Bajar el coste por frame (CPU) y la memoria de vídeo sin cambiar el aspecto ni
las reglas del juego.

## Medición (dev-server, vista inicial, RTX 4070, 1437×788)

| Dato                          | Antes  | Después |
| ----------------------------- | ------ | ------- |
| CPU por frame                 | 6,0 ms | 2,8 ms  |
| Mallas en escena              | 936    | 515     |
| Mallas activas (dibujadas)    | 485    | 99      |
| Mallas que dan sombra         | 245    | 114     |
| Paso de física                | 0,80 ms | 0,33 ms |
| Evaluación de mallas activas  | 1,30 ms | 0,82 ms |
| Texturas de 2048²             | 41     | 33      |

## Cambios

- **Baldosas del camino** (`worldView.buildPaths` / `_loadPathTiles`): las 292
  cajas de respaldo se funden en una sola malla y las baldosas 3D se dibujan
  con thin instances (una llamada por variante). Antes no llegaban a verse:
  `instantiateHierarchy` pedía el módulo `InstancedMesh`, que no se importa
  desde la migración a npm, y la carga caía siempre en el respaldo.
- **Vallas** (`worldView.fenceSide` / `mergeFences`): postes y travesaños de
  cercados y granja se funden en una malla, que da sombra con una llamada.
- **Árboles** (`worldView._loadTree`): cada variante se carga una vez
  (`AssetContainer`) y los árboles son clones que comparten geometría y
  texturas, en vez de un GLB importado por árbol.
- **Materiales** (`worldView.mat`): un material compartido por color.
- **Física** (`main.ts`): fase ancha por barrido (`SAPBroadphase`) y las
  colisiones fijas dejan de sincronizarse en cada paso (`freezeStaticColliders`).
- **Ratón** (`main.ts`): se desactiva el picking automático de la escena, que
  nadie usaba.
- **HUD** (`ui.tick`, `ui.showHint`): el DOM solo se toca cuando cambia el dato.
- **Parcela** (`farmView.sync`): solo se reconstruyen los surcos que cambian.

## Pendiente (fuera de esta rama)

- Los GLB pesan ~130 MB (texturas de 2048² y mallas de ~40 000 triángulos en
  gallina, Gon y granjero): optimizarlos reduciría la carga inicial y la VRAM.
