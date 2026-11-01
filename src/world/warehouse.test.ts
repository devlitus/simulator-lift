import { describe, it, expect } from 'vitest';
import { ANIMALS } from '../../data/animals';
import { CROPS } from '../../data/crops';
import {
  canClimbDown,
  canClimbUp,
  canEnterStorage,
  canLeaveWarehouse,
  GROUND_COLLIDERS,
  isInWarehouse,
  isUnderLoft,
  LADDER_FOOT,
  LADDER_PATH,
  LADDER_TOP,
  LOFT,
  LOFT_COLLIDERS,
  LOFT_HEIGHT,
  pointOnPath,
  STORAGE,
  STORAGE_DOOR_SPOT,
  STORAGE_WALLS,
  WAREHOUSE as W,
  WAREHOUSE_ENTRY,
  WAREHOUSE_FEED_BAYS,
  WAREHOUSE_SHELVES,
  WAREHOUSE_WALLS,
  warehouseSpotAt,
} from './warehouse';

// Media caja del granjero (playerView): colisiona a esta distancia del centro.
const MEDIA_CAJA = 0.35;
const Y_ABAJO = 0.65;
const Y_ARRIBA = LOFT_HEIGHT + 0.65;

type Caja = { cx: number; cz: number; w: number; d: number };

const choca = (cajas: Caja[], x: number, z: number) =>
  cajas.some(
    (c) => Math.abs(x - c.cx) < c.w / 2 + MEDIA_CAJA && Math.abs(z - c.cz) < c.d / 2 + MEDIA_CAJA,
  );

const ABAJO = [...WAREHOUSE_WALLS, ...GROUND_COLLIDERS];
const ARRIBA = [...WAREHOUSE_WALLS, ...LOFT_COLLIDERS];

// Recorre un nivel a pie en una rejilla fina desde `inicio`, dentro de los límites
// de la planta (el altillo llega hasta su barandilla).
const PASO = 0.05;
function recorrer(
  cajas: Caja[],
  inicio: { x: number; z: number },
  dentro: (x: number, z: number) => boolean,
) {
  const clave = (i: number, j: number) => `${i},${j}`;
  const mundo = (i: number, j: number) => [W.x + i * PASO, W.z + j * PASO] as const;
  const ni = Math.ceil(W.width / 2 / PASO);
  const nj = Math.ceil(W.depth / 2 / PASO);
  const libres = new Set<string>();
  for (let i = -ni; i <= ni; i++) {
    for (let j = -nj; j <= nj; j++) {
      const [x, z] = mundo(i, j);
      if (dentro(x, z) && !choca(cajas, x, z)) libres.add(clave(i, j));
    }
  }
  const pendientes = [[Math.round((inicio.x - W.x) / PASO), Math.round((inicio.z - W.z) / PASO)]];
  const alcanzadas = new Set<string>([clave(pendientes[0][0], pendientes[0][1])]);
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
  const llega = (x: number, z: number) =>
    alcanzadas.has(clave(Math.round((x - W.x) / PASO), Math.round((z - W.z) / PASO)));
  return { alcanzadas, libres: [...libres], llega };
}

const plantaBaja = () => recorrer(ABAJO, WAREHOUSE_ENTRY, () => true);
const altillo = () => recorrer(ARRIBA, LADDER_TOP, (_x, z) => z < W.z);

