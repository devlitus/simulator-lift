# Flores del jardín de Lila

Tres variantes estáticas low-poly creadas con el script reproducible
`generar_modelos.py`: margarita, tulipán coral y lavanda. Cada una usa una
textura raster de 8×8 píxeles de dos tonos, empaquetada dentro del GLB, para
que no existan rutas de texturas externas durante la carga en Babylon.

La referencia con ComfyUI no pudo generarse en esta sesión: la conexión WSL a
la instancia Windows falla antes de abrir un puerto. El script deja fuentes
Blender editables en `assets/flor_*.blend`, exporta los GLB fuente a
`assets/models/` y copia los artefactos servidos a `public/models/`.
