import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, EVENTS } from '../core/events';
import { Friendship, levelIndex, levelLabel, type FriendshipState } from './friendship';

const NPC_DEFS = [
  { id: 'marta', name: 'Marta' },
  { id: 'gon', name: 'Gon' },
];

function makeState(): FriendshipState {
  return { friendships: { marta: 0, gon: 0 }, talkedToday: {} };
}

describe('Friendship', () => {
  let bus: EventBus;
  let state: FriendshipState;
  let friendship: Friendship;

  beforeEach(() => {
    bus = new EventBus();
    state = makeState();
    friendship = new Friendship(state, bus, NPC_DEFS);
  });

  it('talkTo suma puntos solo la primera vez del día', () => {
    expect(friendship.talkTo('marta')).toBe(true);
    expect(friendship.pointsOf('marta')).toBe(1);

    expect(friendship.talkTo('marta')).toBe(false);
    expect(friendship.pointsOf('marta')).toBe(1); // no volvió a sumar
  });

  it('emite NPC_TALKED solo en la primera conversación del día', () => {
    const talked: string[] = [];
    bus.on(EVENTS.NPC_TALKED, (p) => talked.push(p.npcId));
    friendship.talkTo('marta');
    friendship.talkTo('marta');
    expect(talked).toEqual(['marta']);
  });

  it('avisa por NOTIFY solo cuando se sube de nivel', () => {
    const notifications: string[] = [];
    bus.on(EVENTS.NOTIFY, (msg) => notifications.push(msg));

    friendship.add('marta', 1); // 0 -> 1, sigue en "Desconocido" (min 0)
    expect(notifications).toHaveLength(0);

    friendship.add('marta', 5); // 1 -> 6, cruza el umbral de "Conocido" (min 3)
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain('Marta');
  });

  it('levelIndex/levelLabel reflejan los umbrales de amistad', () => {
    expect(levelIndex(0)).toBe(0);
    expect(levelLabel(0)).toBe('Desconocido');
    expect(levelIndex(3)).toBeGreaterThan(0);
  });

  it('FRIENDSHIP_ADD (evento) tiene el mismo efecto que llamar add()', () => {
    bus.emit(EVENTS.FRIENDSHIP_ADD, { npcId: 'gon', pts: 4 });
    expect(friendship.pointsOf('gon')).toBe(4);
  });
});
