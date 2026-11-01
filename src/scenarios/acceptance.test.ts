// Tests de escenario (aceptación): recorren bucles completos de juego usando
// los datos reales de data/ — a diferencia de los tests unitarios junto a cada
// sistema, que usan fixtures mínimas. Cada describe codifica un criterio del
// tipo "un ciclo de cultivo es rentable" o "una misión puede completarse
// jugando". La aritmética se deriva de los datos para que un rebalanceo no
// rompa el test salvo que viole el criterio.
import { describe, it, expect } from 'vitest';
import { EventBus, EVENTS } from '../core/events';
import { createInitialState } from '../core/store';
import { FarmLogic } from '../crops/farmLogic';
import { Economy } from '../economy/economy';
import { QuestSystem } from '../quests/questSystem';
import { BALANCE } from '../../data/balance';
import { CROPS } from '../../data/crops';
import { GIFTS } from '../../data/gifts';
import { NPC_DEFS } from '../../data/npcs';
import { ANIMALS, ANIMAL_FEED } from '../../data/animals';
import { QUEST_DEFS } from '../../data/quests';
import { FARM_CONFIG, WATERING_CAN_CAPACITY, WILT_DAYS } from '../../data/farm';

const TILE_COUNT = FARM_CONFIG.cols * FARM_CONFIG.rows;

// Monta el mundo de dominio completo (sin vistas): estado real + todos los
// sistemas cableados al mismo bus, como hace src/main.ts en el juego.
function makeWorld() {
  const bus = new EventBus();
  const state = createInitialState(BALANCE, CROPS, GIFTS, NPC_DEFS, ANIMALS);
  const farm = new FarmLogic(state, bus, CROPS, TILE_COUNT);
  const economy = new Economy(state, bus, CROPS, GIFTS, ANIMALS, ANIMAL_FEED);
  const quests = new QuestSystem(state, bus, QUEST_DEFS);
  return { bus, state, farm, economy, quests };
}

// Riega todos los cultivos vivos y avanza un día (el ciclo diario del jugador).
// Cuando la regadera se vacía, el jugador va al pozo a llenarla.
function waterAllAndNewDay(farm: FarmLogic): void {
  farm.tiles.forEach((tile, i) => {
    if (!tile || tile.withered) return;
    if (farm.state.water === 0) farm.refillWater();
    farm.water(i);
  });
  farm.newDay();
}

// Planta `count` surcos del cultivo y los cuida hasta cosecharlos.
function growAndHarvest(farm: FarmLogic, type: string, count: number): void {
  for (let i = 0; i < count; i++) farm.plant(i, type);
  for (let d = 0; d < CROPS[type].daysToGrow; d++) waterAllAndNewDay(farm);
  for (let i = 0; i < count; i++) farm.harvest(i);
}

describe('Escenario: el ciclo económico de la granja es rentable', () => {
  it('todo cultivo del catálogo tiene margen positivo (vender > semilla)', () => {
    for (const crop of Object.values(CROPS)) {
      expect(crop.sellPrice).toBeGreaterThan(crop.seedPrice);
    }
  });

  it('convertir las semillas iniciales en cosecha aumenta el dinero', () => {
    const { state, farm, economy } = makeWorld();
    const initialSeeds = BALANCE.startSeeds['zanahoria'];

    growAndHarvest(farm, 'zanahoria', initialSeeds);
    expect(state.produce['zanahoria']).toBe(initialSeeds);

    const earned = economy.sellAllProduce();
    expect(earned).toBe(CROPS['zanahoria'].sellPrice * initialSeeds);
    expect(state.money).toBe(BALANCE.startMoney + earned);
  });

  it('comprar semilla y no regarla arruina la inversión', () => {
    const { state, farm, economy } = makeWorld();
    state.season = 'otono'; // la calabaza es de verano y otoño

    expect(economy.buySeed('calabaza')).toBe(true);
    const moneyAfterBuy = state.money;
    farm.plant(0, 'calabaza');

    for (let d = 0; d < WILT_DAYS; d++) farm.newDay(); // sin regar
    expect(farm.status(0).kind).toBe('withered');
    expect(farm.harvest(0)).toBeNull();

    expect(economy.sellAllProduce()).toBe(0);
    expect(state.money).toBe(moneyAfterBuy); // perdió el precio de la semilla
    expect(state.money).toBeLessThan(BALANCE.startMoney);
  });
});

