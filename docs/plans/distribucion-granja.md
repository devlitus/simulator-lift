# Plan: distribución de la granja

Rama: `feature/distribucion-granja`.
Estado: implementado y verificado (tests, lint, tipos, `pnpm build` y navegador).

## Objetivo

Reordenar la granja según el esquema dibujado sobre el juego, en la zona al sureste
del cruce de caminos.

## Distribución

Medida sobre la captura, corrigiendo la perspectiva de la cámara.

| Zona | x | z |
| --- | --- | --- |
| Granja completa | 1,5 a 30 | -2,5 a 20 |
| Cercado de ovejas | 1,6 a 5,7 | -2,5 a 6,3 |
| Cercado de vacas | 5,7 a 10,6 | -2,5 a 6,3 |
| Cercado de gallinas | 10,6 a 16,6 | -2,5 a 6,3 |
| Zona de cosecha (parcela centrada) | 16,6 a 30 | -2,5 a 6,3 |
| Almacén, centro | 25,7 | 8,6 |
| Casa del granjero, centro | 23 | 15 |
| Pozo | 13 | 13,5 |
| Puesto de ventas, centro | 4,3 | 17,8 |

## Decisiones

- Un cercado por especie en lugar del recinto común: `PENS` sustituye a `PEN` y cada
  animal pasea solo por el suyo. Comparten valla y la puerta da al sur, porque al norte
  está el camino y a los lados, otro cercado.
- La parcela conserva sus 24 surcos, para no romper partidas guardadas ni el balance.
- El almacén crece hasta ocupar su zona (de ~2 m a ~4 m de lado); el resto de edificios
  conserva su tamaño.
- Los tres árboles que caían dentro se mueven al oeste de la calle. En la granja no se
  siembran rocas ni arbustos, pero sí hierba y flores en los huecos libres.

## Verificación

`src/world/farmLayout.test.ts` (nada se pisa ni se sale), `pnpm build` y navegador.
