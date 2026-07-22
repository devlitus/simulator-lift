// Simulación fuzz determinista: N días de acciones aleatorias (seed fija) sobre
// el mundo de dominio completo. No prueba ejemplos concretos (eso es
// acceptance.test.ts) sino invariantes universales que deben cumplirse siempre:
// contadores sanos, dinero nunca negativo, máquinas de estado coherentes,
// producción animal acotada y save/load idempotente. Sirve para cazar bugs
// silenciosos en caminos que nadie escribió a mano: si falla, el mensaje
// indica seed/día/acción y el caso se reproduce siempre (misma seed).
import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { createInitialState } from '../core/store';
import { buildSave, applySave } from '../core/save';
import { FarmLogic, TILE_STATUS } from '../crops/farmLogic';
import { Economy } from '../economy/economy';
import { QuestSystem } from '../quests/questSystem';
import { AnimalLogic } from '../animals/animalLogic';
import { Friendship } from '../npcs/friendship';
import { BALANCE } from '../../data/balance';
import { CROPS } from '../../data/crops';
import { GIFTS } from '../../data/gifts';
import { NPC_DEFS } from '../../data/npcs';
import { ANIMALS, ANIMAL_FEED } from '../../data/animals';
import { QUEST_DEFS } from '../../data/quests';
import { FARM_CONFIG } from '../../data/farm';

const TILE_COUNT = FARM_CONFIG.cols * FARM_CONFIG.rows;
const DAYS = 90; // ~3 meses de juego por seed
const ACTIONS_PER_DAY = 12;
const SEEDS = [1, 7, 42, 1337];

// PRNG determinista (mulberry32): misma seed → misma secuencia de acciones.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[randInt(rng, arr.length)];
}

// Mundo de dominio completo cableado al mismo bus, como en src/main.ts.
function makeWorld() {
  const bus = new EventBus();
  const state = createInitialState(BALANCE, CROPS, GIFTS, NPC_DEFS, ANIMALS);
  const farm = new FarmLogic(state, bus, CROPS, TILE_COUNT);
  const economy = new Economy(state, bus, CROPS, GIFTS, ANIMALS, ANIMAL_FEED);
  const quests = new QuestSystem(state, bus, QUEST_DEFS);
  const animals = new AnimalLogic(state, bus, ANIMALS, BALANCE.startAnimals);
  const friendship = new Friendship(state, bus, NPC_DEFS);
  return { bus, state, farm, economy, quests, animals, friendship };
}
type World = ReturnType<typeof makeWorld>;

const cropKeys = Object.keys(CROPS);
const giftKeys = Object.keys(GIFTS);
const animalKeys = Object.keys(ANIMALS);
const npcIds = NPC_DEFS.map((n) => n.id);
const QUEST_STATES = ['available', 'active', 'ready', 'done'];

// Invariantes universales: deben cumplirse tras CUALQUIER acción.
// doneQuests registra las misiones terminadas para afirmar que done es terminal.
function checkInvariants(w: World, doneQuests: Set<string>): void {
  const { state, farm, quests } = w;

  // Dinero y contadores: siempre enteros y nunca negativos
  expect(Number.isInteger(state.money) && state.money >= 0).toBe(true);
  expect(Number.isInteger(state.feed) && state.feed >= 0).toBe(true);
  for (const rec of [state.seeds, state.produce, state.gifts, state.animalProducts]) {
    for (const v of Object.values(rec)) {
      expect(Number.isInteger(v) && v >= 0).toBe(true);
    }
  }

  // La semilla seleccionada siempre es un cultivo existente
  expect(cropKeys).toContain(state.selectedSeed);

  // Parcela: máquina de estados coherente en cada surco
  farm.tiles.forEach((tile, i) => {
    const kind = farm.status(i).kind;
    expect(Object.values(TILE_STATUS)).toContain(kind);
    if (!tile) return;
    expect(tile.stage).toBeGreaterThanOrEqual(0);
    expect(tile.wiltDays).toBeGreaterThanOrEqual(0);
    if (tile.withered) expect(kind).toBe(TILE_STATUS.WITHERED);
  });

  // Amistad: puntos enteros >= 0 y solo NPCs conocidos
  for (const [npcId, pts] of Object.entries(state.friendships)) {
    expect(npcIds).toContain(npcId);
    expect(Number.isInteger(pts) && pts >= 0).toBe(true);
  }

  // Misiones: estado válido, progreso acotado, talked sin repetidos, done terminal
  for (const q of quests.quests) {
    expect(QUEST_STATES).toContain(q.state);
    expect(q.progress).toBeGreaterThanOrEqual(0);
    expect(q.progress).toBeLessThanOrEqual(q.amount);
    expect(new Set(q.talked).size).toBe(q.talked.length);
    if (q.state === 'done') doneQuests.add(q.id);
    if (doneQuests.has(q.id)) expect(q.state).toBe('done');
  }
}

