// Datos de niveles de amistad (umbrales de puntos → etiqueta).
import { FriendshipLevelsSchema, type FriendshipLevel } from './schemas';

export const FRIENDSHIP_LEVELS: FriendshipLevel[] = FriendshipLevelsSchema.parse([
  { min: 0, label: 'Desconocido' },
  { min: 3, label: 'Conocido' },
  { min: 7, label: 'Amigo' },
  { min: 13, label: 'Mejor amigo' },
]);

// Puntos por la primera conversación del día con un NPC
export const TALK_POINTS = 1;
