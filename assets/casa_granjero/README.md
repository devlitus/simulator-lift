# Casa del granjero

Cabaña de troncos donde duerme el granjero. Modelado procedural propio en
Blender 5 (sin imagen de referencia ni IA), en un único script determinista
(semilla 1112026).

## Diseño

- Zócalo de piedra de 0,45 m en dos hiladas de sillares irregulares.
- Muros de troncos octogonales con las testas a la vista en las esquinas,
  cortados alrededor de la puerta y las ventanas.
- Tejado a dos aguas de tejas solapadas (hileras desplazadas media teja) con
  cumbrera en rombo; hastiales de tablas con listones y un ventanuco.
- Chimenea de piedra adosada al muro este de Blender (oeste en el juego).
- Fachada: puerta de tablas pintadas con farol, dos ventanas con
  contraventanas y jardineras con flores, porche de tarima, escalón y felpudo.
- Leña apilada en el muro oeste de Blender (este en el juego) y un barril.

## Materiales

Colores planos por pieza en el atributo de color `Col` (exportado como
`COLOR_0`), con una ligera variación aleatoria por tronco, teja o piedra:

| Material | Uso |
| --- | --- |
| `M_Casa` | Todo lo opaco (rugosidad 0,85) |
| `M_Cristal` | Ventanas; el juego le da emisión cálida de noche |
| `M_Farol` | Farol de la puerta, emisivo |

## Métricas

Una malla (`SM_CasaGranjero`), 11.548 triángulos, 7.464 vértices y ~860 KB.
Caja de 6,37 × 5,92 × 4,88 m (porche, chimenea y leña incluidos), ver
`metricas.json`. Escala métrica, pivote en el centro de la planta de la casa
(no de la caja), base en z=0. Frente en -Y de Blender, +Z en Babylon.

## Integración

`WorldView.buildFarmerHouse()` la coloca en `(-6.5, 14)`, al sur del recinto,
la escala a 4,8 m de alto por caja envolvente y añade colisiones fijas
(cuerpo, barreras del porche y barril) independientes del GLB, con una casa de
primitivas como respaldo. Es solo el exterior: `Intro` frente a la puerta lleva al
escenario interior (`assets/casa_interior/`), donde está la cama.

## Reproducir desde la raíz del repositorio

```bash
blender --background --factory-startup --python assets/casa_granjero/generar.py
```

Genera `assets/casa_granjero.blend`, `assets/casa_granjero.glb`, la copia
publicada `public/models/casa_granjero.glb`, `metricas.json` y `preview.png`.
Blender termina con código 0 aunque el script falle: revisa la salida en
busca de `Traceback`.
