import { describe, it, expect } from 'vitest';
import { rectsOverlap } from './farmLayout';
import {
  keeperSpot,
  MARKET_ZONE,
  SHOP_INTERIOR,
  SHOPS,
  shopAtDoor,
  shopColliders,
  shopDoorSpot,
  shopEntry,
  shopExitAt,
  shopInside,
  shopInteriorColliders,
  shopRect,
  type ShopDef,
} from './marketLayout';
import { TREE_SPOTS } from './treeSpots';
import { NPC_DEFS } from '../../data/npcs';
import { CONFIG } from '../core/constants';

// Calles: la norte-sur (x ∈ [-1.1, 1.1]) y la este-oeste (z ∈ [-5.1, -2.9])
const CALLE_NS = { minX: -1.1, maxX: 1.1, minZ: -28, maxZ: 15 };
const CALLE_EO = { minX: -16, maxX: 25, minZ: -5.1, maxZ: -2.9 };

// Media caja del granjero (playerView): colisiona a esta distancia del centro.
const MEDIA_CAJA = 0.35;

type Caja = { cx: number; cz: number; w: number; d: number };
const choca = (cajas: Caja[], x: number, z: number) =>
  cajas.some(
    (c) => Math.abs(x - c.cx) < c.w / 2 + MEDIA_CAJA && Math.abs(z - c.cz) < c.d / 2 + MEDIA_CAJA,
  );

// Recorre a pie el interior desde el felpudo en una rejilla fina
const PASO = 0.05;
function recorrer(s: ShopDef) {
  const cajas = shopInteriorColliders(s);
  const clave = (i: number, j: number) => `${i},${j}`;
  // La rejilla pasa de los muros: si hubiera un hueco, el recorrido saldría fuera
  const ni = Math.ceil((SHOP_INTERIOR.width / 2 + 1.5) / PASO);
  const nj = Math.ceil((SHOP_INTERIOR.depth / 2 + 1.5) / PASO);
  const libres = new Set<string>();
  for (let i = -ni; i <= ni; i++) {
    for (let j = -nj; j <= nj; j++) {
      if (!choca(cajas, s.inside.x + i * PASO, s.inside.z + j * PASO)) libres.add(clave(i, j));
    }
  }
  const e = shopEntry(s);
  const inicio = [Math.round((e.x - s.inside.x) / PASO), Math.round((e.z - s.inside.z) / PASO)];
  const alcanzadas = new Set([clave(inicio[0], inicio[1])]);
  const pendientes = [inicio];
  while (pendientes.length) {
    const [i, j] = pendientes.pop()!;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = clave(i + di, j + dj);
      if (libres.has(k) && !alcanzadas.has(k)) {
        alcanzadas.add(k);
        pendientes.push([i + di, j + dj]);
      }
    }
  }
  // Celda de un punto en coordenadas de generar.py (el juego refleja x y z)
  const llega = (bx: number, by: number) =>
    alcanzadas.has(clave(Math.round(-bx / PASO), Math.round(-by / PASO)));
  return { libres, alcanzadas, llega };
}

describe('mercado: exteriores', () => {
  const edificios = SHOPS.map((s) => ({ nombre: s.kind, rect: shopRect(s) }));

  it('las tiendas no se pisan ni invaden las calles', () => {
    edificios.forEach((a, i) => {
      for (const b of edificios.slice(i + 1)) {
        expect([a.nombre, b.nombre, rectsOverlap(a.rect, b.rect)]).toEqual([
          a.nombre,
          b.nombre,
          false,
        ]);
      }
      for (const calle of [CALLE_NS, CALLE_EO]) {
        expect([a.nombre, rectsOverlap(a.rect, calle)]).toEqual([a.nombre, false]);
      }
    });
  });

  it('todo cabe en la zona del mercado y ningún árbol cae encima', () => {
    const z = MARKET_ZONE;
    for (const { nombre, rect: r } of edificios) {
      const dentro = r.minX >= z.minX && r.maxX <= z.maxX && r.minZ >= z.minZ && r.maxZ <= z.maxZ;
      expect([nombre, dentro]).toEqual([nombre, true]);
      for (const [x, tz] of TREE_SPOTS) {
        const pisa = x > r.minX - 1 && x < r.maxX + 1 && tz > r.minZ - 1 && tz < r.maxZ + 1;
        expect([nombre, x, tz, pisa]).toEqual([nombre, x, tz, false]);
      }
    }
  });

  it('a la puerta se llega desde la calle y desde ahí se entra', () => {
    for (const s of SHOPS) {
      const p = shopDoorSpot(s);
      expect([s.kind, choca(shopColliders(s), p.x, p.z)]).toEqual([s.kind, false]);
      expect(shopAtDoor(p.x, p.z)).toBe(s);
      // Recto hacia el camino no hay nada en medio
      for (let z = p.z; z < CALLE_EO.minZ + 0.5; z += 0.05) {
        expect([s.kind, z, choca(shopColliders(s), p.x, z)]).toEqual([s.kind, z, false]);
      }
    }
    expect(shopAtDoor(SHOPS[0].x + 2, SHOPS[0].z + 2.6)).toBeNull();
  });
});

