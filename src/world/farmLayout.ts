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

/** Terreno de la granja: aquí no se siembran rocas ni arbustos. */
export const FARM_ZONE: Rect = { minX: 1.5, maxX: 30, minZ: -2.5, maxZ: 20 };

export const WELL = { x: 13, z: 13.5 };

/** Centro del puesto de ventas, con el mostrador mirando al oeste, hacia la calle. */
export const SALES_STAND = { x: 4.3, z: 17.8 };

/** Punto de venta: delante del mostrador. */
export const SALES_POINT = { x: SALES_STAND.x - 1.9, z: SALES_STAND.z };

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}