describe('interior del almacén', () => {
  it('la planta baja es transitable: no quedan huecos libres aislados', () => {
    const p = plantaBaja();
    expect(p.libres.filter((k) => !p.alcanzadas.has(k))).toEqual([]);
  });

  it('el altillo es transitable: no quedan huecos libres aislados', () => {
    const p = altillo();
    expect(p.libres.filter((k) => !p.alcanzadas.has(k))).toEqual([]);
  });

  it('el altillo ocupa la mitad de la escena', () => {
    expect(LOFT.w * LOFT.d).toBe((W.width * W.depth) / 2);
  });

  it('cada cultivo y cada animal tienen su propia estantería', () => {
    const ids = (kind: string) => WAREHOUSE_SHELVES.filter((s) => s.kind === kind).map((s) => s.id);
    expect(ids('crop').sort()).toEqual(Object.keys(CROPS).sort());
    expect(ids('animal').sort()).toEqual(Object.keys(ANIMALS).sort());
  });

  it('cada animal tiene su box de pienso', () => {
    expect(WAREHOUSE_FEED_BAYS.map((b) => b.animal).sort()).toEqual(Object.keys(ANIMALS).sort());
  });

  it('se llega a pie a cada estantería desde su nivel y se reconoce su recurso', () => {
    const niveles = [plantaBaja(), altillo()];
    for (const s of WAREHOUSE_SHELVES) {
      const c = s.collider;
      const x = c.cx;
      const z = c.cz + c.d / 2 + MEDIA_CAJA + 0.05;
      expect(niveles[s.level].llega(x, z)).toBe(true);
      const y = s.level === 0 ? Y_ABAJO : Y_ARRIBA;
      expect(warehouseSpotAt(x, z, y)).toMatchObject({ type: 'shelf', id: s.id });
    }
  });

  it('una estantería de un nivel no responde desde el otro', () => {
    // Las estanterías de los dos niveles están una sobre otra
    const c = WAREHOUSE_SHELVES.find((s) => s.id === 'zanahoria')!.collider;
    const z = c.cz + c.d / 2 + 0.4;
    expect(warehouseSpotAt(c.cx, z, Y_ABAJO)).toMatchObject({ kind: 'crop', id: 'zanahoria' });
    expect(warehouseSpotAt(c.cx, z, Y_ARRIBA)).toMatchObject({ kind: 'animal', id: 'gallina' });
  });

  it('se entra a pie en cada box de pienso y se reconoce su animal', () => {
    const p = plantaBaja();
    for (const b of WAREHOUSE_FEED_BAYS) {
      const x = b.sacos.cx - b.sacos.w / 2 - MEDIA_CAJA - 0.05;
      expect(p.llega(x, b.cz)).toBe(true);
      expect(warehouseSpotAt(x, b.cz, Y_ABAJO)).toMatchObject({ type: 'feed', animal: b.animal });
    }
  });

  it('se puede pasar por detrás de la escalera, bajo el altillo', () => {
    const p = plantaBaja();
    expect(p.llega(LADDER_FOOT.x, W.z - 1)).toBe(true);
    expect(p.llega(W.x, W.z - 4)).toBe(true);
  });

  it('la escalera une los dos niveles y solo responde desde el suyo', () => {
    expect(choca(ABAJO, LADDER_FOOT.x, LADDER_FOOT.z)).toBe(false);
    expect(choca(ARRIBA, LADDER_TOP.x, LADDER_TOP.z)).toBe(false);
    expect(canClimbUp(LADDER_FOOT.x, LADDER_FOOT.z, Y_ABAJO)).toBe(true);
    expect(canClimbUp(LADDER_FOOT.x, LADDER_FOOT.z, Y_ARRIBA)).toBe(false);
    expect(canClimbDown(LADDER_TOP.x, LADDER_TOP.z, Y_ARRIBA)).toBe(true);
    expect(canClimbDown(LADDER_TOP.x, LADDER_TOP.z, Y_ABAJO)).toBe(false);
  });

  it('el recorrido de la escalera va del pie al altillo', () => {
    expect(pointOnPath(LADDER_PATH, 0)).toEqual(LADDER_PATH[0]);
    expect(pointOnPath(LADDER_PATH, 1)).toEqual(LADDER_PATH[LADDER_PATH.length - 1]);
    const medio = pointOnPath(LADDER_PATH, 0.5);
    expect(medio.y).toBeGreaterThan(LADDER_PATH[0].y);
    expect(medio.y).toBeLessThan(LADDER_PATH[2].y);
  });

  it('la barandilla impide caer del altillo salvo por la escalera', () => {
    const p = altillo();
    expect(p.llega(LADDER_TOP.x, W.z - MEDIA_CAJA - 0.15)).toBe(true);
    expect(p.llega(LADDER_TOP.x, W.z + 0.1)).toBe(false);
  });

  it('solo se está bajo el altillo en la planta baja y en la mitad del fondo', () => {
    expect(isUnderLoft(W.x, W.z - 1, Y_ABAJO)).toBe(true);
    expect(isUnderLoft(W.x, W.z - 1, Y_ARRIBA)).toBe(false);
    expect(isUnderLoft(W.x, W.z + 1, Y_ABAJO)).toBe(false);
  });

  it('al entrar se puede salir, y solo desde la planta baja', () => {
    expect(choca(ABAJO, WAREHOUSE_ENTRY.x, WAREHOUSE_ENTRY.z)).toBe(false);
    expect(isInWarehouse(WAREHOUSE_ENTRY.x, WAREHOUSE_ENTRY.z)).toBe(true);
    expect(canLeaveWarehouse(WAREHOUSE_ENTRY.x, WAREHOUSE_ENTRY.z, Y_ABAJO)).toBe(true);
    expect(canLeaveWarehouse(WAREHOUSE_ENTRY.x, WAREHOUSE_ENTRY.z, Y_ARRIBA)).toBe(false);
  });

  it('los muros encierran toda la planta', () => {
    const hw = W.width / 2;
    const hd = W.depth / 2;
    for (const [x, z] of [
      [W.x + hw, W.z],
      [W.x - hw, W.z],
      [W.x, W.z + hd],
      [W.x, W.z - hd],
    ]) {
      expect(choca(WAREHOUSE_WALLS, x, z)).toBe(true);
    }
  });
});

describe('fachada del almacén', () => {
  const oeste = STORAGE.x - STORAGE.width / 2;

  it('solo se entra frente a la puerta principal', () => {
    expect(canEnterStorage(STORAGE_DOOR_SPOT.x, STORAGE_DOOR_SPOT.z)).toBe(true);
    expect(canEnterStorage(oeste - MEDIA_CAJA, STORAGE.z)).toBe(true);
    // Lejos de la puerta, o por los otros lados del edificio
    expect(canEnterStorage(oeste - 2, STORAGE.z)).toBe(false);
    expect(canEnterStorage(oeste - MEDIA_CAJA, STORAGE.z + 1)).toBe(false);
    expect(canEnterStorage(STORAGE.x + STORAGE.width / 2 + MEDIA_CAJA, STORAGE.z)).toBe(false);
  });

  it('las paredes no dejan hueco: el muro de la puerta es macizo', () => {
    const paredes = STORAGE_WALLS.map((p) => ({ cx: p.px, cz: p.pz, w: p.w, d: p.d }));
    expect(choca(paredes, oeste, STORAGE.z)).toBe(true);
    expect(choca(paredes, STORAGE_DOOR_SPOT.x, STORAGE_DOOR_SPOT.z)).toBe(false);
  });

  it('el pueblo no cuenta como interior', () => {
    expect(isInWarehouse(STORAGE.x, STORAGE.z)).toBe(false);
  });
});
