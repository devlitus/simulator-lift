// Store: crea el estado central del juego a partir de los archivos de datos.
// Es un objeto plano mutable compartido: los sistemas de dominio lo mutan y
// notifican el cambio emitiendo eventos por el EventBus (ver core/events.ts).
import type { BalanceConfig, CropDef, GiftDef, NpcDef } from '../../data/schemas';

// Forma del estado central compartido por todos los sistemas de dominio.
// Es un objeto plano e intencionalmente sin métodos: la lógica vive en las
// clases de dominio (FarmLogic, Economy, Friendship, QuestSystem), que lo
// reciben por constructor y lo mutan directamente.
export interface GameState {
  day: number;
  money: number;
  seeds: Record<string, number>;
  produce: Record<string, number>;
  gifts: Record<string, number>;
  selectedSeed: string;
  /** puntos de amistad por id de NPC */
  friendships: Record<string, number>;
  /** npcId → ya se habló hoy (se resetea cada día) */
  talkedToday: Record<string, boolean>;
}

export function createInitialState(
  balance: BalanceConfig,
  cropsData: Record<string, CropDef>,
  giftsData: Record<string, GiftDef>,
  npcDefs: NpcDef[],
): GameState {
  const seeds: Record<string, number> = {};
  const produce: Record<string, number> = {};
  for (const key of Object.keys(cropsData)) {
    seeds[key] = balance.startSeeds[key] || 0;
    produce[key] = 0;
  }
  const gifts: Record<string, number> = {};
  for (const key of Object.keys(giftsData)) gifts[key] = 0;

  const friendships: Record<string, number> = {};
  for (const npc of npcDefs) friendships[npc.id] = 0;

  return {
    day: 1,
    money: balance.startMoney,
    seeds,
    produce,
    gifts,
    selectedSeed: Object.keys(cropsData)[0],
    friendships,
    talkedToday: {},
  };
}
