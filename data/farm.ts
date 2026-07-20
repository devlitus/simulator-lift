// Datos de la parcela de cultivo: dimensiones y colocación en el mundo.
import { FarmConfigSchema, type FarmConfig } from './schemas';

export const FARM_CONFIG: FarmConfig = FarmConfigSchema.parse({
  cols: 6,
  rows: 4,
  spacing: 1.5, // distancia entre surcos
  origin: { x: 2.5, z: 3 }, // esquina de la parcela, al este de la calle (x ∈ [-1.1, 1.1])
  tileSize: 1.3,
});

// Días consecutivos sin regar antes de que un cultivo se marchite
export const WILT_DAYS = 2;
