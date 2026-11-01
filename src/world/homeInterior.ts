// Planta del interior de la casa del granjero (sin Babylon): dónde está el
// escenario, qué colisiona y desde dónde se alcanzan la cama y la salida. Las
// piezas usan las coordenadas de assets/casa_interior/generar.py: el juego
// refleja x y z (su frente -Y queda en +z, y su +x en -x).

/** La casa está lejos del pueblo, fuera de la vista de la cámara. */
export const HOME_INTERIOR = { x: 400, z: 400, width: 16, depth: 10 };

const { x: X0, z: Z0 } = HOME_INTERIOR;

const pieza = (name: string, bx: number, by: number, w: number, d: number) => ({
  name,
  cx: X0 - bx,
  cz: Z0 - by,
  w,
  d,
});

/** Colisiones fijas, en coordenadas de mundo (cx, cz centro; w, d medidas). */
export const INTERIOR_COLLIDERS = [
  // Muros y tabiques, con paso al baño y al dormitorio
  pieza('muroNorte', 0, 5.2, 16.8, 0.4),
  pieza('muroSur', 0, -5.2, 16.8, 0.4),
  pieza('muroEste', 8.2, 0, 0.4, 10.4),
  pieza('muroOeste', -8.2, 0, 0.4, 10.4),
  pieza('tabiqueBanoSalon', -3, -3.25, 0.2, 3.5),
  pieza('tabiqueCentro', -3, 0.85, 0.2, 2.3),
  pieza('tabiqueDormitorio', -3, 4.1, 0.2, 1.8),
  pieza('tabiqueBanoDormitorio', -5.5, 0, 5, 0.2),
  // Dormitorio
  pieza('cama', -5.2, 3.82, 1.75, 2.2),
  pieza('mesitaOeste', -6.45, 4.6, 0.55, 0.55),
  pieza('mesitaEste', -3.95, 4.6, 0.55, 0.55),
  pieza('armario', -7.6, 1.5, 0.85, 2.2),
  // Baño (el plato de la ducha se pisa)
  pieza('banera', -6.9, -0.55, 2.1, 0.9),
  pieza('inodoro', -7.6, -2.5, 0.85, 0.5),
  pieza('lavabo', -3.45, -3.3, 0.65, 1.1),
  // Salón comedor
  pieza('tele', -2.62, -2.9, 0.55, 1.7),
  pieza('sofa', 1, -2.9, 1, 2.3),
  pieza('mesaCentro', -1, -2.9, 0.65, 1.15),
  pieza('hogar', 7.55, -2.2, 0.9, 2.3),
  pieza('lena', 7.5, -3.7, 0.6, 0.6),
  pieza('butaca', 5.7, -3.4, 0.9, 0.9),
  pieza('mesa', 5.6, -0.4, 2.3, 2.4), // con sus sillas
  // Cocina
  pieza('encimera', 4.2, 4.62, 7.4, 0.75),
  pieza('nevera', 0, 4.6, 0.85, 0.8),
  pieza('isla', 3.6, 2.525, 2.75, 1.45), // con sus taburetes
];

export const FARMER_BED = { x: X0 + 5.2, z: Z0 - 3.82 };

/** Distancia máxima al centro de la cama para acostarse. */
export const BED_REACH = 1.7;

/** Punto libre junto a la cama donde despierta el granjero. */
export const BED_WAKE = { x: X0 + 3.95, z: Z0 - 3.1 };

/** Donde aparece el granjero al entrar: sobre el felpudo. */
export const INTERIOR_ENTRY = { x: X0 - 3, z: Z0 + 4.55 };

/** Punto de la puerta por dentro y distancia para poder salir. */
export const INTERIOR_EXIT = { x: X0 - 3, z: Z0 + 5 };
export const EXIT_REACH = 1.1;

export function isIndoors(x: number, z: number): boolean {
  return (
    Math.abs(x - X0) < HOME_INTERIOR.width / 2 + 1 && Math.abs(z - Z0) < HOME_INTERIOR.depth / 2 + 1
  );
}

export function canReachBed(x: number, z: number): boolean {
  return Math.hypot(x - FARMER_BED.x, z - FARMER_BED.z) < BED_REACH;
}

export function canReachExit(x: number, z: number): boolean {
  return Math.hypot(x - INTERIOR_EXIT.x, z - INTERIOR_EXIT.z) < EXIT_REACH;
}
