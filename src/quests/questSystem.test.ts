import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, EVENTS } from '../core/events';
import { QuestSystem, type QuestState } from './questSystem';
import type { QuestDef } from '../../data/schemas';

const QUEST_DEFS: QuestDef[] = [
  {
    id: 'conocer',
    title: 'Nuevo en el pueblo',
    desc: '',
    type: 'talkAll',
    npc: null,
    npcName: null,
    item: null,
    amount: 2,
    autoStart: true,
    reward: { money: 30 },
  },
  {
    id: 'pedido',
    title: 'El primer pedido',
    desc: '',
    type: 'deliver',
    npc: 'marta',
    npcName: 'Marta',
    item: 'zanahoria',
    amount: 2,
    autoStart: false,
    reward: { money: 50, friend: 2 },
  },
  {
    id: 'tomates',
    title: 'Cosecha abundante',
    desc: '',
    type: 'harvest',
    npc: 'gon',
    npcName: 'Gon',
    item: 'tomate',
    amount: 2,
    autoStart: false,
    reward: { money: 80 },
  },
];

function makeState(): QuestState {
  return { money: 0, produce: { zanahoria: 0, tomate: 0 } };
}

describe('QuestSystem', () => {
  let bus: EventBus;
  let state: QuestState;
  let quests: QuestSystem;

  beforeEach(() => {
    bus = new EventBus();
    state = makeState();
    quests = new QuestSystem(state, bus, QUEST_DEFS);
  });

  it('las misiones con autoStart empiezan activas; el resto, disponibles', () => {
    expect(quests.byId('conocer')!.state).toBe('active');
    expect(quests.byId('pedido')!.state).toBe('available');
  });

  it('talkAll se completa al hablar con N npcs distintos y paga la recompensa', () => {
    bus.emit(EVENTS.NPC_TALKED, { npcId: 'marta' });
    expect(quests.byId('conocer')!.state).toBe('active');

    bus.emit(EVENTS.NPC_TALKED, { npcId: 'marta' }); // repetido: no cuenta doble
    expect(quests.byId('conocer')!.progress).toBe(1);

    bus.emit(EVENTS.NPC_TALKED, { npcId: 'gon' });
    expect(quests.byId('conocer')!.state).toBe('done');
    expect(state.money).toBe(30);
  });

  it('deliver: solo se puede entregar con inventario suficiente, y consume lo entregado', () => {
    quests.start('pedido');
    expect(quests.deliverableAt('marta')).toBeNull();

    state.produce.zanahoria = 2;
    expect(quests.deliverableAt('marta')).not.toBeNull();

    quests.deliver('marta');
    expect(state.produce.zanahoria).toBe(0);
    expect(quests.byId('pedido')!.state).toBe('done');
    expect(state.money).toBe(50);
  });

  it('deliver emite FRIENDSHIP_ADD para la recompensa de amistad', () => {
    quests.start('pedido');
    state.produce.zanahoria = 2;
    let payload: { npcId: string; pts: number } | null = null;
    bus.on(EVENTS.FRIENDSHIP_ADD, (p) => {
      payload = p;
    });
    quests.deliver('marta');
    expect(payload).toEqual({ npcId: 'marta', pts: 2 });
  });

  it('harvest: acumula progreso con FARM_HARVESTED y queda "ready" hasta cobrar', () => {
    quests.start('tomates');
    bus.emit(EVENTS.FARM_HARVESTED, { type: 'tomate' });
    expect(quests.byId('tomates')!.state).toBe('active');
    expect(quests.byId('tomates')!.progress).toBe(1);

    bus.emit(EVENTS.FARM_HARVESTED, { type: 'tomate' });
    expect(quests.byId('tomates')!.state).toBe('ready');
    expect(quests.readyAt('gon')).not.toBeNull();

    quests.complete('gon');
    expect(quests.byId('tomates')!.state).toBe('done');
    expect(state.money).toBe(80);
  });

  it('serializa y restaura progreso/estado', () => {
    quests.start('pedido');
    const snapshot = quests.serialize();

    const quests2 = new QuestSystem(makeState(), new EventBus(), QUEST_DEFS);
    quests2.deserialize(snapshot);
    expect(quests2.byId('pedido')!.state).toBe('active');
  });
});
