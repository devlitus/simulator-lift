import { describe, it, expect } from 'vitest';
import { createWalker, stepWalker, YIELD_MAX, YIELD_RADIUS, type Point } from './villagerRoute';
import { VILLAGERS } from '../../data/villagers';
import { NEIGHBORHOOD_LANES } from '../world/neighborhoodLayout';
import { STREET_END_Z, ENTRANCE_PATH } from '../world/farmLayout';
import { SHOPS } from '../world/marketLayout';

const CUADRADO: Point[] = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
];

describe('stepWalker', () => {
  it('avanza hacia el siguiente punto a su velocidad', () => {
    const w = createWalker(CUADRADO);
    stepWalker(w, CUADRADO, 2, 0, 0.5);
    expect(w.x).toBeCloseTo(1);
    expect(w.z).toBeCloseTo(0);
    expect(w.moving).toBe(true);
  });

  it('se para el tiempo de pausa al llegar a un punto', () => {
    const w = createWalker(CUADRADO);
    for (let i = 0; i < 25; i++) stepWalker(w, CUADRADO, 2, 1, 0.1);
    expect(w.x).toBeCloseTo(4);
    expect(w.target).toBe(2);
    expect(w.moving).toBe(false);
    stepWalker(w, CUADRADO, 2, 1, 0.5);
    expect(w.z).toBe(0); // sigue esperando
    stepWalker(w, CUADRADO, 2, 1, 0.6);
    stepWalker(w, CUADRADO, 2, 1, 0.5);
    expect(w.z).toBeGreaterThan(0);
  });

  it('cierra el circuito volviendo al primer punto', () => {
    const w = createWalker(CUADRADO);
    for (let i = 0; i < 1000; i++) stepWalker(w, CUADRADO, 2, 0, 0.05);
    expect(w.target).toBeGreaterThanOrEqual(0);
    expect(w.target).toBeLessThan(CUADRADO.length);
    // 16 m de perímetro a 2 m/s: en 50 s ha dado varias vueltas sin salirse
    expect(w.x).toBeGreaterThanOrEqual(0);
    expect(w.x).toBeLessThanOrEqual(4);
  });

  it('se detiene y mira al jugador si lo tiene cerca', () => {
    const w = createWalker(CUADRADO);
    stepWalker(w, CUADRADO, 2, 0, 0.1, { x: 0, z: YIELD_RADIUS / 2 });
    expect(w.x).toBe(0);
    expect(w.moving).toBe(false);
    expect(w.heading).toBeCloseTo(0); // mira hacia +z
  });
});

describe('ceder el paso', () => {
  it('si el jugador no se aparta, sigue andando pasado YIELD_MAX', () => {
    const w = createWalker(CUADRADO);
    const jugador = { x: 0.5, z: 0 };
    for (let t = 0; t < YIELD_MAX; t += 0.1) stepWalker(w, CUADRADO, 2, 0, 0.1, jugador);
    expect(w.x).toBe(0);
    stepWalker(w, CUADRADO, 2, 0, 0.1, jugador);
    stepWalker(w, CUADRADO, 2, 0, 0.1, jugador);
    expect(w.x).toBeGreaterThan(0);
    expect(w.moving).toBe(true);
  });
});

describe('VILLAGERS', () => {
  it('hay diez transeúntes con id único', () => {
    expect(VILLAGERS).toHaveLength(10);
    expect(new Set(VILLAGERS.map((v) => v.id)).size).toBe(10);
  });

  it('no hay dos con el mismo aspecto', () => {
    const aspectos = VILLAGERS.map((v) =>
      JSON.stringify([v.look.shirt, v.look.hat, v.look.hatColor, v.look.hair]),
    );
    expect(new Set(aspectos).size).toBe(VILLAGERS.length);
  });

  // Cada tramo de ruta debe ir por un camino: el norte-sur, el este-oeste,
  // una calle del barrio o el acceso a la granja.
  const CAMINOS = [
    { minX: -1.1, maxX: 1.1, minZ: -28, maxZ: STREET_END_Z },
    {
      minX: NEIGHBORHOOD_LANES[0].minX,
      maxX: Math.max(...SHOPS.map((s) => s.x)) + 3,
      minZ: -5.1,
      maxZ: -2.9,
    },
    ...NEIGHBORHOOD_LANES,
    ENTRANCE_PATH,
  ];
  const enCamino = (x: number, z: number) =>
    CAMINOS.some((c) => x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ);

  it.each(VILLAGERS.map((v) => [v.name, v.route] as const))(
    'la ruta de %s va siempre por los caminos',
    (_, route) => {
      for (let i = 0; i < route.length; i++) {
        const [ax, az] = route[i];
        const [bx, bz] = route[(i + 1) % route.length];
        for (let t = 0; t <= 1; t += 0.05) {
          expect(enCamino(ax + (bx - ax) * t, az + (bz - az) * t)).toBe(true);
        }
      }
    },
  );
});
