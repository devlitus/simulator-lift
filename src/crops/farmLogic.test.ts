import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, EVENTS } from '../core/events';
import { FarmLogic, TILE_STATUS, type FarmState } from './farmLogic';
import { WILT_DAYS } from '../../data/farm';
import type { CropDef } from '../../data/schemas';

const CROPS: Record<string, CropDef> = {
  zanahoria: {
    name: 'Zanahoria',
    icon: '🥕',
    seedPrice: 10,
    sellPrice: 25,
    daysToGrow: 2,
    color: '#e07b2a',
  },
};

function makeState(): FarmState {
  return { seeds: { zanahoria: 2 }, produce: { zanahoria: 0 } };
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
