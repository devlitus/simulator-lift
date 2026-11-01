# Casas de los vecinos

Cinco casas para el barrio de los vecinos (cuadrante noroeste del pueblo).
Modelado procedural propio en Blender 5, sin imagen de referencia ni IA, con
las piezas comunes de las tiendas (`assets/tiendas/piezas.py`) para que todo
el pueblo comparta paleta y acabado.

| Modelo | Muros | Tejado | Detalles |
| --- | --- | --- | --- |
| `casa_vecino_cabana.glb` | Troncos con las testas en las esquinas | Dos aguas, tablas verdes | Porche cubierto con banco, chimenea, leña |
| `casa_vecino_encalada.glb` | Cal blanca, zócalo azul | Dos aguas, teja | Contraventanas azules, jardineras, parra sobre la puerta |
| `casa_vecino_entramado.glb` | Revoco con entramado, dos plantas | Pizarra, hastial a la calle | Cruces de San Andrés, ventanuco, chimenea de ladrillo |
| `casa_vecino_piedra.glb` | Sillares de piedra | Paja a cuatro aguas | Puerta verde con dintel, barril, mata de flores |
| `casa_vecino_porche.glb` | Tablas azules, esquineras blancas | Teja a cuatro aguas | Porche con barandilla y columnas, mecedora, macetas |

Los muros son macizos: puertas y ventanas van superpuestas como apliques.
Materiales `M_Tienda` (colores planos en `Col`, exportado como `COLOR_0`),
`M_Cristal` y `M_Farol`; el juego enciende cristales y faroles de noche.
Escala métrica (el juego no reescala), pivote en el centro de la planta del
cuerpo de la casa, base en z=0 y fachada en -Y de Blender (+Z en Babylon).

## Métricas

Entre 1.636 y 6.444 triángulos por casa (la de paja es la más cargada), ver
`metricas.json`, que también da la extensión en x/y de cada una.

## Integración

`src/world/neighborhoodLayout.ts` reparte las casas en 15 parcelas (5
columnas × 3 filas, con dos calles entre filas): la casa de Gon tiene una
parcela fija y las otras 14 reciben un modelo con una semilla fija, sin dos
iguales juntas en la misma fila y con un espejo al azar. Las huellas de
colisión (`HOUSE_MODELS`) salen de las medidas de este script: **si cambias
el cuerpo o el porche de una casa, actualízalas allí**. `WorldView` carga
cada GLB una vez y lo clona en sus parcelas, con casas de primitivas de
respaldo.

## Reproducir desde la raíz del repositorio

```bash
blender --background --factory-startup --python assets/casas_vecinos/generar.py
```

Genera `assets/casas_vecinos.blend`, los GLB fuente en `assets/`, sus copias
en `public/models/`, `metricas.json` y `preview.png`. Blender termina con
código 0 aunque el script falle: revisa la salida en busca de `Traceback`.
