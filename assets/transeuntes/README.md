# Transeúntes

Los diez vecinos de ambiente que pasean por el pueblo (`data/villagers.ts`).
Estilo chibi como Tomás, modelados por script en Blender 5 a partir de una
referencia de ComfyUI por personaje.

| id | Aspecto | Accesorio |
| --- | --- | --- |
| `rosa` | Abuela, moño canoso, rebeca morada, falda larga | Gafas, cesta |
| `pablo` | Niño, gorra roja, camiseta azul, pantalón corto | — |
| `ernesto` | Granjero corpulento, sombrero de paja, camisa remangada | Barba, cinturón |
| `clara` | Panadera, pañuelo turquesa, blusa mostaza, falda | Delantal |
| `mateo` | Alto y pelirrojo, pelo revuelto, jersey verde | Bufanda |
| `ines` | Moño castaño, blusa coral, pantalón gris | Bolso en bandolera |
| `bruno` | Leñador muy ancho, gorra verde, peto vaquero | Barba |
| `lucia` | Pintora rubia de melena, pamela rosa, vestido celeste | — |
| `anselmo` | Señor mayor, fedora, chaleco de tweed | Bigote, bastón |
| `nuria` | Melena corta, diadema amarilla, chaqueta morada | Maletín |

Las pieles siguen `data/villagers.ts`, no las referencias: Z-Image dibujó
claras a Clara y a Bruno aunque el prompt pedía piel oscura.

## Modelo y rig

Una malla por personaje (`SM_<id>`, 5.800–7.600 triángulos) con colores planos
en el atributo `Col` (COLOR_0) y un único material `M_Transeunte`. Rig de 7
huesos (`root`, `hips`, `spine`, `head`, `leg.L/R`, `arm.L/R`) con **pesos
rígidos**: cada pieza sigue a un solo hueso, así nada se estira ni se
desgarra. Animaciones `walk` (1 s, dos pasos con giro de cadera y pecho
contrario) e `idle` (2 s, respiración y mirada) como pistas NLA.

Cara hacia **-Y** de Blender, que el exportador glTF y el cargador de Babylon
dejan en +Z, el «delante» de `rotation.y = atan2(dx, dz)` en el juego
(comprobado en el navegador). Pies en z=0, escala métrica con la altura de
cada uno ya horneada: el juego no reescala.

`metricas.json` da triángulos, vértices y altura de cada uno, y la zancada
de `walk` (0,666 m por ciclo a altura 1), que `VillagerView` usa para ajustar
la velocidad de la animación a la de cada transeúnte.

## Reproducir desde la raíz del repositorio

```bash
python assets/transeuntes/generar_referencias_comfy.py
```

```bash
blender --background --factory-startup --python assets/transeuntes/generar.py
```

El primero necesita ComfyUI en `127.0.0.1:8188` con Z-Image-Turbo y deja
`referencias/<id>.png` y su workflow. El segundo genera
`assets/transeuntes.blend`, `assets/models/transeunte_<id>.glb`, sus copias
en `public/models/`, `metricas.json` y `preview.png`. Blender termina con
código 0 aunque el script falle: revisa la salida en busca de `Traceback`.
