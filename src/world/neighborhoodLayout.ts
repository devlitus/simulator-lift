// Barrio de los vecinos (sin Babylon): parcelas, calles y el reparto de las
// casas. Ocupa el cuadrante noroeste del pueblo, entre el camino norte-sur,
// el este-oeste y el borde del mapa: 5 columnas × 3 filas de parcelas, cada
// fila con la fachada hacia la calle que tiene al sur. La casa de Gon ocupa
// una parcela fija; las demás reciben una de las 5 casas de
// assets/casas_vecinos/ con una semilla fija, así el barrio es igual en cada
// partida y para cada jugador. Lo usan WorldView, SceneryView y los tests.
import type { Rect } from './farmLayout';

/** Rejilla de las baldosas del camino (WorldView.buildPaths): paso y origen en z. */
const PASO_BALDOSA = 1.1;
const Z_CAMINO_EO = -5.1; // borde norte del camino este-oeste

const COLUMNAS = 5;
const FILAS = 3;
const FONDO_PARCELA = 6 * PASO_BALDOSA; // 6,6 m
const ANCHO_CALLE = 2 * PASO_BALDOSA; // 2,2 m, como los caminos
const RETRANQUEO = 0.7; // jardín delantero, de la calle a la fachada (o al porche)

/** Zona del barrio; x y z caen en la rejilla de las baldosas. */
export const NEIGHBORHOOD_ZONE: Rect = {
  minX: -28 * PASO_BALDOSA, // -30,8
  maxX: -PASO_BALDOSA, // borde oeste del camino norte-sur
  minZ: Z_CAMINO_EO - FILAS * FONDO_PARCELA - (FILAS - 1) * ANCHO_CALLE, // -29,3
  maxZ: Z_CAMINO_EO,
};

const ANCHO_PARCELA = (NEIGHBORHOOD_ZONE.maxX - NEIGHBORHOOD_ZONE.minX) / COLUMNAS; // 5,94

/** Borde de la calle (sur) de cada fila: la primera da al camino este-oeste. */
const frenteFila = (fila: number) => Z_CAMINO_EO - fila * (FONDO_PARCELA + ANCHO_CALLE);

/** Calles este-oeste entre filas, del camino norte-sur al final del barrio. */
export const NEIGHBORHOOD_LANES: Rect[] = Array.from({ length: FILAS - 1 }, (_, i) => ({
  minX: NEIGHBORHOOD_ZONE.minX,
  maxX: NEIGHBORHOOD_ZONE.maxX,
  minZ: frenteFila(i + 1),
  maxZ: frenteFila(i + 1) + ANCHO_CALLE,
}));

/**
 * Casas de assets/casas_vecinos/generar.py, en metros (el juego no reescala).
 * width/depth: cuerpo de la casa (colisión); front: del pivote a lo más
 * adelantado (porche o escalón); back: del pivote a lo más atrasado (alero).
 */
export interface HouseModel {
  file: string;
  width: number;
  depth: number;
  front: number;
  back: number;
  halfSpan: number; // media anchura total, aleros incluidos
}

export const HOUSE_MODELS: HouseModel[] = [
  {
    file: 'casa_vecino_cabana.glb',
    width: 4.4,
    depth: 3.6,
    front: 3.13,
    back: 2.25,
    halfSpan: 2.83,
  },
  {
    file: 'casa_vecino_encalada.glb',
    width: 4.6,
    depth: 3.8,
    front: 2.34,
    back: 2.29,
    halfSpan: 2.6,
  },
  {
    file: 'casa_vecino_entramado.glb',
    width: 3.8,
    depth: 3.8,
    front: 2.34,
    back: 2.25,
    halfSpan: 2.38,
  },
  { file: 'casa_vecino_piedra.glb', width: 4.6, depth: 3.8, front: 2.51, back: 2.3, halfSpan: 2.9 },
  {
    file: 'casa_vecino_porche.glb',
    width: 4.6,
    depth: 3.6,
    front: 3.37,
    back: 2.19,
    halfSpan: 2.69,
  },
];

