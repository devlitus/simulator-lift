// Friendship (dominio puro, SIN Babylon): puntos y niveles de amistad con NPCs.
// Reglas: +1 por la primera conversación del día; regalos y recompensas suman.
import { EVENTS, EventBus } from '../core/events';
import { FRIENDSHIP_LEVELS, TALK_POINTS } from '../../data/friendship';
import type { NpcDef } from '../../data/schemas';

/** Índice del nivel de amistad alcanzado con `points` puntos. */
export function levelIndex(points: number): number {
  let idx = 0;
  FRIENDSHIP_LEVELS.forEach((lvl, i) => {
    if (points >= lvl.min) idx = i;
  });
  return idx;
}

export function levelLabel(points: number): string {
  return FRIENDSHIP_LEVELS[levelIndex(points)].label;
}

// Subconjunto del GameState (ver core/store.ts) que necesita Friendship.
export interface FriendshipState {
  friendships: Record<string, number>;
  talkedToday: Record<string, boolean>;
}

export class Friendship {
  state: FriendshipState;
  bus: EventBus;
  names: Record<string, string>;

  /** npcDefs se usa solo para el nombre en la notificación de subida de nivel. */
  constructor(state: FriendshipState, bus: EventBus, npcDefs: Array<Pick<NpcDef, 'id' | 'name'>>) {
    this.state = state;
    this.bus = bus;
    this.names = Object.fromEntries(npcDefs.map((n) => [n.id, n.name]));
    bus.on(EVENTS.FRIENDSHIP_ADD, ({ npcId, pts }) => this.add(npcId, pts));
  }

  add(npcId: string, pts: number): void {
    const before = levelIndex(this.state.friendships[npcId]);
    this.state.friendships[npcId] += pts;
    const points = this.state.friendships[npcId];
    const after = levelIndex(points);
    const leveledUp = after > before;
    this.bus.emit(EVENTS.FRIENDSHIP_CHANGED, {
      npcId,
      points,
      leveledUp,
      levelLabel: levelLabel(points),
    });
    if (leveledUp) {
      this.bus.emit(EVENTS.NOTIFY, `❤️ ${this.names[npcId]} ahora es: ${levelLabel(points)}`);
    }
  }

  // Primera conversación del día: suma puntos y lo notifica a las misiones.
  // Devuelve true si era la primera vez hoy.
  talkTo(npcId: string): boolean {
    if (this.state.talkedToday[npcId]) return false;
    this.state.talkedToday[npcId] = true;
    this.add(npcId, TALK_POINTS);
    this.bus.emit(EVENTS.NPC_TALKED, { npcId });
    return true;
  }

  pointsOf(npcId: string): number {
    return this.state.friendships[npcId];
  }

  levelIndexOf(npcId: string): number {
    return levelIndex(this.state.friendships[npcId]);
  }

  labelOf(npcId: string): string {
    return levelLabel(this.state.friendships[npcId]);
  }
}
