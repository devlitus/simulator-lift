import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSave,
  applySave,
  SaveRepository,
  type AnimalPersistence,
  type FarmPersistence,
  type QuestPersistence,
} from './save';
import type { GameState } from './store';

function makeState(): GameState {
  return {
    day: 3,
    money: 120,
    seeds: { zanahoria: 1 },
    produce: { zanahoria: 2 },
    gifts: { flor: 1 },
    feed: 2,
    animalProducts: { gallina: 1 },
    selectedSeed: 'zanahoria',
    friendships: { marta: 5 },
    talkedToday: { marta: true },
  };
}
const fakeFarm = {
  serialize: () => [{ type: 'zanahoria', stage: 1 }],
  deserialize: () => {},
} as unknown as FarmPersistence;
const fakeQuests = {
  serialize: () => [{ id: 'q1', state: 'active', progress: 0, talked: [] }],
  deserialize: () => {},
} as unknown as QuestPersistence;
const fakeAnimals = {
  serialize: () => [{ type: 'gallina', fed: true }],
  deserialize: () => {},
} as unknown as AnimalPersistence;

describe('buildSave / applySave', () => {
  it('serializa todos los campos relevantes del estado', () => {
    const data = buildSave(makeState(), fakeFarm, fakeQuests, fakeAnimals);
    expect(data).toMatchObject({
      version: 1,
      day: 3,
      money: 120,
      seeds: { zanahoria: 1 },
      produce: { zanahoria: 2 },
      feed: 2,
      animalProducts: { gallina: 1 },
    });
    expect(data.farm).toEqual(fakeFarm.serialize());
    expect(data.quests).toEqual(fakeQuests.serialize());
    expect(data.animals).toEqual(fakeAnimals.serialize());
  });

  it('restaura el estado a partir de un save válido', () => {
    const state: GameState = {
      day: 1,
      money: 0,
      seeds: {},
      produce: {},
      gifts: {},
      feed: 0,
      animalProducts: {},
      selectedSeed: 'x',
      friendships: {},
      talkedToday: { x: true },
    };
    const saved = {
      day: 5,
      money: 200,
      seeds: { tomate: 3 },
      produce: {},
      gifts: {},
      feed: 4,
      animalProducts: { gallina: 2 },
      selectedSeed: 'tomate',
      friendships: { gon: 2 },
      animals: [{ type: 'gallina', fed: true }],
    };
    const farm = { serialize: () => [], deserialize: () => {} } as unknown as FarmPersistence;
    const quests = { serialize: () => [], deserialize: () => {} } as unknown as QuestPersistence;
    let loadedAnimals: unknown = 'sin llamar';
    const animals = {
      serialize: () => [],
      deserialize: (d: unknown) => {
        loadedAnimals = d;
      },
    } as unknown as AnimalPersistence;

    expect(applySave(saved, state, farm, quests, animals)).toBe(true);
    expect(state.day).toBe(5);
    expect(state.money).toBe(200);
    expect(state.seeds).toEqual({ tomate: 3 });
    expect(state.feed).toBe(4);
    expect(state.animalProducts).toEqual({ gallina: 2 });
    expect(loadedAnimals).toEqual(saved.animals);
    expect(state.talkedToday).toEqual({}); // se resetea al cargar
  });

  it('acepta saves antiguos sin campos de animales (todos opcionales)', () => {
    const state = makeState();
    const saved = { day: 7, money: 50 }; // save de antes de la feature
    expect(applySave(saved, state, fakeFarm, fakeQuests, fakeAnimals)).toBe(true);
    expect(state.day).toBe(7);
    expect(state.feed).toBe(2); // conserva el valor actual
    expect(state.animalProducts).toEqual({ gallina: 1 });
  });

  it('devuelve false y no muta el estado si no hay datos', () => {
    const state = makeState();
    const before = JSON.stringify(state);
    expect(applySave(null, state, fakeFarm, fakeQuests, fakeAnimals)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });
});

function makeFakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('SaveRepository', () => {
  let repo: SaveRepository;

  beforeEach(() => {
    repo = new SaveRepository(makeFakeStorage(), 'test_key');
  });

  it('guarda y recupera los mismos datos', () => {
    expect(repo.save({ day: 7 })).toBe(true);
    expect(repo.load()).toEqual({ day: 7 });
  });

  it('load() devuelve null si no hay nada guardado', () => {
    expect(repo.load()).toBeNull();
  });

  it('clear() borra la partida guardada', () => {
    repo.save({ day: 1 });
    repo.clear();
    expect(repo.load()).toBeNull();
  });
});
