import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, EVENTS } from '../core/events';
import { Energy, type EnergyState } from './energy';
import type { EnergyConfig } from '../../data/schemas';

const CFG: EnergyConfig = {
  max: 10,
  costs: { plant: 3, water: 2, harvest: 1, clear: 0 },
  lowWarning: 0.3,
  passOutHour: 2,
  faintEnergy: 0.5,
  faintMoneyLoss: 0.1,
  faintMaxLoss: 50,
};

describe('Energy', () => {
  let bus: EventBus;
  let state: EnergyState;
  let energy: Energy;
  let avisos: string[];

  beforeEach(() => {
    bus = new EventBus();
    state = { energy: CFG.max, money: 200 };
    energy = new Energy(state, bus, CFG);
    avisos = [];
    bus.on(EVENTS.NOTIFY, (m) => avisos.push(m));
  });

  it('cada labor gasta su coste y avisa del cambio', () => {
    let cambios = 0;
    bus.on(EVENTS.ENERGY_CHANGED, () => cambios++);
    expect(energy.spend('plant')).toBe(true);
    expect(energy.spend('water')).toBe(true);
    expect(state.energy).toBe(5);
    expect(cambios).toBe(2);
  });

  it('sin energía suficiente la labor no se hace y la energía no baja', () => {
    state.energy = 2;
    expect(energy.canAfford('plant')).toBe(false);
    expect(energy.spend('plant')).toBe(false);
    expect(state.energy).toBe(2);
    expect(avisos.some((m) => m.includes('agotado'))).toBe(true);
  });

  it('una labor de coste 0 se puede hacer sin energía', () => {
    state.energy = 0;
    expect(energy.spend('clear')).toBe(true);
  });

  it('avisa una sola vez al cruzar el umbral de cansancio', () => {
    energy.spend('plant'); // 7
    energy.spend('plant'); // 4
    expect(avisos.filter((m) => m.includes('poca energía'))).toHaveLength(0);
    energy.spend('harvest'); // 3 (= 30 %)
    energy.spend('harvest'); // 2
    expect(avisos.filter((m) => m.includes('poca energía'))).toHaveLength(1);
  });

  it('dormir repone la energía al máximo', () => {
    state.energy = 1;
    energy.rest();
    expect(state.energy).toBe(CFG.max);
  });

  it('desmayarse deja media energía y cuesta un 10 % del dinero', () => {
    state.energy = 1;
    expect(energy.faint()).toBe(20);
    expect(state.money).toBe(180);
    expect(state.energy).toBe(5);
  });

  it('lo que se pierde al desmayarse tiene tope y nunca deja dinero negativo', () => {
    state.money = 10_000;
    expect(energy.faint()).toBe(CFG.faintMaxLoss);
    state.money = 5;
    expect(energy.faint()).toBe(0);
    expect(state.money).toBe(5);
  });
});
