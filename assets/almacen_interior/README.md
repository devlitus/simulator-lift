# Interior del almacén

Almacén de 16 × 12 m en forma de diorama: sin techo y con el muro sur bajo para
que la cámara isométrica vea dentro. Es un escenario propio al que solo se llega
por la puerta principal del edificio del pueblo (`assets/almacen.glb`).

## Distribución

| Zona | Nivel | Contenido |
| --- | --- | --- |
| Estanterías de cosecha | Planta baja, bajo el altillo | Una por recurso: zanahoria, tomate y calabaza |
| Zona del pienso | Planta baja, muro oeste | Un box por animal, con su color: gallina, oveja y vaca |
| Altillo | Mitad del fondo, a 2,6 m | Se sube por la escalera de mano |
| Estanterías de productos | Altillo | Una por recurso: huevos, lana y leche |

Todo el suelo libre es transitable en los dos niveles: `src/world/warehouse.test.ts`
recorre cada planta y falla si queda algún hueco aislado, o si un cultivo o un
animal de `data/` se queda sin su estantería o su box.

## Referencia y texturas (ComfyUI)

`generar_referencias_comfy.py` usa Z-Image-Turbo en la API local, con el mismo
workflow que las texturas de la casa; cada `zimage_*.json` guarda su grafo.

| Imagen | Uso |
| --- | --- |
| `referencia.png` | Guía de estilo y paleta; no va en el juego |
| `suelo.png` | Suelo de la planta baja (`M_Suelo`) |
| `tablas.png` | Muros (`M_Tablas`) |
| `tarima.png` | Suelo del altillo (`M_Tarima`) |
| `arpillera.png` | Sacos de pienso (`M_Arpillera`) |

Las texturas se reducen a 512 px al generar el modelo.

## Modelo (Blender)

`generar.py` lo modela por script, sin IA, con la semilla 1112028. Lo que no lleva
textura usa colores planos en el atributo `Col` (`M_Almacen`) y `M_Cristal` son las
ventanas (el juego les da la luz de fuera). Dos mallas sin rig: `SM_AlmacenBase` y
`SM_AlmacenAltillo`, que el juego vuelve translúcida con el granjero debajo; ver
`metricas.json`. Escala métrica, suelo en z=0 y frente en -Y de Blender (+Z en
Babylon, con x reflejada).

## Integración

`WarehouseView` lo coloca en `WAREHOUSE`, lejos del pueblo, sin reescalarlo: las
colisiones de `src/world/warehouse.ts` usan las mismas coordenadas que este script,
así que **si mueves una pieza aquí, actualiza también ese archivo**. Los rótulos
los pinta el juego con los nombres de `data/`. Sin el GLB queda un almacén de
primitivas con las mismas colisiones.

## Reproducir desde la raíz del repositorio

```bash
python assets/almacen_interior/generar_referencias_comfy.py
```

```bash
blender --background --factory-startup --python assets/almacen_interior/generar.py
```

Genera `assets/almacen_interior.blend`, `assets/almacen_interior.glb`, la copia
publicada `public/models/almacen_interior.glb`, `metricas.json` y `preview.png`.
Blender termina con código 0 aunque el script falle: revisa la salida en busca
de `Traceback`.
