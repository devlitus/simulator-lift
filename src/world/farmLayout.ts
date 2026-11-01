// Distribución de la granja (sin Babylon), al sureste del cruce de caminos: los
// cercados (data/animals.ts) y la parcela (data/farm.ts) en una franja junto al
// camino este-oeste y, debajo, el almacén (warehouse.ts), la casa (farmerPorch.ts),
// el pozo y el puesto de ventas. Ver docs/plans/distribucion-granja.md.

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Terreno de la granja, dentro de su valla: aquí no se siembran rocas ni arbustos. */
export const FARM_ZONE: Rect = { minX: 1.6, maxX: 31, minZ: -2.5, maxZ: 25 };

/**
 * Único paso de la valla, en el lado de la calle: el arco de assets/entrada_granja/.
 * z1 y z2 son sus dos postes, donde termina cada tramo de valla.
 */
export const FARM_ENTRANCE = {
  x: FARM_ZONE.minX,
  z: 13.6,
  z1: 11.85,
  z2: 15.35,
  signY: 4.35, // altura del letrero
};

/** Colisiones del arco: postes, hojas abiertas hacia dentro y jardineras. */
export const FARM_ENTRANCE_SOLIDS = [
  ...[FARM_ENTRANCE.z1, FARM_ENTRANCE.z2].map((cz) => ({
    cx: FARM_ENTRANCE.x,
    cz,
    w: 0.6,
    d: 0.6,
  })),
  ...[-1, 1].flatMap((lado) => [
    { cx: FARM_ENTRANCE.x + 0.875, cz: FARM_ENTRANCE.z + lado * 1.55, w: 1.45, d: 0.1 },
    { cx: FARM_ENTRANCE.x - 0.25, cz: FARM_ENTRANCE.z + lado * 2.3, w: 0.26, d: 0.72 },
  ]),
];

/** La calle se prolonga hasta el arco y lo cruza, en la rejilla de sus baldosas. */
export const STREET_END_Z = 14.7;
export const ENTRANCE_PATH: Rect = { minX: 1.1, maxX: 5.5, minZ: 12.5, maxZ: 14.7 };

// Lado de los cercados que ya hace de valla de la granja (data/animals.ts)
const PENS_SOUTH = 6.3;
const PENS_EAST = 16.6;

/** Tramos de la valla, [x1, z1, x2, z2]: lo que no cubren los cercados. */
export const FARM_FENCE: [number, number, number, number][] = [
  [PENS_EAST, FARM_ZONE.minZ, FARM_ZONE.maxX, FARM_ZONE.minZ], // norte
  [FARM_ZONE.maxX, FARM_ZONE.minZ, FARM_ZONE.maxX, FARM_ZONE.maxZ], // este
  [FARM_ZONE.minX, FARM_ZONE.maxZ, FARM_ZONE.maxX, FARM_ZONE.maxZ], // sur
  [FARM_ZONE.minX, PENS_SOUTH, FARM_ZONE.minX, FARM_ENTRANCE.z1], // oeste, sobre la entrada
  [FARM_ZONE.minX, FARM_ENTRANCE.z2, FARM_ZONE.minX, FARM_ZONE.maxZ], // oeste, bajo la entrada
];

export const WELL = { x: 13, z: 13.5 };

/** Centro del puesto de ventas, en la esquina suroeste, con el mostrador al norte (hacia el camino). */
export const SALES_STAND = { x: 5, z: 23.2 };

/** Punto de venta: delante del mostrador. */
export const SALES_POINT = { x: SALES_STAND.x, z: SALES_STAND.z - 1.9 };

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}
