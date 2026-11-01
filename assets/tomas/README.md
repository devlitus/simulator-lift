# Tomás

Ganadero del rancho (tienda de animales del mercado). Modelado procedural
propio en Blender 5 (sin imagen de referencia ni IA), en un único script
determinista.

## Diseño

Estilo chibi como Marta, Lila y Gon: cabeza grande (~40 % de la altura) y
cuerpo corto.

- Sombrero vaquero de paja con cinta marrón y el ala ribeteada, inclinado
  10° hacia atrás para que la cámara isométrica le vea la cara.
- Pelo castaño con patillas, cejas pobladas, bigote, nariz y mejillas
  sonrosadas.
- Camisa roja de manga corta, pañuelo amarillo al cuello.
- Peto vaquero con tirantes, bolsillo y botones de latón; botas de cuero.

## Métricas

Una malla (`SM_Tomas`), 19.528 triángulos, 9.905 vértices, 17 materiales
planos (`M_Tomas_NN`). Caja de 0,97 × 0,82 × 1,56 m, ver `metricas.json`.
Cara hacia +Y de Blender (+Z en Babylon, convención de los NPC), origen
entre los pies y base en z=0. Sin rig ni animaciones.

## Integración

`NPCSystemView._loadNpcModel` (`src/npcs/npcView.ts`) lo carga para `tomas`,
lo escala a 1,5 m por caja envolvente y mantiene las primitivas como
respaldo si falla la carga.

## Reproducir desde la raíz del repositorio

```bash
blender --background --factory-startup --python assets/tomas/generar.py
```

Genera `assets/tomas.blend`, `assets/models/tomas.glb`, la copia publicada
`public/models/tomas.glb`, `metricas.json` y `preview.png`. Blender termina
con código 0 aunque el script falle: revisa la salida en busca de
`Traceback`.
