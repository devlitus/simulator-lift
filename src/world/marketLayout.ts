// Mercado del pueblo (sin Babylon), al norte del camino este-oeste y al este de
// la calle: tres tiendas iguales por fuera (assets/tiendas/) con su interior
// (assets/tienda_interior/) y su tendero tras el mostrador. Las medidas salen de
// los dos generadores; los interiores son escenarios lejos del pueblo y el juego
// refleja x y z de Blender (su frente -Y queda en +z, y su +x en -x).
import type { ShopKind } from '../../data/schemas';
import type { Rect } from './farmLayout';

export interface ShopDef {
  kind: ShopKind;
  x: number; // centro del edificio en el pueblo
  z: number;
  exterior: string; // GLB en /models/
  interior: string;
  sign: string; // rótulo del letrero
  name: string; // para las pistas: «Entrar en …»
  keeper: string; // id del NPC que atiende (data/npcs.ts)
  inside: { x: number; z: number }; // centro del interior, fuera de la vista
}

export const SHOPS: ShopDef[] = [
  {
    kind: 'semillas',
    x: 21.5,
    z: -8.5,
    exterior: 'tienda_semillas.glb',
    interior: 'tienda_interior_semillas.glb',
    sign: '🌱 Semillas',
    name: 'la tienda de semillas',
    keeper: 'marta',
    inside: { x: 400, z: -400 },
  },
  {
    kind: 'animales',
    x: 13,
    z: -8.5,
    exterior: 'tienda_animales.glb',
    interior: 'tienda_interior_animales.glb',
    sign: '🐄 Rancho',
    name: 'el rancho',
    keeper: 'tomas',
    inside: { x: -400, z: -400 },
  },
  {
    kind: 'flores',
    x: 5,
    z: -8.5,
    exterior: 'tienda_flores.glb',
    interior: 'tienda_interior_flores.glb',
    sign: '🌸 Flores',
    name: 'la floristería',
    keeper: 'lila',
    inside: { x: 0, z: -400 },
  },
];

// ---------- Exterior (assets/tiendas/generar.py, en metros) ----------

/** Edificio de 6 × 4,6 m con la puerta y los escaparates al sur (+z). */
export const SHOP_BUILDING = {
  width: 6.1, // con el zócalo
  depth: 4.7,
  signY: 3.62, // centro del letrero del hastial
  signZ: 2.47, // su cara, desde el centro del edificio
  signWidth: 2,
  signHeight: 0.6,
};

/** Colisiones de una tienda: el edificio, los bancos de los escaparates y el género de las esquinas. */
export function shopColliders(s: { x: number; z: number }) {
  const { width, depth } = SHOP_BUILDING;
  return [
    { cx: s.x, cz: s.z, w: width, d: depth },
    ...[-1, 1].flatMap((lado) => [
      { cx: s.x + lado * 1.75, cz: s.z + 2.72, w: 1.45, d: 0.55 }, // banco
      { cx: s.x + lado * 3.45, cz: s.z + 1.85, w: 0.8, d: 1.0 }, // sacos, paja o cubos
    ]),
  ];
}

/** Planta de una tienda con todo lo que expone fuera. */
export function shopRect(s: { x: number; z: number }): Rect {
  return { minX: s.x - 3.85, maxX: s.x + 3.85, minZ: s.z - 2.35, maxZ: s.z + 3.0 };
}

const FRONT = SHOP_BUILDING.depth / 2 - 0.05; // muro de la fachada, desde el centro

/** Sobre el escalón, frente a la puerta (ahí el muro detiene al granjero). */
export function shopDoorSpot(s: { x: number; z: number }): { x: number; z: number } {
  return { x: s.x, z: s.z + FRONT + 0.45 };
}

/** Tienda cuya puerta tiene delante al granjero, o null. */
export function shopAtDoor(x: number, z: number): ShopDef | null {
  for (const s of SHOPS) {
    const fuera = z - (s.z + FRONT);
    if (Math.abs(x - s.x) < 0.55 && fuera > 0.3 && fuera < 0.9) return s;
  }
  return null;
}

