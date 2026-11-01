// Planta del interior del almacén (sin Babylon): dos niveles con sus colisiones,
// la puerta, la escalera de mano y las zonas de cada recurso. Las piezas usan las
// coordenadas de assets/almacen_interior/generar.py: el juego refleja x y z (su
// frente -Y queda en +z, y su +x en -x).

/** Lejos del pueblo y de la casa, fuera de la vista de la cámara. */
export const WAREHOUSE = { x: -400, z: 400, width: 16, depth: 12 };

/** Altura del suelo del altillo, que cubre la mitad del fondo (by de 0 a 6). */
export const LOFT_HEIGHT = 2.6;
export const LOFT_THICKNESS = 0.3;
export const WALL_HEIGHT = 6;

const { x: X0, z: Z0 } = WAREHOUSE;

// Centro del granjero sobre el suelo: su caja física mide 1,3 m de alto (playerView)
const BODY_HALF_HEIGHT = 0.65;
const GROUND_Y = BODY_HALF_HEIGHT;
const LOFT_Y = LOFT_HEIGHT + BODY_HALF_HEIGHT;

export type WarehouseLevel = 0 | 1; // 0: planta baja, 1: altillo

export function warehouseLevel(y: number): WarehouseLevel {
  return y > LOFT_HEIGHT - 0.2 ? 1 : 0;
}

const pieza = (name: string, bx: number, by: number, w: number, d: number) => ({
  name,
  cx: X0 - bx,
  cz: Z0 - by,
  w,
  d,
});

/** Muros cerrados, comunes a los dos niveles: solo se sale por la interacción. */
export const WAREHOUSE_WALLS = [
  pieza('muroNorte', 0, 6.2, 16.8, 0.4),
  pieza('muroSur', 0, -6.2, 16.8, 0.4),
  pieza('muroEste', 8.2, 0, 0.4, 12.4),
  pieza('muroOeste', -8.2, 0, 0.4, 12.4),
];

// Estanterías contra el muro del fondo de cada nivel
const SHELF_DEPTH = 0.8;
const SHELF_WIDTH = 3.4;
const SHELF_BY = 5.55;
const SHELF_BX = [-4.8, 0, 4.8];

/** Una estantería por recurso: cosechas abajo y productos de granja arriba. */
export const WAREHOUSE_SHELVES = [
  { kind: 'crop', id: 'zanahoria', level: 0, slot: 0 },
  { kind: 'crop', id: 'tomate', level: 0, slot: 1 },
  { kind: 'crop', id: 'calabaza', level: 0, slot: 2 },
  { kind: 'animal', id: 'gallina', level: 1, slot: 0 },
  { kind: 'animal', id: 'oveja', level: 1, slot: 1 },
  { kind: 'animal', id: 'vaca', level: 1, slot: 2 },
].map((s) => ({
  ...s,
  kind: s.kind as 'crop' | 'animal',
  level: s.level as WarehouseLevel,
  collider: pieza(`estanteria_${s.id}`, SHELF_BX[s.slot], SHELF_BY, SHELF_WIDTH, SHELF_DEPTH),
}));

// Boxes del pienso contra el muro oeste de la planta baja: tres de 2 m entre by=-6 y 0
const BAY_DEPTH = 2;
const BAY_LENGTH = 3;

/** Un box de pienso por animal, en la planta baja. */
export const WAREHOUSE_FEED_BAYS = ['gallina', 'oveja', 'vaca'].map((animal, i) => {
  const by = -6 + (i + 0.5) * BAY_DEPTH;
  return {
    animal,
    // Rectángulo del box, en mundo
    cx: X0 + 8 - BAY_LENGTH / 2,
    cz: Z0 - by,
    w: BAY_LENGTH,
    d: BAY_DEPTH,
    sacos: pieza(`sacos_${animal}`, -7.3, by, 1.2, 1.5),
  };
});

const SEPARADORES = [-4, -2, 0].map((by, i) => pieza(`separadorPienso${i}`, -6.5, by, 3, 0.16));

// La escalera, pegada al borde del altillo en el centro de la mitad este
const LADDER_BX = 3;

/** Colisiones de la planta baja: no llegan a la losa del altillo. */
export const GROUND_COLLIDERS = [
  ...WAREHOUSE_SHELVES.filter((s) => s.level === 0).map((s) => s.collider),
  ...WAREHOUSE_FEED_BAYS.map((b) => b.sacos),
  ...SEPARADORES,
  ...[-4, 0.5, 5.5].map((bx, i) => pieza(`pilar${i}`, bx, 0.1, 0.3, 0.3)),
  pieza('escalera', LADDER_BX, -0.5, 0.9, 1),
  pieza('cajas', 6.8, -5.2, 2, 1.2),
];

/** Colisiones sobre la losa. La barandilla es continua: la escalera la cruza sin chocar. */
export const LOFT_COLLIDERS = [
  ...WAREHOUSE_SHELVES.filter((s) => s.level === 1).map((s) => s.collider),
  pieza('barandilla', 0, 0.05, 16, 0.1),
  pieza('fardos', -7, 1, 1.6, 1.4),
];

/** Rectángulo del altillo, en mundo. */
export const LOFT = { cx: X0, cz: Z0 - 3, w: WAREHOUSE.width, d: WAREHOUSE.depth / 2 };

// ---------- Puerta ----------

/** Donde aparece el granjero al entrar: junto a la puerta del muro este. */
export const WAREHOUSE_ENTRY = { x: X0 - 7.3, z: Z0 + 3 };

/** Punto de la puerta por dentro y distancia para poder salir. */
export const WAREHOUSE_EXIT = { x: X0 - 8, z: Z0 + 3 };
export const WAREHOUSE_EXIT_REACH = 1.1;

