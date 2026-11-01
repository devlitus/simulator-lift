# Plan: barrio de los vecinos

Rama: `feature/zona-vecinos`. Zona de casas en el cuadrante noroeste del
pueblo, entre el camino norte-sur, el este-oeste y el borde del mapa.

## Decisiones (acordadas con el usuario)

- **5 columnas × 3 filas** de parcelas (5,94 × 6,6 m) en
  x ∈ [-30,8, -1,1], z ∈ [-29,3, -5,1], alineadas con la rejilla de baldosas.
- **Las 15 parcelas ocupadas**, con 5 modelos de casa distintos repetidos.
- **Azar fijo en el código** (semilla `NEIGHBORHOOD_SEED`): igual en cada
  carga y para todos; sin dos casas iguales juntas en una fila y con espejo
  al azar para variar el lado de la puerta.
- **Casa de Gon en una parcela fija** (fila 0, columna 2); Gon patrulla por
  el camino delante de su forja.
- **Calles entre filas**: dos calles este-oeste de 2,2 m unidas al camino
  norte-sur, con el mismo empedrado; el camino este-oeste se prolonga hasta
  el final del barrio. Cada fila mira a la calle que tiene al sur.

## Pasos

1. `assets/casas_vecinos/generar.py`: cinco casas procedurales en Blender
   (cabaña, encalada, entramado, piedra con paja, porche azul).
2. `src/world/neighborhoodLayout.ts` (puro): zona, parcelas, calles,
   modelos con su huella y el reparto con semilla. Tests en
   `neighborhoodLayout.test.ts`.
3. `WorldView`: calles y camino prolongado (tierra y baldosas), casa de Gon
   en su parcela, `buildNeighborhood` (un GLB por modelo clonado en sus
   parcelas, colisión del cuerpo, primitivas de respaldo, luces de noche).
4. `SceneryView`: sin decoración sobre calles, casas y jardines delanteros.
5. Datos: fuera los dos árboles que caían en la zona; nueva patrulla de Gon.

## Criterios de aceptación

- Las 14 casas cargan su modelo y la de Gon sigue en su parcela.
- Cada casa cabe en su parcela, con jardín delante de la puerta.
- Ningún árbol ni ruta de NPC cae sobre una casa.
- `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
