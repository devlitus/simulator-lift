import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, EVENTS } from '../core/events';
import { FarmLogic, TILE_STATUS, type FarmEnergy, type FarmState } from './farmLogic';
import { WATERING_CAN_CAPACITY, WILT_DAYS } from '../../data/farm';
import type { CropDef } from '../../data/schemas';

const CROPS: Record<string, CropDef> = {
  zanahoria: {
    name: 'Zanahoria',
    icon: '🥕',
    seedPrice: 10,
    sellPrice: 25,
    daysToGrow: 2,
    color: '#e07b2a',
    seasons: ['primavera'],
  },
};

function makeState(): FarmState {
  return { seeds: { zanahoria: 2 }, produce: { zanahoria: 0 }, water: WATERING_CAN_CAPACITY };
}

describe('FarmLogic', () => {
  let bus: EventBus;
  let state: FarmState;
  let farm: FarmLogic;

  beforeEach(() => {
    bus = new EventBus();
    state = makeState();
    farm = new FarmLogic(state, bus, CROPS, 4);
  });

  it('planta consumiendo una semilla del inventario', () => {
    expect(farm.plant(0, 'zanahoria')).toBe(true);
    expect(state.seeds.zanahoria).toBe(1);
    expect(farm.status(0).kind).toBe(TILE_STATUS.GROWING);
  });

  it('no planta sin semillas ni sobre un surco ocupado', () => {
    state.seeds.zanahoria = 0;
    expect(farm.plant(0, 'zanahoria')).toBe(false);

    state.seeds.zanahoria = 5;
    expect(farm.plant(0, 'zanahoria')).toBe(true);
    expect(farm.plant(0, 'zanahoria')).toBe(false); // ya ocupado
  });

  it('avisa del riego con el índice del surco, solo si riega', () => {
    const regados: number[] = [];
    bus.on(EVENTS.FARM_WATERED, ({ index }) => regados.push(index));
    expect(farm.water(1)).toBe(false); // surco vacío
    farm.plant(1, 'zanahoria');
    expect(farm.water(1)).toBe(true);
    expect(farm.water(1)).toBe(false); // ya regado
    expect(regados).toEqual([1]);
  });

  it('cada riego gasta agua de la regadera y vacía no riega', () => {
    state.seeds.zanahoria = 4;
    for (let i = 0; i < 4; i++) farm.plant(i, 'zanahoria');
    state.water = 2;
    expect(farm.water(0)).toBe(true);
    expect(farm.water(1)).toBe(true);
    expect(state.water).toBe(0);
    expect(farm.water(2)).toBe(false); // regadera vacía
    expect(farm.tiles[2]!.watered).toBe(false);
    expect(state.water).toBe(0);
  });

  it('regar un surco que no lo necesita no gasta agua', () => {
    expect(farm.water(0)).toBe(false); // vacío
    farm.plant(0, 'zanahoria');
    farm.water(0);
    expect(farm.water(0)).toBe(false); // ya regado
    expect(state.water).toBe(WATERING_CAN_CAPACITY - 1);
  });

  it('el pozo llena la regadera hasta su capacidad', () => {
    expect(farm.canRefill()).toBe(false);
    expect(farm.refillWater()).toBe(false); // ya llena
    state.water = 0;
    expect(farm.canRefill()).toBe(true);
    expect(farm.refillWater()).toBe(true);
    expect(state.water).toBe(WATERING_CAN_CAPACITY);
    expect(farm.canRefill()).toBe(false);
  });

  it('crece un día por cada día regado hasta madurar', () => {
    farm.plant(0, 'zanahoria');
    farm.water(0);
    farm.newDay();
    expect(farm.status(0).kind).toBe(TILE_STATUS.GROWING);

    farm.water(0);
    farm.newDay();
    expect(farm.status(0).kind).toBe(TILE_STATUS.MATURE);
  });

  it('se marchita tras WILT_DAYS días consecutivos sin agua', () => {
    farm.plant(0, 'zanahoria');
    for (let i = 0; i < WILT_DAYS - 1; i++) {
      farm.newDay(); // sin regar
      expect(farm.status(0).kind).toBe(TILE_STATUS.GROWING);
    }
    farm.newDay();
    expect(farm.status(0).kind).toBe(TILE_STATUS.WITHERED);
  });

  it('solo cosecha cultivos maduros y suma a la cosecha del inventario', () => {
    farm.plant(0, 'zanahoria');
    expect(farm.harvest(0)).toBeNull(); // aún no crece

    farm.water(0);
    farm.newDay();
    farm.water(0);
    farm.newDay();
    expect(farm.harvest(0)).toBe('zanahoria');
    expect(state.produce.zanahoria).toBe(1);
    expect(farm.status(0).kind).toBe(TILE_STATUS.EMPTY);
  });

  it('emite FARM_HARVESTED con el tipo cosechado', () => {
    farm.plant(0, 'zanahoria');
    farm.water(0);
    farm.newDay();
    farm.water(0);
    farm.newDay();

    let payload: { type: string } | null = null;
    bus.on(EVENTS.FARM_HARVESTED, (p) => {
      payload = p;
    });
    farm.harvest(0);
    expect(payload).toEqual({ type: 'zanahoria' });
  });

  it('no planta fuera de temporada', () => {
    state.season = 'verano';
    expect(farm.plant(0, 'zanahoria')).toBe(false);
    expect(state.seeds.zanahoria).toBe(2); // no gasta la semilla
    state.season = 'primavera';
    expect(farm.plant(0, 'zanahoria')).toBe(true);
  });

  it('la lluvia riega los cultivos vivos sin gastar agua', () => {
    farm.plant(0, 'zanahoria');
    farm.plant(1, 'zanahoria');
    expect(farm.rain()).toBe(2);
    expect(state.water).toBe(WATERING_CAN_CAPACITY);
    farm.newDay();
    expect(farm.status(0).crop!.stage).toBe(1);
    expect(farm.water(0)).toBe(true); // el día siguiente vuelve a necesitar agua
  });

  it('la lluvia no resucita cultivos marchitos', () => {
    farm.plant(0, 'zanahoria');
    for (let i = 0; i < WILT_DAYS; i++) farm.newDay();
    expect(farm.rain()).toBe(0);
    expect(farm.status(0).kind).toBe(TILE_STATUS.WITHERED);
  });

  it('al cambiar de estación se marchitan los cultivos que no son de temporada', () => {
    state.season = 'primavera';
    farm.plant(0, 'zanahoria');
    state.season = 'verano';
    expect(farm.changeSeason()).toBe(1);
    expect(farm.status(0).kind).toBe(TILE_STATUS.WITHERED);
  });

  it('al cambiar de estación respeta los cultivos que siguen en temporada', () => {
    state.season = 'primavera';
    farm.plant(0, 'zanahoria');
    expect(farm.changeSeason()).toBe(0);
    expect(farm.status(0).kind).toBe(TILE_STATUS.GROWING);
  });

  it('serializa y restaura el estado de la parcela', () => {
    farm.plant(0, 'zanahoria');
    farm.water(0);
    const snapshot = farm.serialize();

    const bus2 = new EventBus();
    const farm2 = new FarmLogic(makeState(), bus2, CROPS, 4);
    farm2.deserialize(snapshot);
    expect(farm2.status(0).crop).toEqual(farm.status(0).crop);
  });
});

