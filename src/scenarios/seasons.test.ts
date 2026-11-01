// Escenario (aceptación): un año completo de estaciones y clima con los datos
// reales de data/. El día empieza igual que en src/main.ts (beginDay → granja),
// con un RNG fijo para que el clima sea siempre el mismo.
import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { createInitialState, type GameState } from '../core/store';
import { FarmLogic, TILE_STATUS } from '../crops/farmLogic';
import { Economy } from '../economy/economy';
import { beginDay, yearOf } from '../calendar/calendar';
import { BALANCE } from '../../data/balance';
import { CROPS } from '../../data/crops';
import { GIFTS } from '../../data/gifts';
import { NPC_DEFS } from '../../data/npcs';
import { ANIMALS, ANIMAL_FEED } from '../../data/animals';
import { FARM_CONFIG, WATERING_CAN_CAPACITY } from '../../data/farm';
import { SEASONS } from '../../data/seasons';

const TILE_COUNT = FARM_CONFIG.cols * FARM_CONFIG.rows;
const YEAR = SEASONS.daysPerSeason * SEASONS.seasons.length;
const SECO = () => 0.99; // por encima de lluvia + nublado en todas las estaciones
const LLUEVE = () => 0;

function makeWorld() {
  const bus = new EventBus();
  const state = createInitialState(BALANCE, CROPS, GIFTS, NPC_DEFS, ANIMALS);
  const farm = new FarmLogic(state, bus, CROPS, TILE_COUNT);
  const economy = new Economy(state, bus, CROPS, GIFTS, ANIMALS, ANIMAL_FEED);
  return { state, farm, economy };
}

// Mismo orden que el DAY_NEW de main.ts
function nextDay(state: GameState, farm: FarmLogic, rng: () => number): void {
  const { seasonChanged, rain } = beginDay(state, state.day + 1, SEASONS, rng);
  farm.newDay();
  if (seasonChanged) farm.changeSeason();
  if (rain) farm.rain();
}

describe('Escenario: estaciones y clima', () => {
  it('cada estación tiene al menos un cultivo que plantar', () => {
    for (const season of SEASONS.seasons) {
      const cultivos = Object.values(CROPS).filter((c) => c.seasons.includes(season.id));
      expect(cultivos.length, season.name).toBeGreaterThan(0);
    }
  });

  it('las estaciones se suceden y tras un año vuelve la primavera', () => {
    const { state, farm } = makeWorld();
    const vistas: string[] = [state.season];
    while (state.day < YEAR + 1) {
      nextDay(state, farm, SECO);
      if (vistas[vistas.length - 1] !== state.season) vistas.push(state.season);
    }
    expect(vistas).toEqual([...SEASONS.seasons.map((s) => s.id), SEASONS.seasons[0].id]);
    expect(yearOf(state.day, SEASONS)).toBe(2);
  });

  it('un cultivo regado solo por la lluvia llega a cosecharse', () => {
    const { state, farm } = makeWorld();
    farm.plant(0, 'zanahoria');
    farm.rain(); // el día de plantar también llueve
    for (let d = 0; d < CROPS.zanahoria.daysToGrow; d++) nextDay(state, farm, LLUEVE);
    expect(state.water).toBe(WATERING_CAN_CAPACITY); // la regadera ni se toca
    expect(farm.harvest(0)).toBe('zanahoria');
  });

  it('lo que no es de temporada se marchita al llegar la estación siguiente', () => {
    const { state, farm } = makeWorld();
    state.seeds.zanahoria = 1;
    state.seeds.tomate = 1;
    farm.plant(0, 'zanahoria'); // primavera, otoño e invierno
    farm.plant(1, 'tomate'); // primavera y verano
    while (state.season === 'primavera') nextDay(state, farm, LLUEVE);
    expect(state.season).toBe('verano');
    expect(farm.status(0).kind).toBe(TILE_STATUS.WITHERED); // la zanahoria no aguanta el verano
    expect(farm.status(1).kind).not.toBe(TILE_STATUS.WITHERED); // el tomate sigue
  });

  it('fuera de temporada la tienda no vende la semilla ni se puede plantar', () => {
    const { state, farm, economy } = makeWorld();
    while (state.season !== 'otono') nextDay(state, farm, SECO);
    state.money = 1000;
    state.seeds.tomate = 1;
    expect(economy.buySeed('tomate')).toBe(false);
    expect(farm.plant(0, 'tomate')).toBe(false);
    expect(state.seeds.tomate).toBe(1);
    expect(economy.buySeed('calabaza')).toBe(true);
    expect(farm.plant(0, 'calabaza')).toBe(true);
  });
});