describe('Escenario: la regadera se vacía y se llena en el pozo', () => {
  it('empieza llena, riega 5 surcos y obliga a ir al pozo para el sexto', () => {
    const { state, farm, economy } = makeWorld();
    state.money = 1000;
    const surcos = WATERING_CAN_CAPACITY + 1;
    for (let i = 0; i < surcos; i++) {
      economy.buySeed('zanahoria');
      farm.plant(i, 'zanahoria');
    }

    expect(state.water).toBe(WATERING_CAN_CAPACITY);
    for (let i = 0; i < WATERING_CAN_CAPACITY; i++) expect(farm.water(i)).toBe(true);
    expect(state.water).toBe(0);
    expect(farm.water(WATERING_CAN_CAPACITY)).toBe(false); // sin agua no riega

    expect(farm.refillWater()).toBe(true); // visita al pozo
    expect(farm.water(WATERING_CAN_CAPACITY)).toBe(true);
    expect(state.water).toBe(WATERING_CAN_CAPACITY - 1);
  });

  it('el agua de la regadera no se repone sola al cambiar de día', () => {
    const { state, farm } = makeWorld();
    state.water = 1;
    farm.newDay();
    expect(state.water).toBe(1);
  });
});

describe('Escenario: la misión "Cosecha abundante" se completa jugando', () => {
  it('aceptar, cosechar 3 tomates y cobrar la recompensa', () => {
    const { state, farm, economy, quests } = makeWorld();
    const def = QUEST_DEFS.find((q) => q.id === 'tomates')!;

    quests.start('tomates');
    for (let i = 0; i < def.amount; i++) economy.buySeed('tomate');
    const moneyAfterSeeds = state.money;

    growAndHarvest(farm, 'tomate', def.amount);
    expect(quests.byId('tomates')!.state).toBe('ready');

    quests.complete('gon');
    expect(quests.byId('tomates')!.state).toBe('done');
    expect(state.money).toBe(moneyAfterSeeds + (def.reward.money ?? 0));

    // Los tomates cosechados siguen en inventario y también se pueden vender
    const earned = economy.sellAllProduce();
    expect(earned).toBe(CROPS['tomate'].sellPrice * def.amount);
  });

  it('sin aceptar la misión, cosechar tomates no la completa', () => {
    const { state, farm, economy, quests } = makeWorld();

    for (let i = 0; i < 3; i++) economy.buySeed('tomate');
    growAndHarvest(farm, 'tomate', 3);

    expect(quests.byId('tomates')!.state).toBe('available');
    expect(state.money).toBe(BALANCE.startMoney - 3 * CROPS['tomate'].seedPrice);
  });
});

describe('Escenario: la misión "Nuevo en el pueblo" se completa por eventos', () => {
  it('hablar con 3 NPC distintos la termina y paga la recompensa', () => {
    const { bus, state, quests } = makeWorld();
    const def = QUEST_DEFS.find((q) => q.id === 'conocer')!;

    expect(quests.byId('conocer')!.state).toBe('active'); // autoStart
    for (const npc of NPC_DEFS.slice(0, def.amount)) {
      bus.emit(EVENTS.NPC_TALKED, { npcId: npc.id });
    }

    expect(quests.byId('conocer')!.state).toBe('done');
    expect(state.money).toBe(BALANCE.startMoney + (def.reward.money ?? 0));
  });

  it('hablar dos veces con el mismo NPC no cuenta doble', () => {
    const { bus, quests } = makeWorld();
    const first = NPC_DEFS[0].id;

    bus.emit(EVENTS.NPC_TALKED, { npcId: first });
    bus.emit(EVENTS.NPC_TALKED, { npcId: first });

    expect(quests.byId('conocer')!.progress).toBe(1);
    expect(quests.byId('conocer')!.state).toBe('active');
  });
});
