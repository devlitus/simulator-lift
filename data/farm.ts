// Datos de la parcela de cultivo: dimensiones y colocación en el mundo.
import { FarmConfigSchema, type FarmConfig } from './schemas';

export const FARM_CONFIG: FarmConfig = FarmConfigSchema.parse({
  cols: 6,
  rows: 4,
  spacing: 1.5, // distancia entre surcos
  origin: { x: 19.55, z: -0.4 }, // esquina de la parcela, centrada en la zona de cosecha
  tileSize: 1.3,
});

// Días consecutivos sin regar antes de que un cultivo se marchite
export const WILT_DAYS = 2;

// Riegos que caben en la regadera; se rellena en el pozo junto a la parcela
export const WATERING_CAN_CAPACITY = 5;
