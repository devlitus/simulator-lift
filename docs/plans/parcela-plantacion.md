# Parcela de plantación 3D

## Objetivo

Sustituir las cajas de tierra sin asset por un módulo 3D texturizado, reutilizado
en las 24 casillas actuales, sin cambiar la lógica, la interacción ni el guardado.

## Diseño

- Referencia generada con ComfyUI/Qwen Image 2512: tierra arada modular,
  bordes bajos de madera y detalles discretos, sin plantas para que los cultivos
  sigan representando con precisión su estado.
- Modelo propio y modular en Blender: 1,3 × 1,3 m, base en `y = 0`, materiales
  PBR horneados, menos de 2.000 triángulos y sin colisión (el jugador sigue
  caminando sobre los surcos).
- `FarmView` carga un GLB por casilla. Conserva cajas con materiales seco/mojado
  como fallback, por lo que el juego funciona aun si el asset o el cargador falla.

## Verificación

1. `pnpm verify`.
2. Navegador: parcela visible, textura húmeda tras regar y plantas/cosecha
   funcionando sobre cada casilla.