// Una acción aleatoria del repertorio del jugador. Las llamadas "tontas"
// (regar un surco vacío, entregar sin ítems…) son parte del fuzz: las APIs
// deben rechazarlas devolviendo false/null, nunca lanzar ni corromper estado.
function randomAction(w: World, rng: () => number): string {
  const r = rng();
  if (r < 0.15) {
    w.farm.plant(randInt(rng, TILE_COUNT), pick(rng, cropKeys));
    return 'plant';
  }
  if (r < 0.3) {
    w.farm.water(randInt(rng, TILE_COUNT));
    return 'water';
  }
  if (r < 0.4) {
    w.farm.harvest(randInt(rng, TILE_COUNT));
    return 'harvest';
  }
  if (r < 0.45) {
    w.farm.clear(randInt(rng, TILE_COUNT));
    return 'clear';
  }
  if (r < 0.52) {
    w.economy.buySeed(pick(rng, cropKeys));
    return 'buySeed';
  }
  if (r < 0.56) {
    w.economy.buyFeed();
    return 'buyFeed';
  }
  if (r < 0.59) {
    w.economy.buyGift(pick(rng, giftKeys));
    return 'buyGift';
  }
  if (r < 0.66) {
    w.animals.buyAnimal(pick(rng, animalKeys));
    return 'buyAnimal';
  }
  if (r < 0.76) {
    if (w.animals.animals.length > 0) w.animals.feedAnimal(randInt(rng, w.animals.animals.length));
    return 'feedAnimal';
  }
  if (r < 0.82) {
    w.economy.sellAllProduce();
    return 'sellAll';
  }
  if (r < 0.9) {
    w.friendship.talkTo(pick(rng, npcIds));
    return 'talk';
  }
  if (r < 0.95) {
    const available = w.quests.quests.filter((q) => q.state === 'available');
    if (available.length > 0) w.quests.start(pick(rng, available).id);
    return 'questStart';
  }
  const npc = pick(rng, npcIds);
  w.quests.deliver(npc);
  w.quests.complete(npc);
  return 'questResolve';
}

// Avance de día replicando el listener de DAY_NEW de src/main.ts, más el
// invariante de producción: cada animal deja como máximo 1 producto al día.
function advanceDay(w: World): void {
  const productsBefore = Object.values(w.state.animalProducts).reduce((a, b) => a + b, 0);
  w.state.day++;
  w.state.talkedToday = {};
  w.farm.newDay();
  w.animals.newDay();
  const productsAfter = Object.values(w.state.animalProducts).reduce((a, b) => a + b, 0);
  expect(productsAfter - productsBefore).toBeLessThanOrEqual(w.animals.animals.length);
}

// Round-trip de guardado por JSON (como localStorage): el save aplicado a un
// mundo nuevo debe reconstruir un save idéntico, y la simulación SIGUE sobre
// el mundo restaurado (cargar no puede dejar el juego roto).
function roundTrip(w: World): World {
  const save = JSON.parse(JSON.stringify(buildSave(w.state, w.farm, w.quests, w.animals)));
  const restored = makeWorld();
  const ok = applySave(save, restored.state, restored.farm, restored.quests, restored.animals);
  expect(ok).toBe(true);
  const saveAgain = JSON.parse(
    JSON.stringify(buildSave(restored.state, restored.farm, restored.quests, restored.animals)),
  );
  expect(saveAgain).toEqual(save);
  return restored;
}

describe.each(SEEDS)('Simulación fuzz (seed %i)', (seed) => {
  it(`mantiene los invariantes durante ${DAYS} días con save/load y nunca lanza`, () => {
    const rng = mulberry32(seed);
    let world = makeWorld();
    const doneQuests = new Set<string>();

    for (let d = 0; d < DAYS; d++) {
      for (let a = 0; a < ACTIONS_PER_DAY; a++) {
        const action = randomAction(world, rng);
        try {
          checkInvariants(world, doneQuests);
        } catch (e) {
          throw new Error(
            `Invariante roto — seed=${seed} día=${world.state.day} acción=${action}: ${(e as Error).message}`,
          );
        }
      }
      advanceDay(world);
      // Guardar/cargar de forma aleatoria y siempre en el último día
      if (rng() < 0.08 || d === DAYS - 1) {
        world = roundTrip(world);
      }
    }
    checkInvariants(world, doneQuests);
  });
});
