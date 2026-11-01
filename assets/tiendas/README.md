# Tiendas del mercado (exteriores)

Tres tiendas con la misma estructura para que el mercado tenga un estilo
común: la de semillas (Marta), el rancho (Tomás) y la floristería (Lila).
Modelado procedural propio en Blender 5, sin imagen de referencia ni IA.

| Modelo | Toldo | Pintura | Género expuesto |
| --- | --- | --- | --- |
| `tienda_semillas.glb` | Rojo y blanco | Verde azulado | Sobres de semillas, cajones de verdura, sacos, calabazas |
| `tienda_animales.glb` | Verde y blanco | Rojo granero | Sacos de pienso, balas de paja, lechera |
| `tienda_flores.glb` | Rosa y blanco | Lila | Cubos con ramos y macetas |

Estructura: edificio de 6 × 4,6 m de entramado (revoco con vigas vistas y
cruces de San Andrés en los laterales) sobre zócalo de piedra, tejado de tejas
a dos aguas con el hastial hacia la calle, puerta con faroles, dos escaparates
con toldo y un banco delante de cada uno. El letrero del hastial va en blanco:
el juego lo rotula (`WorldView.paintSign`).

## Archivos

- `generar.py`: construye las tres, las exporta y renderiza los previews.
- `piezas.py`: malla, materiales y género (sacos, paja, flores, verdura…),
  compartidos con `assets/tienda_interior/generar.py`.
- `metricas.json`, `preview_*.png`.

Materiales: `M_Tienda` (colores planos en el atributo `Col`, exportado como
`COLOR_0`), `M_Cristal` y `M_Farol` (emisivo; el juego lo enciende de noche).
Escala métrica (el juego no reescala), pivote en el centro de la planta, base
en z=0 y fachada en -Y de Blender (+Z en Babylon). Las colisiones, la puerta y
el letrero están en `src/world/marketLayout.ts`: **si cambias medidas aquí,
actualiza también ese archivo**.

## Reproducir desde la raíz del repositorio

```bash
blender --background --factory-startup --python assets/tiendas/generar.py
```

Genera `assets/tiendas.blend`, los GLB fuente en `assets/`, sus copias en
`public/models/`, `metricas.json` y los previews. Blender termina con código 0
aunque el script falle: revisa la salida en busca de `Traceback`.