describe('mercado: interiores', () => {
  it('los interiores no se solapan entre sí ni con el pueblo', () => {
    for (const s of SHOPS) {
      expect(Math.max(Math.abs(s.inside.x), Math.abs(s.inside.z))).toBeGreaterThan(100);
      expect(shopInside(s.inside.x, s.inside.z)).toBe(s);
    }
    expect(new Set(SHOPS.map((s) => `${s.inside.x},${s.inside.z}`)).size).toBe(SHOPS.length);
    expect(shopInside(SHOPS[0].x, SHOPS[0].z)).toBeNull();
  });

  it('se recorre entera salvo la trastienda, que queda cerrada', () => {
    for (const s of SHOPS) {
      const { libres, alcanzadas, llega } = recorrer(s);
      const dentro = (k: string) => {
        const [i, j] = k.split(',').map(Number);
        const { width, depth } = SHOP_INTERIOR;
        return Math.abs(i * PASO) < width / 2 && Math.abs(j * PASO) < depth / 2;
      };
      const aisladas = [...libres].filter((k) => dentro(k) && !alcanzadas.has(k));
      for (const k of aisladas) {
        const [i, j] = k.split(',').map(Number);
        const [bx, by] = [-i * PASO, -j * PASO]; // de vuelta a coordenadas de Blender
        const enTrastienda = Math.abs(bx) < 3 && by > 1.5 && by < 3.05;
        expect([s.kind, bx, by, enTrastienda]).toEqual([s.kind, bx, by, true]);
      }
      expect(llega(0, 0.3)).toBe(true); // ante el mostrador
      expect(llega(-2.8, -2.5)).toBe(true); // delante de las mesas
      expect(llega(-3.6, 1.0)).toBe(true); // junto al género del lateral
      expect(llega(0, 2.3)).toBe(false); // la trastienda
    }
  });

  it('el tendero atiende tras el mostrador y se le habla desde delante', () => {
    for (const s of SHOPS) {
      const npc = NPC_DEFS.find((n) => n.id === s.keeper);
      expect(npc?.shop).toBe(s.kind);
      expect(npc?.home).toEqual(keeperSpot(s));
      expect(npc?.waypoints).toBeNull();
      const k = keeperSpot(s);
      const cliente = { x: s.inside.x, z: s.inside.z - 0.3 };
      expect(Math.hypot(k.x - cliente.x, k.z - cliente.z)).toBeLessThan(CONFIG.interactionRadius);
    }
  });

  it('no se puede salir andando por la puerta ni por ningún lado', () => {
    for (const s of SHOPS) {
      const { alcanzadas } = recorrer(s);
      const { width, depth } = SHOP_INTERIOR;
      for (const k of alcanzadas) {
        const [i, j] = k.split(',').map(Number);
        expect([s.kind, Math.abs(i * PASO) < width / 2, Math.abs(j * PASO) < depth / 2]).toEqual([
          s.kind,
          true,
          true,
        ]);
      }
    }
  });

  it('desde el felpudo se puede salir', () => {
    for (const s of SHOPS) {
      const e = shopEntry(s);
      expect(shopExitAt(e.x, e.z)).toBe(s);
      expect(shopExitAt(keeperSpot(s).x, keeperSpot(s).z)).toBeNull();
    }
  });
});
