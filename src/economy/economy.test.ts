import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../core/events';
import { Economy, type EconomyState } from './economy';
import type { CropDef, GiftDef } from '../../data/schemas';

const CROPS: Record<string, CropDef> = {
  zanahoria: {
    name: 'Zanahoria',
    icon: '🥕',
    seedPrice: 10,
    sellPrice: 25,
    daysToGrow: 2,
    color: '#e07b2a',
  },
  tomate: {
    name: 'Tomate',
    icon: '🍅',
    seedPrice: 15,
    sellPrice: 40,
    daysToGrow: 3,
    color: '#d1342c',
  },
};
const GIFTS: Record<string, GiftDef> = {
  flor: { name: 'Flor', icon: '🌸', price: 20, points: 2 },
};

function makeState(): EconomyState {
  return {
    money: 30,
    seeds: { zanahoria: 0, tomate: 0 },
    produce: { zanahoria: 2, tomate: 1 },
    gifts: { flor: 0 },
  };
}

describe('Economy', () => {
  let bus: EventBus;
  let state: EconomyState;
  let economy: Economy;

  beforeEach(() => {
    bus = new EventBus();
    state = makeState();
    economy = new Economy(state, bus, CROPS, GIFTS);
  });

  it('compra una semilla si hay dinero suficiente', () => {
    expect(economy.buySeed('zanahoria')).toBe(true);
    expect(state.money).toBe(20);
    expect(state.seeds.zanahoria).toBe(1);
  });

  it('no compra si falta dinero, y no muta el estado', () => {
    state.money = 5;
    expect(economy.buySeed('tomate')).toBe(false);
    expect(state.money).toBe(5);
    expect(state.seeds.tomate).toBe(0);
  });

  it('compra un regalo descontando su precio', () => {
    expect(economy.buyGift('flor')).toBe(true);
    expect(state.money).toBe(10);
    expect(state.gifts.flor).toBe(1);
  });

  it('vende toda la cosecha y vacía el inventario', () => {
    const total = economy.sellAllProduce();
    expect(total).toBe(2 * 25 + 1 * 40); // 90
    expect(state.money).toBe(30 + 90);
    expect(state.produce).toEqual({ zanahoria: 0, tomate: 0 });
  });

  it('vender sin cosecha no cambia el dinero', () => {
    state.produce = { zanahoria: 0, tomate: 0 };
    expect(economy.sellAllProduce()).toBe(0);
    expect(state.money).toBe(30);
  });
});