export function isInWarehouse(x: number, z: number): boolean {
  return Math.abs(x - X0) < WAREHOUSE.width / 2 + 1 && Math.abs(z - Z0) < WAREHOUSE.depth / 2 + 1;
}

export function canLeaveWarehouse(x: number, z: number, y: number): boolean {
  return (
    warehouseLevel(y) === 0 &&
    Math.hypot(x - WAREHOUSE_EXIT.x, z - WAREHOUSE_EXIT.z) < WAREHOUSE_EXIT_REACH
  );
}

/** Bajo el altillo el granjero quedaría tapado por él (ver WarehouseView). */
export function isUnderLoft(x: number, z: number, y: number): boolean {
  return warehouseLevel(y) === 0 && Math.abs(x - LOFT.cx) < LOFT.w / 2 && z < Z0;
}

// ---------- Escalera de mano ----------

export const LADDER_FOOT = { x: X0 - LADDER_BX, z: Z0 + 1.35 };
export const LADDER_TOP = { x: X0 - LADDER_BX, z: Z0 - 0.55 };
export const LADDER_REACH = 0.9;

export type Point3 = { x: number; y: number; z: number };

/** Recorrido al subir, en orden; para bajar se invierte. */
export const LADDER_PATH: Point3[] = [
  { x: LADDER_FOOT.x, y: GROUND_Y, z: LADDER_FOOT.z },
  { x: LADDER_FOOT.x, y: GROUND_Y, z: Z0 + 1.05 },
  { x: LADDER_TOP.x, y: LOFT_Y + 0.05, z: Z0 + 0.35 },
  { x: LADDER_TOP.x, y: LOFT_Y, z: LADDER_TOP.z },
];

export function canClimbUp(x: number, z: number, y: number): boolean {
  return warehouseLevel(y) === 0 && Math.hypot(x - LADDER_FOOT.x, z - LADDER_FOOT.z) < LADDER_REACH;
}

export function canClimbDown(x: number, z: number, y: number): boolean {
  return warehouseLevel(y) === 1 && Math.hypot(x - LADDER_TOP.x, z - LADDER_TOP.z) < LADDER_REACH;
}

/** Punto de un recorrido a una fracción t (0..1) de su longitud. */
export function pointOnPath(path: Point3[], t: number): Point3 {
  const tramos = path.slice(1).map((p, i) => {
    const a = path[i];
    return Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
  });
  let resto = Math.min(1, Math.max(0, t)) * tramos.reduce((s, l) => s + l, 0);
  for (let i = 0; i < tramos.length; i++) {
    if (resto <= tramos[i] && tramos[i] > 0) {
      const f = resto / tramos[i];
      const [a, b] = [path[i], path[i + 1]];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
    }
    resto -= tramos[i];
  }
  return path[path.length - 1];
}

// ---------- Zonas: qué recurso hay donde está el granjero ----------

const SHELF_REACH = 0.75; // del borde de la estantería; su colisión para a 0,35

export type WarehouseSpot =
  | { type: 'shelf'; kind: 'crop' | 'animal'; id: string; dist: number }
  | { type: 'feed'; animal: string; dist: number };

export function warehouseSpotAt(x: number, z: number, y: number): WarehouseSpot | null {
  const level = warehouseLevel(y);
  for (const s of WAREHOUSE_SHELVES) {
    if (s.level !== level) continue;
    const c = s.collider;
    const dx = Math.max(0, Math.abs(x - c.cx) - c.w / 2);
    const dz = Math.max(0, Math.abs(z - c.cz) - c.d / 2);
    const dist = Math.hypot(dx, dz);
    if (dist < SHELF_REACH) return { type: 'shelf', kind: s.kind, id: s.id, dist };
  }
  if (level === 0) {
    for (const b of WAREHOUSE_FEED_BAYS) {
      if (Math.abs(x - b.cx) < b.w / 2 && Math.abs(z - b.cz) < b.d / 2) {
        return { type: 'feed', animal: b.animal, dist: Math.hypot(x - b.cx, z - b.cz) };
      }
    }
  }
  return null;
}

// ---------- Fachada, en el pueblo ----------

// Planta del edificio (centrada en el GLB, que mide ~2.06×2.2 tras el escalado
// de la vista), con la puerta en la pared oeste.
export const STORAGE = { x: 12.47, z: 5, width: 2.06, depth: 2.2, wallThickness: 0.2 };

const STORAGE_WEST = STORAGE.x - STORAGE.width / 2;
const STORAGE_DOOR_HALF_WIDTH = 0.55;
const STORAGE_DOOR_MAX_DEPTH = 0.75; // desde el muro, cuánto puede alejarse y seguir frente a ella

/** Paredes macizas: no hay más entrada que la interacción con la puerta. */
export const STORAGE_WALLS = (() => {
  const { x, z, width, depth, wallThickness: t } = STORAGE;
  return [
    { w: t, d: depth, px: x + width / 2 - t / 2, pz: z }, // este
    { w: t, d: depth, px: STORAGE_WEST + t / 2, pz: z }, // oeste, la de la puerta
    { w: width, d: t, px: x, pz: z - depth / 2 + t / 2 }, // norte
    { w: width, d: t, px: x, pz: z + depth / 2 - t / 2 }, // sur
  ];
})();

/** Frente a la puerta (ahí el muro detiene al granjero); adonde vuelve al salir. */
export const STORAGE_DOOR_SPOT = { x: STORAGE_WEST - 0.5, z: STORAGE.z };

export function canEnterStorage(x: number, z: number): boolean {
  return (
    Math.abs(z - STORAGE.z) < STORAGE_DOOR_HALF_WIDTH &&
    x < STORAGE_WEST &&
    STORAGE_WEST - x < STORAGE_DOOR_MAX_DEPTH
  );
}
