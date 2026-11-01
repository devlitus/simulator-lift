# Escenario del pueblo

Terreno y decoración del entorno: césped pintado, matas de hierba, flores
silvestres, rocas, arbustos, valla en el borde del mapa, pinos y colinas en
el horizonte. Sustituye al prado de color verde liso.

## Texturas (ComfyUI)

- `generar_texturas_comfy.py`: Z-Image-Turbo INT8 ConvRot local, 1024×1024,
  8 pasos, CFG 1, `res_multistep`/`simple`, shift 3. Semillas
  `2610010011` (césped), `2610010013` (roca), `2610010014` (follaje) y
  `2610010015` (ramillete de hojas sobre fondo blanco). Workflows en
  `zimage_<nombre>.json`; salidas `*_cruda.png`. Admite nombres como
  argumento para regenerar solo esas.
- `hacer_tileable.py`: mezcla cada imagen con su copia desplazada media
  baldosa (ventana senoidal) para que repita sin costuras. La roca se
  recorta al 60 % central antes. Genera también `variacion_suelo.png`
  (ruido de valor periódico, 256×256), el tinte a gran escala que rompe la
  repetición del césped. El ramillete se recorta: el fondo blanco pasa a
  alfa y los píxeles transparentes toman el verde medio (sin halo blanco).
- Copias servidas (JPG): `public/textures/cesped.jpg` (1024) y
  `public/textures/variacion_suelo.jpg`. `roca.png` (512) no se sirve
  suelta: va embebida en `escenario.glb`, igual que `follaje.png` y
  `ramillete.png` (512, RGBA).

## Props (Blender)

`generar.py` modela todo por script en Blender 5.2 (sin intervención
manual) y exporta `../escenario.glb` + `../../public/models/escenario.glb`;
fuente editable `../escenario.blend`.

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python assets/escenario/generar.py
```

| Prop | Triángulos | Notas |
| --- | ---: | --- |
| `Roca_01..03` | 320 | Icosfera deformada con ruido, textura `roca.png` en proyección de caja |
| `Arbusto_01/02` | 1.846 / 1.290 | Cuerpo suave con `follaje.png` y tarjetas de `ramillete.png` (alfa recortado, normales esféricas) |
| `Hierba_01/02` | 18 / 14 | Matas de briznas plegadas |
| `Flores_Blanca/Amarilla/Malva` | 170 | Cinco tallos con corola y botón |
| `Pino_01/02` | 56 | Tronco y tres pisos de copa |
| `Valla_Tramo` | 36 | Poste + dos travesaños de 2 m, encadenables |
| `Colinas` | 21.632 | 260×260 m, llano dentro del mapa, colinas fuera; UV a 4 m y color por vértice |

Los colores se escriben en sRGB y el script los pasa a lineal (glTF). Cada
prop tiene las transformaciones aplicadas y la base en el origen.

## Integración

`src/world/sceneryView.ts` repite los props con thin instances (una
llamada de dibujo por malla): matas de hierba (900 intentos), 34 corros
de flores, 18 rocas, 22 arbustos, 128 tramos de valla y pinos apoyados
sobre las colinas con un rayo. La colocación es determinista (mulberry32 con semilla) y
evita caminos, parcela, edificios, recinto, rutas de los NPC y árboles.
Los arbustos cambian el PBR del glTF por un `StandardMaterial` mate como el
resto de la escena (sin mapa de entorno el PBR sale blanquecino) y sin luz
de doble cara, para respetar las normales esféricas de las hojas. Rocas
grandes y arbustos tienen colisión propia, creada aunque falle el
GLB. `WorldView` aplica la textura del césped al terreno y una niebla
lineal del color del cielo que funde el horizonte con el ciclo día/noche.
