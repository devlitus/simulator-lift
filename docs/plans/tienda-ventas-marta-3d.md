# Plan: Tienda de ventas 3D de Marta

Rama: `feature/marta-sales-shop`.

## Objetivo

Sustituir la casa rosa generada con primitivas que representa la tienda de
Marta por un modelo GLB propio, texturizado y coherente con el pueblo. El
puesto de ventas del granjero (`puesto_ventas.glb`) no forma parte de este
cambio.

## Enfoque

1. Generar una referencia cuadrada de una tienda de semillas: edificio
   low-poly chibi, paredes rosadas, estructura y rótulo de madera, toldo de
   rayas y cajas de semillas, aislado sobre fondo liso.
2. Convertir la referencia a GLB con textura mediante Hunyuan3D local;
   limpiar la malla, conservar la isla principal, apoyar su base en el origen
   y guardar tanto el `.blend` editable como el GLB fuente.
3. Publicar `public/models/tienda_marta.glb` y cargarlo en `WorldView` en la
   posición actual de la tienda (`12, -8`). La escala y el apoyo se calcularán
   desde la caja envolvente real. Una colisión independiente y las primitivas
   actuales quedarán como respaldo ante un error de carga.
4. Documentar el activo y verificar el proyecto completo y la vista real en
   navegador.

## Criterios de aceptación

- La tienda de Marta ya no se representa con la casa rosa de primitivas cuando
  el GLB está disponible.
- El modelo tiene textura, está apoyado en el terreno y proyecta sombras.
- Si el GLB no se puede cargar, se conserva una tienda funcional y visible de
  respaldo, con su colisión.
- El almacén, el puesto de ventas del granjero y las otras casas no cambian.
- `pnpm verify` termina correctamente.
