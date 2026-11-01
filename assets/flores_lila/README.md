# Flores del jardín de Lila

Cinco variantes estáticas low-poly: margarita, tulipán coral, lavanda, amapola
roja y campanillas azules. Las
referencias se generan con Z-Image-Turbo en la instancia ComfyUI nativa de
WSL, con una ejecución por variedad y los workflows API guardados aquí.

Los GLB resultantes se limpian en Blender, se guardan como fuentes editables
en `assets/flor_*.blend`, se exportan a `assets/models/` y se copian a
`public/models/` para Babylon.

`generar_modelos_hunyuan.py` usa Hunyuan3D-2mini local con eliminación de
islas y caras degeneradas, límite de 12.000 caras y textura PBR embebida.
