import { describe, it, expect } from 'vitest';
import { rectsOverlap } from './farmLayout';
import {
  GON_LOT,
  HOUSE_MODELS,
  houseFootprint,
  LOTS,
  NEIGHBORHOOD_HOUSES,
  NEIGHBORHOOD_LANES,
  NEIGHBORHOOD_ZONE,
  placeHouses,
} from './neighborhoodLayout';
import { TREE_SPOTS } from './treeSpots';
import { NPC_DEFS } from '../../data/npcs';
import { CONFIG } from '../core/constants';

// Media caja del granjero (playerView): colisiona a esta distancia del centro.
const MEDIA_CAJA = 0.35;
const dentro = (
  r: { minX: number; maxX: number; minZ: number; maxZ: number },
  z = NEIGHBORHOOD_ZONE,
) =>
  r.minX >= z.minX - 1e-9 &&
  r.maxX <= z.maxX + 1e-9 &&
  r.minZ >= z.minZ - 1e-9 &&
  r.maxZ <= z.maxZ + 1e-9;

describe('barrio de los vecinos', () => {
  it('5 columnas × 3 filas de parcelas y 2 calles, sin solaparse y dentro del mapa', () => {
    expect(LOTS).toHaveLength(15);
    const piezas = [...LOTS.map((l) => l.rect), ...NEIGHBORHOOD_LANES];
    for (const [i, a] of piezas.entries()) {
      expect(dentro(a)).toBe(true);
      for (const b of piezas.slice(i + 1)) expect(rectsOverlap(a, b)).toBe(false);
    }
    expect(NEIGHBORHOOD_ZONE.minX).toBeGreaterThan(-CONFIG.groundSize / 2);
    expect(NEIGHBORHOOD_ZONE.minZ).toBeGreaterThan(-CONFIG.groundSize / 2);
  });

  it('cada fila da a una calle: el camino este-oeste o una calle del barrio', () => {
    const bordes = [NEIGHBORHOOD_ZONE.maxZ, ...NEIGHBORHOOD_LANES.map((c) => c.minZ)];
    for (const l of LOTS) expect(bordes).toContain(l.frontZ);
    // Las calles empiezan en el camino norte-sur
    for (const c of NEIGHBORHOOD_LANES) expect(c.maxX).toBe(NEIGHBORHOOD_ZONE.maxX);
  });

  it('el reparto es fijo: misma semilla, mismo barrio', () => {
    const otra = placeHouses();
    expect(otra.map((h) => [h.model?.file, h.mirrored])).toEqual(
      NEIGHBORHOOD_HOUSES.map((h) => [h.model?.file, h.mirrored]),
    );
  });

  it('Gon conserva su parcela y las 5 casas salen al menos dos veces', () => {
    const gon = NEIGHBORHOOD_HOUSES.filter((h) => h.model === null);
    expect(gon.map((h) => [h.lot.row, h.lot.col])).toEqual([[GON_LOT.row, GON_LOT.col]]);
    for (const m of HOUSE_MODELS) {
      expect(NEIGHBORHOOD_HOUSES.filter((h) => h.model === m).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('dos casas iguales no quedan juntas en la misma fila', () => {
    for (const h of NEIGHBORHOOD_HOUSES) {
      const vecina = NEIGHBORHOOD_HOUSES.find(
        (o) => o.lot.row === h.lot.row && o.lot.col === h.lot.col + 1,
      );
      if (vecina && h.model) expect(vecina.model).not.toBe(h.model);
    }
  });

  it('cada casa cabe en su parcela y deja jardín delante de la puerta', () => {
    for (const h of NEIGHBORHOOD_HOUSES) {
      const f = houseFootprint(h);
      expect([h.lot.row, h.lot.col, dentro(f, h.lot.rect)]).toEqual([h.lot.row, h.lot.col, true]);
      expect(h.lot.frontZ - f.maxZ).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('ningún árbol ni vecino cae encima de una casa', () => {
    for (const h of NEIGHBORHOOD_HOUSES) {
      const f = houseFootprint(h);
      for (const [x, z] of TREE_SPOTS) {
        const pisa = x > f.minX - 1 && x < f.maxX + 1 && z > f.minZ - 1 && z < f.maxZ + 1;
        expect([x, z, pisa]).toEqual([x, z, false]);
      }
      const c = h.collider;
      for (const npc of NPC_DEFS) {
        for (const [x, z] of [[npc.home.x, npc.home.z], ...(npc.waypoints ?? [])]) {
          const choca =
            Math.abs(x - c.cx) < c.w / 2 + MEDIA_CAJA && Math.abs(z - c.cz) < c.d / 2 + MEDIA_CAJA;
          expect([npc.id, x, z, choca]).toEqual([npc.id, x, z, false]);
        }
      }
    }
  });
});