describe('FarmLogic con energía', () => {
  // Medidor mínimo: cada labor cuesta 1 y solo quedan `left` puntos
  function makeEnergy(left: number): FarmEnergy & { left: number } {
    return {
      left,
      cost: () => 1,
      canAfford() {
        return this.left >= 1;
      },
      spend() {
        if (this.left < 1) return false;
        this.left--;
        return true;
      },
    };
  }

  it('cada labor gasta energía', () => {
    const state = makeState();
    const energy = makeEnergy(10);
    const farm = new FarmLogic(state, new EventBus(), CROPS, 4, energy);
    farm.plant(0, 'zanahoria');
    farm.water(0);
    farm.newDay();
    farm.water(0);
    farm.newDay();
    expect(farm.harvest(0)).toBe('zanahoria');
    expect(energy.left).toBe(6);
  });

  it('agotado no planta, ni riega, ni cosecha, ni limpia, y no cambia nada', () => {
    const state = makeState();
    const energy = makeEnergy(1);
    const farm = new FarmLogic(state, new EventBus(), CROPS, 4, energy);
    farm.plant(0, 'zanahoria'); // gasta la última energía
    expect(farm.canAfford('plant')).toBe(false);
    expect(farm.plant(1, 'zanahoria')).toBe(false);
    expect(state.seeds.zanahoria).toBe(1);
    expect(farm.water(0)).toBe(false);
    expect(state.water).toBe(WATERING_CAN_CAPACITY);
    expect(farm.status(0).crop!.watered).toBe(false);
    expect(farm.clear(0)).toBe(false);
    expect(farm.status(0).kind).toBe(TILE_STATUS.GROWING);
  });

  it('una labor inválida no gasta energía', () => {
    const energy = makeEnergy(5);
    const farm = new FarmLogic(makeState(), new EventBus(), CROPS, 4, energy);
    expect(farm.water(0)).toBe(false); // surco vacío
    expect(farm.harvest(0)).toBe(null);
    expect(farm.clear(0)).toBe(false);
    expect(energy.left).toBe(5);
  });
});
