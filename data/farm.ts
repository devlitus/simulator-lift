// Datos de la parcela de cultivo: dimensiones y colocación en el mundo.
import { FarmConfigSchema, type FarmConfig } from './schemas';

export const FARM_CONFIG: FarmConfig = FarmConfigSchema.parse({
  cols: 6,
  rows: 4,
  spacing: 1.5, // distancia entre surcos
  origin: { x: -4, z: 3 }, // esquina de la parcela (coordenadas del mundo)
  tileSize: 1.3,
});

// Días consecutivos sin regar antes de que un cultivo se marchite
export const WILT_DAYS = 2;