/** La casa de Gon (casa_gon.glb, escalada a 4,8 m de alto): caja de 4,4 m. */
export const GON_HOUSE_SIZE = 4.4;
export const GON_LOT = { row: 0, col: 2 };

export interface Lot {
  row: number; // 0 = junto al camino este-oeste
  col: number; // 0 = junto al camino norte-sur
  x: number; // centro de la parcela
  frontZ: number; // borde de la calle
  rect: Rect;
}

export const LOTS: Lot[] = Array.from({ length: FILAS * COLUMNAS }, (_, i) => {
  const row = Math.floor(i / COLUMNAS);
  const col = i % COLUMNAS;
  const maxX = NEIGHBORHOOD_ZONE.maxX - col * ANCHO_PARCELA;
  const frontZ = frenteFila(row);
  return {
    row,
    col,
    x: maxX - ANCHO_PARCELA / 2,
    frontZ,
    rect: { minX: maxX - ANCHO_PARCELA, maxX, minZ: frontZ - FONDO_PARCELA, maxZ: frontZ },
  };
});

export interface PlacedHouse {
  lot: Lot;
  model: HouseModel | null; // null: la casa de Gon
  x: number; // pivote de la casa
  z: number;
  mirrored: boolean; // espejo en x: cambia de lado la puerta y la chimenea
  collider: { cx: number; cz: number; w: number; d: number };
}

// Azar determinista (mulberry32): el barrio sale igual en cada carga.
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const NEIGHBORHOOD_SEED = 20261101;

/**
 * Reparte las casas: cada modelo sale casi las mismas veces (bolsa barajada)
 * y dos casas iguales nunca quedan una al lado de la otra en la misma fila.
 */
export function placeHouses(seed = NEIGHBORHOOD_SEED): PlacedHouse[] {
  const rnd = azar(seed);
  const libres = LOTS.filter((l) => !(l.row === GON_LOT.row && l.col === GON_LOT.col));
  const bolsa = libres.map((_, i) => i % HOUSE_MODELS.length);
  const vecinasIguales = (orden: number[]) =>
    libres.some((l, i) =>
      libres.some(
        (o, j) => o.row === l.row && Math.abs(o.col - l.col) === 1 && orden[i] === orden[j],
      ),
    );
  do {
    for (let i = bolsa.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
    }
  } while (vecinasIguales(bolsa));

  return LOTS.map((lot) => {
    const i = libres.indexOf(lot);
    if (i < 0) {
      const z = lot.frontZ - RETRANQUEO - 0.5 - GON_HOUSE_SIZE / 2; // y su yunque delante
      const s = GON_HOUSE_SIZE;
      return {
        lot,
        model: null,
        x: lot.x,
        z,
        mirrored: false,
        collider: { cx: lot.x, cz: z, w: s, d: s },
      };
    }
    const model = HOUSE_MODELS[bolsa[i]];
    const z = lot.frontZ - RETRANQUEO - model.front;
    return {
      lot,
      model,
      x: lot.x,
      z,
      mirrored: rnd() < 0.5,
      collider: { cx: lot.x, cz: z, w: model.width, d: model.depth },
    };
  });
}

export const NEIGHBORHOOD_HOUSES = placeHouses();

/** Huella visible de una casa (aleros y porche incluidos), para no sembrar decoración. */
export function houseFootprint(h: PlacedHouse): Rect {
  const m = h.model;
  const half = m ? m.halfSpan : GON_HOUSE_SIZE / 2 + 0.6;
  const front = m ? m.front : GON_HOUSE_SIZE / 2 + 0.4;
  const back = m ? m.back : GON_HOUSE_SIZE / 2 + 0.4;
  return { minX: h.x - half, maxX: h.x + half, minZ: h.z - back, maxZ: h.z + front };
}
