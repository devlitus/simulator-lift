import { describe, it, expect } from 'vitest';
import { ANIMALS, PENS } from '../../data/animals';
import { FARM_CONFIG } from '../../data/farm';
import { CONFIG } from '../core/constants';
import { DOOR_SPOT, FARMER_HOUSE, PORCH } from './farmerPorch';
import {
  ENTRANCE_PATH,
  FARM_ENTRANCE,
  FARM_ENTRANCE_SOLIDS,
  FARM_FENCE,
  FARM_ZONE,
  rectsOverlap,
  SALES_POINT,
  SALES_STAND,
  WELL,
  type Rect,
} from './farmLayout';
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
  minX: PORCH.stepFrontX,
  maxX: FARMER_HOUSE.x + FARMER_HOUSE.depth / 2,
  minZ: FARMER_HOUSE.z - (FARMER_HOUSE.width + 1.4) / 2,
  maxZ: FARMER_HOUSE.z + (FARMER_HOUSE.width + 1.4) / 2,
};

// Vallas, en tramos [x1, z1, x2, z2]: las de la granja, las del arco y las de los cercados
const VALLAS = [
  ...FARM_FENCE,
  ...FARM_ENTRANCE_SOLIDS.map((c): [number, number, number, number] => [
    c.cx - c.w / 2,
    c.cz - c.d / 2,
    c.cx + c.w / 2,
    c.cz + c.d / 2,
  ]),
  ...Object.values(PENS).flatMap((p): [number, number, number, number][] => [
    [p.x1, p.z1, p.x2, p.z1],
    [p.x1, p.z2, p.gateX1, p.z2],
    [p.gateX2, p.z2, p.x2, p.z2],
    [p.x1, p.z1, p.x1, p.z2],
    [p.x2, p.z1, p.x2, p.z2],
  ]),
];

// Recorre el mapa a pie desde (x, z), con el granjero de 0,35 de medio lado y la
// valla de 0,1: devuelve si llega al destino.
const PASO = 0.2;
function llegaA(desde: number[], hasta: number[], vallas = VALLAS): boolean {
  const choca = (x: number, z: number) =>
    vallas.some(
      ([x1, z1, x2, z2]) =>
        x > Math.min(x1, x2) - 0.45 &&
        x < Math.max(x1, x2) + 0.45 &&
        z > Math.min(z1, z2) - 0.45 &&
        z < Math.max(z1, z2) + 0.45,
    );
  const mitad = CONFIG.groundSize / 2;
  const celda = (v: number) => Math.round(v / PASO);
  const visto = new Set<string>();
  const pendientes = [[celda(desde[0]), celda(desde[1])]];
  while (pendientes.length) {
    const [i, j] = pendientes.pop()!;
    const clave = `${i},${j}`;
    if (visto.has(clave)) continue;
    visto.add(clave);
    if (i === celda(hasta[0]) && j === celda(hasta[1])) return true;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = (i + di) * PASO;
      const z = (j + dj) * PASO;
      if (Math.abs(x) < mitad && Math.abs(z) < mitad && !choca(x, z)) {
        pendientes.push([i + di, j + dj]);
      }
    }
  }
  return false;
}

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

  describe('valla de la granja', () => {
    const CALLE = [0, 10];
    const ENTRADA = [FARM_ZONE.minX, (FARM_ENTRANCE.z1 + FARM_ENTRANCE.z2) / 2];
    const TAPON: [number, number, number, number] = [
      FARM_ZONE.minX,
      FARM_ENTRANCE.z1,
      FARM_ZONE.minX,
      FARM_ENTRANCE.z2,
    ];

    it('desde la calle se llega a toda la granja por la entrada', () => {
      expect(llegaA(CALLE, ENTRADA)).toBe(true);
      expect(llegaA(CALLE, [15, 20])).toBe(true); // en mitad de la granja
      expect(llegaA(CALLE, [DOOR_SPOT.x, DOOR_SPOT.z])).toBe(true);
      expect(llegaA(CALLE, [SALES_POINT.x, SALES_POINT.z])).toBe(true);
      expect(llegaA(CALLE, [STORAGE_DOOR_SPOT.x, STORAGE_DOOR_SPOT.z])).toBe(true);
    });

    it('no hay otra entrada: cerrándola, la granja queda aislada', () => {
      const cerrada = [...VALLAS, TAPON];
      expect(llegaA(CALLE, [15, 20], cerrada)).toBe(false);
      expect(llegaA(CALLE, [SALES_POINT.x, SALES_POINT.z], cerrada)).toBe(false);
    });

    it('a cada cercado se entra por su puerta, desde dentro de la granja', () => {
      for (const p of Object.values(PENS)) {
        expect(llegaA(ENTRADA, [(p.x1 + p.x2) / 2, (p.z1 + p.z2) / 2])).toBe(true);
      }
    });

    it('el camino cruza el arco entre sus dos hojas', () => {
      const hojas = FARM_ENTRANCE_SOLIDS.filter((c) => c.w > 1);
      expect(hojas).toHaveLength(2);
      const [norte, sur] = hojas.map((h) => h.cz).sort((a, b) => a - b);
      expect(ENTRANCE_PATH.minZ).toBeGreaterThan(norte);
      expect(ENTRANCE_PATH.maxZ).toBeLessThan(sur);
      expect(ENTRANCE_PATH.minX).toBeLessThan(FARM_ENTRANCE.x);
      expect(ENTRANCE_PATH.maxX).toBeGreaterThan(FARM_ENTRANCE.x);
    });

    it('el granjero cabe de sobra entre las hojas', () => {
      const [norte, sur] = FARM_ENTRANCE_SOLIDS.filter((c) => c.w > 1)
        .map((h) => h.cz)
        .sort((a, b) => a - b);
      expect(sur - norte - 0.1).toBeGreaterThan(2.5);
    });
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
