// Planta exterior de la casa del granjero (sin Babylon): el porche con sus dos
// peldaños, las barreras que obligan a subir por delante y el punto frente a la
// puerta desde el que se entra. Medidas de assets/casa_granjero/ a escala de juego.

// Cabaña de 5×4 m con la puerta al sur (+z), mirando a la cámara, y porche delante.
export const FARMER_HOUSE = { x: -6.5, z: 14, width: 5.2, depth: 4.2, height: 4.8 };

const { x: X0, z: Z0 } = FARMER_HOUSE;
const WALL_Z = Z0 + FARMER_HOUSE.depth / 2; // muro de la puerta

export const PORCH = {
  deckFrontZ: Z0 + 2.95, // borde delantero de la tarima
  stepFrontZ: Z0 + 3.3, // borde delantero del peldaño de piedra
  halfWidth: 1.2,
  stepHeight: 0.22, // primer peldaño: la piedra
  deckHeight: 0.43, // segundo peldaño: la tarima
  gapHalfWidth: 0.8, // paso libre por delante, sobre el peldaño de piedra
};

/** Colisiones que dejan el peldaño como único acceso a la tarima. */
export const PORCH_BARRIERS = [
  ...[-1, 1].flatMap((lado) => {
    const frente = PORCH.halfWidth + 0.2 - PORCH.gapHalfWidth;
    return [
      {
        cx: X0 + lado * (PORCH.halfWidth + 0.1),
        cz: (WALL_Z + PORCH.deckFrontZ) / 2,
        w: 0.2,
        d: PORCH.deckFrontZ - WALL_Z,
      },
      {
        cx: X0 + lado * (PORCH.gapHalfWidth + frente / 2),
        cz: PORCH.deckFrontZ + 0.1,
        w: frente,
        d: 0.2,
      },
    ];
  }),
];

/** Sobre el felpudo, justo frente a la puerta (ahí el muro detiene al granjero). */
export const DOOR_SPOT = { x: X0, z: WALL_Z + 0.35 };

const DOOR_HALF_WIDTH = 0.45;
const DOOR_MAX_DEPTH = 0.6; // desde el muro, cuánto puede alejarse y seguir frente a ella

export function canEnterDoor(x: number, z: number): boolean {
  return Math.abs(x - X0) < DOOR_HALF_WIDTH && z - WALL_Z < DOOR_MAX_DEPTH;
}

// Altura a la que pisa el granjero: la física va siempre sobre el plano del
// césped (su caja no sube escalones), así que es la vista la que lo eleva.
export function floorHeightAt(x: number, z: number): number {
  if (Math.abs(x - X0) > PORCH.halfWidth + 0.2 || z < WALL_Z) return 0;
  if (z < PORCH.deckFrontZ) return PORCH.deckHeight;
  if (z < PORCH.stepFrontZ) return PORCH.stepHeight;
  return 0;
}
