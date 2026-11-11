# Optimización del peso de los modelos 3D

## Objetivo

Los 45 `.glb` de `public/models/` sumaban 118 MB y dominaban la carga inicial
y la memoria de vídeo. Se reducen sin cambio visible a la distancia de la
cámara del juego (vista aérea, zoom 6–30 m) y sin tocar el código de las
vistas.

## Qué se encontró

- Los modelos generados con Hunyuan3D (personajes, animales, casa de Gon,
  almacén, puesto) llevan un atlas PNG de 2048×2048 (2–3 MB cada uno) y la
  malla exportada con sombreado plano: ~120 000 vértices para ~20 000
  posiciones distintas (~24 000 contando costuras de UV).
- Con el zoom mínimo (cámara a 8,5 m, ~150 px por metro a 1080p) un personaje
  mide ~225 px de alto: sus 40 000 triángulos ocupan 1–3 píxeles cada uno.
- Los modelos hechos por script (tiendas, casas, transeúntes) son colores
  planos en `COLOR_0`; exportan unas UV que ningún material usa.

## Qué se hace

`scripts/optimizar-modelos.mjs` (`pnpm optimizar:modelos`) lee los fuentes de
`assets/`, que no se modifican, y regenera `public/models/`. Por modelo:

- **Texturas**: redimensionado (2048 → 1024; 512 para la gallina y las
  baldosas) y recompresión a WebP (calidad 90; 96 para normales y ORM del
  pozo). La casa de Gon y el almacén conservan 2048: escalados a ~4,5 m son
  los únicos donde 1024 quedaría por debajo de un téxel por píxel.
- **Mallas de Hunyuan**: soldar por posición+UV, simplificar con meshoptimizer
  (30 % de los triángulos en personajes y animales, 15 % en la gallina, 50 %
  en los dos edificios grandes; error máximo de 1–4 ‰ del tamaño) y recalcular
  normales suaves.
- **Resto**: deduplicar, podar y quitar las UV sin uso. Sin pérdida.

Sin tocar: la geometría de árboles, parcela, baldosas, pozo y regadera (pocas
caras y aristas vivas, el facetado es parte de su aspecto), los rigs y las
animaciones.

Descartado: Draco y Meshopt como compresión. Babylon 9.17 los decodifica, pero
descarga el decodificador de `cdn.babylonjs.com` en tiempo de ejecución; el
juego no debe depender de un CDN externo. WebP sí entra: `EXT_texture_webp`
viene en `@babylonjs/loaders/glTF` y lo decodifica el navegador.

El script falla si un modelo pierde o renombra nodos, mallas, materiales,
animaciones o huesos, o si su caja envolvente se mueve más de un 0,5 %.

## Resultado

