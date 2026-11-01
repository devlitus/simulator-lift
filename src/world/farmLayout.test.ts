import { describe, it, expect } from 'vitest';
import { ANIMALS, PENS } from '../../data/animals';
import { FARM_CONFIG } from '../../data/farm';
import { CONFIG } from '../core/constants';
import { FARMER_HOUSE, PORCH } from './farmerPorch';
import { FARM_ZONE, rectsOverlap, SALES_POINT, SALES_STAND, WELL, type Rect } from './farmLayout';
import { STORAGE, STORAGE_DOOR_SPOT } from './warehouse';

const penRect = (id: string): Rect => {
  const p = PENS[id];
  return { minX: p.x1, maxX: p.x2, minZ: p.z1, maxZ: p.z2 };
};

const caja = (x: number, z: number, w: number, d: number): Rect => ({
  minX: x - w / 2,
  maxX: x + w / 2,
  minZ: z - d / 2,
  maxZ: z + d / 2,
});

const { origin, cols, rows, spacing, tileSize } = FARM_CONFIG;
const PARCELA: Rect = {
  minX: origin.x - tileSize / 2,
  maxX: origin.x + (cols - 1) * spacing + tileSize / 2,
  minZ: origin.z - tileSize / 2,
  maxZ: origin.z + (rows - 1) * spacing + tileSize / 2,
};

const CASA: Rect = {
  minX: FARMER_HOUSE.x - FARMER_HOUSE.width / 2,
  maxX: FARMER_HOUSE.x + FARMER_HOUSE.width / 2,
  minZ: FARMER_HOUSE.z - FARMER_HOUSE.depth / 2,
  maxZ: PORCH.stepFrontZ,
};

const ZONAS: Record<string, Rect> = {
  ...Object.fromEntries(Object.keys(PENS).map((id) => [`cercado de ${id}`, penRect(id)])),
  parcela: PARCELA,
  almacén: caja(STORAGE.x, STORAGE.z, STORAGE.width, STORAGE.depth),
  casa: CASA,
  pozo: caja(WELL.x, WELL.z, 2.5, 2.5),
  puesto: caja(SALES_STAND.x, SALES_STAND.z, 2, 2),
};

describe('distribución de la granja', () => {
  it('cada animal tiene su propio cercado', () => {
    expect(Object.keys(PENS).sort()).toEqual(Object.keys(ANIMALS).sort());
  });

  it('todo cabe en la granja y la granja cabe en el mapa', () => {
    const f = FARM_ZONE;
    for (const [nombre, r] of Object.entries(ZONAS)) {
      expect([nombre, r.minX >= f.minX && r.maxX <= f.maxX]).toEqual([nombre, true]);
      expect([nombre, r.minZ >= f.minZ && r.maxZ <= f.maxZ]).toEqual([nombre, true]);
    }
    const mitad = CONFIG.groundSize / 2;
    expect(Math.max(Math.abs(f.minX), Math.abs(f.maxX))).toBeLessThan(mitad);
    expect(Math.max(Math.abs(f.minZ), Math.abs(f.maxZ))).toBeLessThan(mitad);
  });

  it('ninguna zona pisa a otra', () => {
    const lista = Object.entries(ZONAS);
    for (const [i, [a, ra]] of lista.entries()) {
      for (const [b, rb] of lista.slice(i + 1)) {
        expect([a, b, rectsOverlap(ra, rb)]).toEqual([a, b, false]);
      }
    }
  });

  it('los cercados no invaden los caminos', () => {
    for (const id of Object.keys(PENS)) {
      const r = penRect(id);
      expect(r.minX).toBeGreaterThan(1.1); // calle norte-sur
      expect(r.minZ).toBeGreaterThan(-2.9); // camino este-oeste
    }
  });

  it('cada puerta de cercado da al sur, dentro de su lado', () => {
    for (const p of Object.values(PENS)) {
      expect(p.gateX1).toBeGreaterThan(p.x1);
      expect(p.gateX2).toBeLessThan(p.x2);
      expect(p.gateX2 - p.gateX1).toBeGreaterThan(1); // cabe el granjero
    }
  });

  it('los puntos de uso quedan libres', () => {
    const dentro = (r: Rect, x: number, z: number) =>
      x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
    for (const [nombre, r] of Object.entries(ZONAS)) {
      expect([nombre, dentro(r, STORAGE_DOOR_SPOT.x, STORAGE_DOOR_SPOT.z)]).toEqual([
        nombre,
        false,
      ]);
      expect([nombre, dentro(r, SALES_POINT.x, SALES_POINT.z)]).toEqual([nombre, false]);
    }
  });
});
