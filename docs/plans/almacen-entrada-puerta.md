# Plan: Entrar al almacén solo por la puerta

Rama: `feature/almacen-entrada-puerta`.

## Problema

La colisión del almacén es una caja maciza de 2,5×2,4×2,5 centrada en
`(13.5, 5)`, pero el GLB no está centrado en su origen: tras escalarlo y
girarlo ocupa x 11,44–13,5 y z 3,90–6,10. La caja cubre x 12,25–14,75, así que:

- la mitad oeste del edificio (la de la puerta, x 11,44–12,25) no tiene
  colisión y el granjero se mete en las paredes desde el norte, el sur o el
  oeste;
- al este del edificio hay ~1,25 m de terreno vacío por el que no se puede
  pasar.

## Lo que medimos del GLB

Muestreando los vértices a la altura del jugador (y 0,1–1,0):

- El modelo es **hueco**: paredes de ~0,15 m y el interior vacío
  (≈1,6 m en x × 1,8 m en z).
- La puerta está en la pared oeste, centrada en z≈5 y con ~1,2 m de ancho
  (z 4,4–5,6), con el marco un poco adelantado. La hoja de la puerta está
  modelada **cerrada**, así que no se puede abrir: no hay malla separada.

## Propuesta

Solo vista (`src/world/worldView.ts`), sin dominio ni datos nuevos.

1. **Centrar el modelo**: en `_loadStorage`, centrar el GLB en el root por
   su caja envolvente (además de apoyarlo en el suelo), para que el modelo,
   las primitivas de respaldo y la colisión compartan centro `(13.5, 5)`.
2. **Colisión por paredes en lugar de caja maciza**: sustituir `storageHit`
   por cuatro paredes invisibles con impostor de masa 0, colgadas de la
   misma geometría que el modelo (≈2,1×2,2 de planta):
   - pared trasera (este) y laterales (norte y sur) completas;
   - pared de la puerta (oeste) en dos tramos, dejando un hueco de ~1,1 m
     centrado en la puerta (el jugador mide 0,7 m de ancho).
   Así solo se puede entrar y salir por la puerta.
3. **Ver al granjero dentro**: con la cámara isométrica, el tejado taparía al
   jugador dentro. Mientras el jugador esté dentro de la planta del almacén,
   aplicar un plano de corte (`clipPlane`) al material del almacén a ~1,3 m
   de altura, de modo que se vea el interior en corte; al salir se quita.
   Esto exige que `WorldView` exponga un método (`updateStorageCutaway(x, z)`
   o similar) que `main.ts` llame en el game loop con la posición del
   jugador, igual que hace con el resto de vistas. La comprobación es
   geométrica (vista), no una regla de juego.
4. **Hoja de la puerta**: como está modelada cerrada, al cruzarla el
   granjero la atraviesa visualmente durante un instante. El plano de corte
   del punto 3 se activa ya en el umbral, así que la puerta desaparece justo
   cuando el jugador la cruza.
5. **Primitivas de respaldo**: la base maciza se cambia por cuatro paredes
   con hueco de puerta, para que el fallback sea coherente con la colisión.

## Fuera de alcance

- Abrir o animar la puerta (requeriría separar la hoja en el GLB con
  Blender).
- Cualquier mecánica dentro del almacén (inventario, cofre…).

## Verificación

- `pnpm verify` en verde (no hay lógica de dominio nueva, así que no hay
  tests nuevos).
- A mano en el navegador: el granjero choca con las paredes norte, sur y
  este y con los tramos de la pared oeste; entra y sale por la puerta; se
  ve dentro gracias al corte; el puesto de ventas sigue accesible.
