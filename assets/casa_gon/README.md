# Casa y forja de Gon

Edificio estático de piedra gris y madera con tejado de terracota, chimenea
y detalles de herrería. Sustituye la casa gris situada en (-14, -10).

## Generación

- Referencia: `../casa_gon_referencia.png`.
- Workflow local: `zimage_workflow.json`, template `image_z_image_turbo_int8`.
- Z-Image-Turbo INT8 ConvRot, Qwen3 4B FP8 mixed y VAE `ae.safetensors`.
- Imagen de 1024×1024, seed 14092026, 8 pasos, CFG 1,
  sampler `res_multistep`, scheduler `simple`.
- Hunyuan3D-2mini turbo con textura Hunyuan3D-2 y offload a CPU:
  octree 256, 20 pasos, guidance 5, seed predeterminada 1234,
  reducción previa al texturizado a 40.000 caras.

`limpiar.py` se ejecuta dentro de Blender sobre la malla recién importada:
soldadura de vértices, conservación de la isla principal, normales coherentes,
orientación vertical de -90°, centrado y base en z=0. Empaqueta las imágenes
en el `.blend` y exporta un GLB con la textura embebida.

## Archivos e integración

- Fuente editable: `../casa_gon.blend`.
- Exportación: `../models/casa_gon.glb`.
- Copia servida: `../../public/models/casa_gon.glb`.
- `WorldView` carga el edificio y lo escala con su caja envolvente real;
  conserva una colisión independiente y una casa gris de respaldo.

## Resultado

Malla de una única isla, 19.990 vértices tras soldar 6.351 duplicados y
40.000 triángulos. Textura de color de 2048×2048 embebida. Puerta hacia +z
en el juego; altura 4,8 m y huella aproximada de 3,96×4,07 m.

Se verificó en el navegador el apoyo en el suelo, la textura, la orientación
y la colisión tanto con el GLB cargado como con el respaldo por fallo de
carga. El modelo no necesita rig ni animaciones.