| Archivo | Antes (MB) | Después (MB) | Ahorro | Triángulos | Vértices | Texturas |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `almacen.glb` | 6,57 | 0,75 | 89 % | 39.998 → 19.998 | 119.760 → 12.841 | 2048×2048 |
| `almacen_interior.glb` | 0,55 | 0,48 | 12 % | 3926 | 7748 | 512×512 512×512 512×512 512×512 |
| `arbol_01.glb` | 3,31 | 1,29 | 61 % | 11.996 | 35.976 | 2048×2048 → 1024×1024 |
| `arbol_02.glb` | 3,50 | 1,28 | 63 % | 11.624 | 34.870 | 2048×2048 → 1024×1024 |
| `arbol_03.glb` | 3,36 | 1,30 | 61 % | 11.996 | 35.982 | 2048×2048 → 1024×1024 |
| `baldosa_camino_01.glb` | 0,71 | 0,06 | 92 % | 500 | 1490 | 1024×1024 → 512×512 |
| `baldosa_camino_02.glb` | 0,71 | 0,06 | 92 % | 500 | 1488 | 1024×1024 → 512×512 |
| `baldosa_camino_03.glb` | 0,71 | 0,06 | 92 % | 500 | 1492 | 1024×1024 → 512×512 |
| `casa_gon.glb` | 7,67 | 1,07 | 86 % | 40.000 → 24.430 | 119.964 → 17.906 | 2048×2048 |
| `casa_granjero.glb` | 0,88 | 0,88 | 0 % | 11.548 | 22.392 | — |
| `casa_interior.glb` | 0,69 | 0,60 | 14 % | 6390 | 11.842 | 512×512 512×512 512×512 512×512 |
| `casa_vecino_cabana.glb` | 0,16 | 0,13 | 17 % | 1636 | 3276 | — |
| `casa_vecino_encalada.glb` | 0,19 | 0,16 | 17 % | 1960 | 3924 | — |
| `casa_vecino_entramado.glb` | 0,23 | 0,19 | 17 % | 2428 | 4860 | — |
| `casa_vecino_piedra.glb` | 0,61 | 0,50 | 17 % | 6444 | 12.874 | — |
| `casa_vecino_porche.glb` | 0,24 | 0,20 | 17 % | 2528 | 5026 | — |
| `entrada_granja.glb` | 0,21 | 0,20 | 9 % | 1424 | 2768 | 512×512 512×512 512×512 |
| `escenario.glb` | 1,62 | 0,81 | 50 % | 26.382 | 18.948 | 512×512 512×512 512×512 |
| `gallina.glb` | 8,70 | 0,34 | 96 % | 38.654 → 5798 | 115.916 → 4580 | 2048×2048 → 512×512 |
| `gon.glb` | 9,29 | 0,74 | 92 % | 40.000 → 12.000 | 119.189 → 10.044 | 2048×2048 → 1024×1024 |
| `granjero.glb` | 9,55 | 0,84 | 91 % | 37.576 → 12.030 | 111.290 → 11.754 | 2048×2048 → 1024×1024 |
| `lila.glb` | 9,18 | 0,71 | 92 % | 39.880 → 11.964 | 118.392 → 9666 | 2048×2048 → 1024×1024 |
| `marta.glb` | 6,94 | 0,50 | 93 % | 39.986 → 11.994 | 119.930 → 10.021 | 2048×2048 → 1024×1024 |
| `oveja.glb` | 9,39 | 0,80 | 91 % | 39.192 → 15.118 | 117.574 → 11.070 | 2048×2048 → 1024×1024 |
| `parcela_plantacion.glb` | 2,53 | 0,26 | 90 % | 1800 | 5400 | 2048×2048 → 1024×1024 |
| `pozo.glb` | 3,68 | 1,68 | 54 % | 8202 | 22.300 | 1024×1024 1024×1024 1024×1024 |
| `puesto_ventas.glb` | 6,20 | 0,49 | 92 % | 40.000 → 12.000 | 119.926 → 10.288 | 2048×2048 → 1024×1024 |
| `tienda_animales.glb` | 0,87 | 0,72 | 17 % | 9192 | 18.372 | — |
| `tienda_flores.glb` | 1,07 | 0,89 | 17 % | 11.436 | 22.716 | — |
| `tienda_interior_animales.glb` | 0,70 | 0,58 | 16 % | 7248 | 14.176 | 512×512 |
| `tienda_interior_flores.glb` | 2,50 | 2,08 | 17 % | 27.112 | 52.500 | 512×512 |
| `tienda_interior_semillas.glb` | 1,39 | 1,16 | 17 % | 14.616 | 28.888 | 512×512 |
| `tienda_semillas.glb` | 0,91 | 0,75 | 17 % | 9656 | 19.284 | — |
| `tomas.glb` | 0,58 | 0,46 | 20 % | 19.528 | 13.867 | — |
| `transeunte_anselmo.glb` | 0,37 | 0,33 | 11 % | 6288 | 4906 | — |
| `transeunte_bruno.glb` | 0,38 | 0,34 | 11 % | 6324 | 4994 | — |
| `transeunte_clara.glb` | 0,37 | 0,33 | 11 % | 6352 | 4837 | — |
| `transeunte_ernesto.glb` | 0,38 | 0,34 | 11 % | 6620 | 5042 | — |
| `transeunte_ines.glb` | 0,32 | 0,29 | 11 % | 5788 | 4208 | — |
| `transeunte_lucia.glb` | 0,35 | 0,31 | 11 % | 6312 | 4522 | — |
| `transeunte_mateo.glb` | 0,41 | 0,36 | 11 % | 7564 | 5380 | — |
| `transeunte_nuria.glb` | 0,38 | 0,34 | 11 % | 6640 | 5053 | — |
| `transeunte_pablo.glb` | 0,31 | 0,28 | 11 % | 5544 | 4077 | — |
| `transeunte_rosa.glb` | 0,36 | 0,32 | 11 % | 6476 | 4717 | — |
| `vaca.glb` | 9,03 | 0,67 | 93 % | 39.998 → 11.998 | 119.974 → 9260 | 2048×2048 → 1024×1024 |
| **Total (45)** | **118,06** | **26,94** | **77 %** | | | |

En la GPU (texturas únicas tras la carga inicial): las de 2048×2048 pasan de
14 a 2, lo que baja la memoria de texturas de los modelos de ~310 MB a
~100 MB contando mipmaps. Los triángulos de un personaje pasan de ~40 000 a
~12 000 (gallina: 38 654 → 5 798 por cabeza).

## Verificación

- `pnpm lint`, `pnpm typecheck` y `pnpm test` (183 tests) pasan;
  `pnpm format:check` sigue fallando solo por los finales de línea CRLF que ya
  fallaban.
- En el navegador (`pnpm dev`): los 45 `.glb` responden 200 y se decodifican,
  no queda ninguna primitiva de respaldo visible, están los nodos que busca el
  código (`Regadera`, `spout_tip`, `SM_Pozo_*`, `M_Cristal`, `M_Farol`,
  prefijos de `escenario.glb`) y se reproducen `walk`/`idle` del granjero, los
  transeúntes y la gallina. Comparación lado a lado original/optimizado con el
  zoom mínimo en casa de Gon, almacén, granjero (`water`), Gon (`walk`) y
  gallina: sin diferencia apreciable.
- No se ha comprobado dentro del juego con vacas y ovejas compradas ni el
  riego completo; `vaca.glb` y `oveja.glb` se cargaron aparte con el mismo
  cargador (rig de 16 huesos y 48 canales por animación intactos).

## Pendiente (fuera de este cambio)

- `tienda_interior_flores.glb` (2,1 MB, 27 000 triángulos) es ya el modelo más
  pesado; se arregla mejor desde su script de Blender que simplificando.
