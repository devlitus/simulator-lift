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

/** Único hueco de la valla, en el lado de la calle, justo donde esta termina. */
export const FARM_ENTRANCE = { z1: 12, z2: 17.6 };

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

/** Centro del puesto de ventas, en la esquina suroeste, con el mostrador hacia el este. */
export const SALES_STAND = { x: 5, z: 23.2 };

/** Punto de venta: delante del mostrador. */
export const SALES_POINT = { x: SALES_STAND.x + 1.9, z: SALES_STAND.z };

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}
