# Interiores de las tiendas del mercado

Interior de 10 × 7 m en forma de diorama, como el de la casa: sin techo y con
el muro de la puerta bajo para que la cámara vea dentro. Las tres tiendas
comparten planta y colisiones; cambian colores y género (`../tiendas/piezas.py`).

| Zona | Contenido |
| --- | --- |
| Mostrador | De lado a lado de la trastienda, con caja, balanza, lámparas colgadas y género |
| Trastienda | Cerrada por dos tabiques bajos: ahí atiende el tendero |
| Fondo | Estantería corrida con tres baldas llenas y remate |
| Sala | Dos mesas con género, barriles junto a la trastienda y género a lo largo de los laterales |
| Laterales | Una ventana en cada uno |

Todo el suelo libre salvo la trastienda es transitable:
`src/world/marketLayout.test.ts` recorre la planta desde el felpudo y falla si
queda algún hueco aislado fuera de ella.

Materiales: `M_Tienda`, `M_Cristal`, `M_Farol` (las lámparas) y `M_Suelo`, con
la textura de tarima de `assets/casa_interior/suelo.png` (ComfyUI) reducida a
512 px. Escala métrica, suelo en z=0 y puerta en -Y de Blender (+Z en Babylon,
con x reflejada). `ShopInteriorView` coloca cada uno lejos del pueblo, sin
reescalar, con las colisiones de `src/world/marketLayout.ts`: **si mueves un
mueble aquí, actualiza también ese archivo**.

## Reproducir desde la raíz del repositorio

```bash
blender --background --factory-startup --python assets/tienda_interior/generar.py
```

Genera `assets/tienda_interior.blend`, los GLB fuente en `assets/`, sus copias
en `public/models/`, `metricas.json` y `preview_*.png`.
