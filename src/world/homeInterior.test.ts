import { describe, it, expect } from 'vitest';
import {
  BED_WAKE,
  canReachBed,
  canReachExit,
  FARMER_BED,
  HOME_INTERIOR as H,
  INTERIOR_COLLIDERS,
  INTERIOR_ENTRY,
  isIndoors,
} from './homeInterior';

// Media caja del granjero (playerView): colisiona a esta distancia del centro.
const MEDIA_CAJA = 0.35;

function chocaAlgo(x: number, z: number): boolean {
  return INTERIOR_COLLIDERS.some(
    (c) => Math.abs(x - c.cx) < c.w / 2 + MEDIA_CAJA && Math.abs(z - c.cz) < c.d / 2 + MEDIA_CAJA,
  );
}

// Recorre a pie la casa desde el felpudo en una rejilla fina: devuelve las celdas
// a las que se llega y todas las que tienen sitio para el granjero.
const PASO = 0.05;
function recorrerCasa(): { alcanzadas: Set<string>; libres: string[] } {
  const clave = (i: number, j: number) => `${i},${j}`;
  const mundo = (i: number, j: number) => [H.x + i * PASO, H.z + j * PASO] as const;
  const ni = Math.ceil(H.width / 2 / PASO);
  const nj = Math.ceil(H.depth / 2 / PASO);
  const libres: string[] = [];
  for (let i = -ni; i <= ni; i++) {
    for (let j = -nj; j <= nj; j++) {
      const [x, z] = mundo(i, j);
      if (!chocaAlgo(x, z)) libres.push(clave(i, j));
    }
  }
  const pendientes = [
    [Math.round((INTERIOR_ENTRY.x - H.x) / PASO), Math.round((INTERIOR_ENTRY.z - H.z) / PASO)],
  ];
  const alcanzadas = new Set<string>([clave(pendientes[0][0], pendientes[0][1])]);
  const libresSet = new Set(libres);
  while (pendientes.length) {
    const [i, j] = pendientes.pop()!;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = clave(i + di, j + dj);
      if (libresSet.has(k) && !alcanzadas.has(k)) {
        alcanzadas.add(k);
        pendientes.push([i + di, j + dj]);
      }
    }
  }
  return { alcanzadas, libres };
}

describe('interior de la casa del granjero', () => {
  // Puntos en coordenadas de generar.py (el juego refleja x y z)
  const llega = ({ alcanzadas }: ReturnType<typeof recorrerCasa>, bx: number, by: number) =>
    alcanzadas.has(`${Math.round(-bx / PASO)},${Math.round(-by / PASO)}`);

  it('todo el interior es transitable: no quedan huecos libres aislados', () => {
    const casa = recorrerCasa();
    const aisladas = casa.libres.filter((k) => !casa.alcanzadas.has(k));
    expect(aisladas).toEqual([]);
  });

  it('se llega a pie a las cuatro estancias y entre los muebles', () => {
    const casa = recorrerCasa();
    expect(llega(casa, -5.2, 1.5)).toBe(true); // dormitorio, a los pies de la cama
    expect(llega(casa, -7.35, -4.35)).toBe(true); // baño, dentro de la ducha
    expect(llega(casa, 3.6, 3.7)).toBe(true); // cocina, entre la isla y la encimera
    expect(llega(casa, 2.0, -0.5)).toBe(true); // salón
    expect(llega(casa, -0.15, -2.9)).toBe(true); // entre la mesa de centro y el sofá
    expect(llega(casa, 1, -4.6)).toBe(true); // detrás del sofá, junto al muro
    expect(llega(casa, 5.6, 1.3)).toBe(true); // entre la mesa de comer y la isla
  });

  it('distingue el interior del pueblo', () => {
    expect(isIndoors(H.x, H.z)).toBe(true);
    expect(isIndoors(INTERIOR_ENTRY.x, INTERIOR_ENTRY.z)).toBe(true);
    expect(isIndoors(0, 12)).toBe(false);
  });

  it('se aparece y se despierta en puntos libres', () => {
    expect(chocaAlgo(INTERIOR_ENTRY.x, INTERIOR_ENTRY.z)).toBe(false);
    expect(chocaAlgo(BED_WAKE.x, BED_WAKE.z)).toBe(false);
  });

  it('al entrar se puede salir, pero la cama queda lejos', () => {
    expect(canReachExit(INTERIOR_ENTRY.x, INTERIOR_ENTRY.z)).toBe(true);
    expect(canReachBed(INTERIOR_ENTRY.x, INTERIOR_ENTRY.z)).toBe(false);
  });

  it('se alcanza la cama pegado a su colisión y al despertar', () => {
    const cama = INTERIOR_COLLIDERS.find((c) => c.name === 'cama')!;
    const pegado = cama.cx - cama.w / 2 - MEDIA_CAJA - 0.01;
    expect(chocaAlgo(pegado, FARMER_BED.z)).toBe(false);
    expect(canReachBed(pegado, FARMER_BED.z)).toBe(true);
    expect(canReachBed(BED_WAKE.x, BED_WAKE.z)).toBe(true);
  });

  it('no se alcanza la cama desde otra estancia', () => {
    const tabique = INTERIOR_COLLIDERS.find((c) => c.name === 'tabiqueDormitorio')!;
    expect(canReachBed(tabique.cx - tabique.w / 2 - MEDIA_CAJA, FARMER_BED.z)).toBe(false);
    const banoNorte = H.z + 0.1 + MEDIA_CAJA;
    expect(canReachBed(FARMER_BED.x, banoNorte)).toBe(false);
  });

  it('los muros encierran toda la casa', () => {
    const hw = H.width / 2;
    const hd = H.depth / 2;
    expect(chocaAlgo(H.x + hw, H.z)).toBe(true);
    expect(chocaAlgo(H.x - hw, H.z)).toBe(true);
    expect(chocaAlgo(H.x, H.z + hd)).toBe(true);
    expect(chocaAlgo(H.x, H.z - hd)).toBe(true);
  });
});
