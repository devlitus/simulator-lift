# Interior de la casa del granjero

Vivienda de 16 × 10 m en forma de diorama: sin techo, con el muro sur y los
tabiques bajos para que la cámara isométrica vea todas las estancias a la vez.
Es un escenario propio al que se llega por la puerta de la casa
(`assets/casa_granjero/`).

## Estancias

| Estancia | Contenido |
| --- | --- |
| Salón comedor | Hogar de piedra, televisor, sofá, mesa de centro, butaca, mesa de comer con cuatro sillas |
| Cocina abierta | Encimera con fregadero, fogones con horno y campana, nevera, estantes con cerámica, isla con taburetes |
| Baño | Ducha, bañera, inodoro, lavabo con espejo y toallero |
| Dormitorio | Cama de matrimonio, armario ropero, dos mesitas y alfombra |

Todo el suelo libre es transitable: los muebles dejan paso y un test de
`src/world/homeInterior.test.ts` recorre la planta desde el felpudo y falla si
queda algún hueco aislado. El plato de la ducha se pisa.

## Referencia y texturas (ComfyUI)

`generar_referencias_comfy.py` usa Z-Image-Turbo en la API local, con el mismo
workflow que las texturas del escenario; cada `zimage_*.json` guarda su grafo.

| Imagen | Uso |
| --- | --- |
| `referencia.png` | Guía de estilo, paleta y mobiliario; no va en el juego |
| `suelo.png` | Tarima (`M_Suelo`) |
| `piedra.png` | Hogar y chimenea (`M_Piedra`) |
| `azulejo.png` | Suelo del baño y frente de la cocina (`M_Azulejo`) |
| `colcha.png` | Colcha de la cama (`M_Colcha`) |

Las texturas se reducen a 512 px al generar el modelo.

## Modelo (Blender)

`generar.py` lo modela por script, sin IA, con la semilla 1112027. Lo que no
lleva textura usa colores planos en el atributo `Col` (`M_Interior`). `M_Cristal`
son las ventanas (el juego les da la luz de fuera), `M_Fuego`, emisivo, las
llamas y la vela, y `M_Tele`, la pantalla. Una malla (`SM_CasaInterior`), sin rig;
ver `metricas.json`. Escala métrica, suelo en z=0 y puerta en -Y de Blender (+Z en
Babylon, con x reflejada).

## Integración

`HomeInteriorView` la coloca en `HOME_INTERIOR`, lejos del pueblo, sin
reescalarla: las colisiones de `src/world/homeInterior.ts` usan las mismas
coordenadas que este script, así que **si mueves un mueble aquí, actualiza también
ese archivo**. Sin el GLB queda una estancia de primitivas con las mismas
colisiones.

## Reproducir desde la raíz del repositorio

```bash
python assets/casa_interior/generar_referencias_comfy.py
```

```bash
blender --background --factory-startup --python assets/casa_interior/generar.py
```

Genera `assets/casa_interior.blend`, `assets/casa_interior.glb`, la copia
publicada `public/models/casa_interior.glb`, `metricas.json` y `preview.png`.
Blender termina con código 0 aunque el script falle: revisa la salida en busca
de `Traceback`.
