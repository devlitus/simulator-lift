# Entrada de la granja

Arco de madera de unos 5 m de ancho y 4,7 m de alto, sobre dos troncos con base de
piedra, con tejadillo a dos aguas, letrero en la cumbrera, dos faroles, dos jardineras
y una cancela de dos hojas abierta hacia dentro.

## Referencia y texturas (ComfyUI)

`generar_referencias_comfy.py` usa Z-Image-Turbo en la API local, con el mismo
workflow que las texturas de la casa; cada `zimage_*.json` guarda su grafo.

| Imagen | Uso |
| --- | --- |
| `referencia.png` | Guía de estilo y paleta; no va en el juego |
| `madera.png` | Postes, vigas y refuerzos (`M_Madera`) |
| `piedra.png` | Bases de los postes (`M_Piedra`) |
| `tejas.png` | Tejadillo (`M_Tejas`) |

Las texturas se reducen a 512 px al generar el modelo.

## Modelo (Blender)

`generar.py` lo modela por script, sin IA, con la semilla 1112029. Lo que no lleva
textura usa colores planos en el atributo `Col` (`M_Entrada`) y `M_Farol` es la luz
de los faroles, que el juego enciende de noche. Una malla (`SM_EntradaGranja`), sin
rig; ver `metricas.json`. Escala métrica, suelo en z=0, arco a lo largo de X y
exterior en -Y.

## Integración

`WorldView.buildFarmEntrance` lo coloca sin reescalar en la valla oeste de la granja,
con el exterior hacia la calle. Las colisiones están en `src/world/farmLayout.ts`
(`FARM_ENTRANCE_SOLIDS`), así que **si mueves una pieza aquí, actualiza también ese
archivo**. El juego pinta el nombre sobre el letrero, que mira a la cámara. Sin el GLB
quedan dos postes y una viga de primitivas, con las mismas colisiones.

## Reproducir desde la raíz del repositorio

```bash
python assets/entrada_granja/generar_referencias_comfy.py
```

```bash
blender --background --factory-startup --python assets/entrada_granja/generar.py
```

Genera `assets/entrada_granja.blend`, `assets/entrada_granja.glb`, la copia publicada
`public/models/entrada_granja.glb`, `metricas.json` y `preview.png`. Blender termina
con código 0 aunque el script falle: revisa la salida en busca de `Traceback`.
