# Plan: escenario del entorno

## Objetivo

El mundo era un prado verde liso que terminaba en el vacío. Darle un
escenario: suelo con textura, decoración repartida por el prado, un borde
de mapa visible y un horizonte.

## Pasos

1. Texturas de césped y roca con ComfyUI (Z-Image-Turbo local) y script
   para hacerlas tileables; mapa de variación de color a gran escala.
2. Props low-poly modelados por script en Blender (rocas, arbustos, matas,
   flores, pinos, tramo de valla, colinas) exportados en un único GLB.
3. `SceneryView` (nueva vista en `src/world/`): coloca los props con thin
   instances de forma determinista, fuera de caminos, edificios, parcela,
   recinto, rutas de NPC y árboles; colisión en rocas grandes y arbustos.
4. `WorldView`: textura del terreno y niebla del color del cielo,
   sincronizada con el ciclo día/noche.
5. Verificación: `pnpm verify`, `pnpm build` y prueba visual en el navegador.

## Fuera de alcance

Sin cambios de dominio ni tests nuevos: es solo vista (ADR 0006). Las
texturas de los caminos y el suelo del recinto se mantienen.