// ---------- Interior (assets/tienda_interior/generar.py, en metros) ----------

/** Tienda de 10 × 7 m, la misma planta para las tres. */
export const SHOP_INTERIOR = { width: 10, depth: 7 };

// Piezas en coordenadas de Blender (bx, by centro; w, d medidas)
const PIEZAS = [
  // Muros. El sur es entero, también en la puerta: se sale con Intro, no andando
  { name: 'muroNorte', bx: 0, by: 3.6, w: 10.4, d: 0.2 },
  { name: 'muroSur', bx: 0, by: -3.6, w: 10.4, d: 0.2 },
  { name: 'muroEste', bx: 5.1, by: 0, w: 0.2, d: 7.4 },
  { name: 'muroOeste', bx: -5.1, by: 0, w: 0.2, d: 7.4 },
  // Mostrador y trastienda cerrada
  { name: 'mostrador', bx: 0, by: 1.2, w: 6.1, d: 0.75 },
  { name: 'tabiqueOeste', bx: -3, by: 2.275, w: 0.16, d: 1.5 },
  { name: 'tabiqueEste', bx: 3, by: 2.275, w: 0.16, d: 1.5 },
  { name: 'estanteria', bx: 0, by: 3.22, w: 9.3, d: 0.5 },
  { name: 'barrilOeste', bx: -3.6, by: 2.3, w: 0.86, d: 0.86 },
  { name: 'barrilEste', bx: 3.6, by: 2.3, w: 0.86, d: 0.86 },
  // Mesas y género junto a los laterales
  { name: 'mesaOeste', bx: -2.8, by: -1.2, w: 1.45, d: 0.85 },
  { name: 'mesaEste', bx: 2.8, by: -1.2, w: 1.45, d: 0.85 },
  { name: 'generoOeste', bx: -4.55, by: 0.2, w: 0.9, d: 5.6 }, // hasta la estantería
  { name: 'generoEste', bx: 4.55, by: 0.2, w: 0.9, d: 5.6 },
];

const enMundo = (s: ShopDef, bx: number, by: number) => ({
  x: s.inside.x - bx,
  z: s.inside.z - by,
});

/** Colisiones fijas del interior de una tienda, en coordenadas de mundo. */
export function shopInteriorColliders(s: ShopDef) {
  return PIEZAS.map((p) => {
    const c = enMundo(s, p.bx, p.by);
    return { name: p.name, cx: c.x, cz: c.z, w: p.w, d: p.d };
  });
}

/** Tras el mostrador: ahí atiende el tendero. */
export const keeperSpot = (s: ShopDef) => enMundo(s, 0, 2.3);

/** Donde aparece el granjero al entrar: sobre el felpudo. */
export const shopEntry = (s: ShopDef) => enMundo(s, 0, -2.9);

/** Punto de la puerta por dentro y distancia para poder salir. */
export const shopExit = (s: ShopDef) => enMundo(s, 0, -3.35);
export const SHOP_EXIT_REACH = 1.1;

/** Tienda en cuyo interior está el punto, o null. */
export function shopInside(x: number, z: number): ShopDef | null {
  const { width, depth } = SHOP_INTERIOR;
  for (const s of SHOPS) {
    if (Math.abs(x - s.inside.x) < width / 2 + 1 && Math.abs(z - s.inside.z) < depth / 2 + 1) {
      return s;
    }
  }
  return null;
}

/** Tienda por cuya puerta puede salir el granjero desde dentro, o null. */
export function shopExitAt(x: number, z: number): ShopDef | null {
  const s = shopInside(x, z);
  if (!s) return null;
  const e = shopExit(s);
  return Math.hypot(x - e.x, z - e.z) < SHOP_EXIT_REACH ? s : null;
}

/** Toda la zona del mercado: aquí no se siembran rocas ni arbustos. */
export const MARKET_ZONE: Rect = { minX: 1.1, maxX: 25.5, minZ: -11.5, maxZ: -5.1 };
