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
| Granja completa, dentro de la valla | 1,6 a 31 | -2,5 a 25 |
| Entrada, arco en la valla oeste (postes) | 1,6 | 11,85 y 15,35 |
| Cercado de ovejas | 1,6 a 5,7 | -2,5 a 6,3 |
| Cercado de vacas | 5,7 a 10,6 | -2,5 a 6,3 |
| Cercado de gallinas | 10,6 a 16,6 | -2,5 a 6,3 |
| Zona de cosecha (parcela centrada) | 16,6 a 30 | -2,5 a 6,3 |
| Almacén, centro | 25,7 | 8,6 |
| Casa del granjero, centro | 25,5 | 21,5 |
| Pozo | 13 | 13,5 |
| Puesto de ventas, centro | 5 | 23,2 |

## Decisiones

- La granja se valla entera con un único paso, un arco de madera (`assets/entrada_granja/`)
  al que llega la calle, prolongada para cruzarlo. Donde hay un cercado, su valla hace de
  valla de la granja, sin duplicarla.
- El letrero va sobre la cumbrera, en el plano del arco y de cara a la calle, para que lo
  vea quien llega por ella.
- La casa se gira para que su puerta y su porche miren al oeste, hacia la entrada.
- El mostrador del puesto de ventas mira al norte, hacia el camino de la entrada: al
  oeste y al sur tiene la valla.
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
