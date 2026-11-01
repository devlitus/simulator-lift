// Escenario (aceptación): la jornada del granjero con energía, con los datos
// reales de data/. Trabajar la parcela cansa, dormir en la cama repone la
// energía y quedarse despierto hasta la hora límite cuesta dinero. El orden de
// las llamadas es el de src/main.ts (sleep / passOut → día nuevo).
import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/events';
import { createInitialState } from '../core/store';
import { buildSave, applySave } from '../core/save';
import { FarmLogic, TILE_STATUS } from '../crops/farmLogic';
import { QuestSystem } from '../quests/questSystem';
import { AnimalLogic } from '../animals/animalLogic';
import { Energy } from '../player/energy';
import { canSleep, shouldPassOut } from '../world/sleep';
import { BALANCE } from '../../data/balance';
import { CROPS } from '../../data/crops';
import { GIFTS } from '../../data/gifts';
import { NPC_DEFS } from '../../data/npcs';
import { ANIMALS } from '../../data/animals';
import { QUEST_DEFS } from '../../data/quests';
import { FARM_CONFIG } from '../../data/farm';

const TILE_COUNT = FARM_CONFIG.cols * FARM_CONFIG.rows;
const { energy: CFG } = BALANCE;

function makeWorld() {
  const bus = new EventBus();
  const state = createInitialState(BALANCE, CROPS, GIFTS, NPC_DEFS, ANIMALS);
  const energy = new Energy(state, bus, CFG);
  const farm = new FarmLogic(state, bus, CROPS, TILE_COUNT, energy);
  const quests = new QuestSystem(state, bus, QUEST_DEFS);
  const animals = new AnimalLogic(state, bus, ANIMALS, BALANCE.startAnimals);
  return { state, energy, farm, quests, animals };
}

describe('Escenario: energía y horario', () => {
  it('la partida empieza con la energía llena', () => {
    const { state } = makeWorld();
    expect(state.energy).toBe(CFG.max);
  });

  it('con una sola barra no se planta y riega la parcela entera', () => {
    const { state, farm } = makeWorld();
    state.seeds.zanahoria = TILE_COUNT;
    state.water = TILE_COUNT; // agua de sobra: aquí solo limita la energía
    let trabajados = 0;
    for (let i = 0; i < TILE_COUNT; i++) {
      if (!farm.plant(i, 'zanahoria')) break;
      if (!farm.water(i)) break;
      trabajados++;
    }
    expect(trabajados).toBeLessThan(TILE_COUNT);
    expect(trabajados).toBeGreaterThan(0);
    expect(state.energy).toBeLessThan(CFG.costs.plant + CFG.costs.water);
  });

  it('agotado no se trabaja la tierra hasta dormir en la cama', () => {
    const { state, farm, energy } = makeWorld();
    state.energy = 0;
    expect(farm.plant(0, 'zanahoria')).toBe(false);
    expect(farm.status(0).kind).toBe(TILE_STATUS.EMPTY);

    expect(canSleep(BALANCE.sleepFromHour, BALANCE.sleepFromHour)).toBe(true);
    energy.rest(); // dormir
    farm.newDay();
    expect(state.energy).toBe(CFG.max);
    expect(farm.plant(0, 'zanahoria')).toBe(true);
  });

  it('quedarse despierto hasta la hora límite: desmayo, media energía y menos dinero', () => {
    const { state, energy } = makeWorld();
    state.money = 300;
    state.energy = 7;
    expect(shouldPassOut(CFG.passOutHour, CFG.passOutHour)).toBe(true);
    const perdido = energy.faint();
    expect(perdido).toBe(Math.min(CFG.faintMaxLoss, Math.floor(300 * CFG.faintMoneyLoss)));
    expect(state.money).toBe(300 - perdido);
    expect(state.energy).toBe(Math.round(CFG.max * CFG.faintEnergy));
    expect(state.energy).toBeLessThan(CFG.max); // dormir en la cama sale mejor
  });

  it('la energía se guarda y se recupera al cargar', () => {
    const a = makeWorld();
    a.farm.plant(0, 'zanahoria');
    const save = JSON.parse(JSON.stringify(buildSave(a.state, a.farm, a.quests, a.animals)));
    const b = makeWorld();
    expect(applySave(save, b.state, b.farm, b.quests, b.animals)).toBe(true);
    expect(b.state.energy).toBe(CFG.max - CFG.costs.plant);
  });
});
