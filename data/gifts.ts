// Datos de regalos comprables. points = puntos de amistad que otorgan al regalar.
import { GiftsSchema, type GiftDef } from './schemas';

export const GIFTS: Record<string, GiftDef> = GiftsSchema.parse({
  flor: { name: 'Flor', icon: '🌸', price: 20, points: 2 },
  pastel: { name: 'Pastel', icon: '🍰', price: 40, points: 4 },
});

// Amistad que otorga regalar un cultivo cosechado
export const CROP_GIFT_POINTS = 1;
