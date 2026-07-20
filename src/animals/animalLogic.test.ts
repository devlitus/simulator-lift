import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../core/events';
import { AnimalLogic, type AnimalState } from './animalLogic';
import type { AnimalDef } from '../../data/schemas';

const ANIMALS: Record<string, AnimalDef> = {
  gallina: {
    name: 'Gallina',
    icon: '🐔',
    price: 40,
    productName: 'Huevo',
    productIcon: '🥚',
    productPrice: 12,
    color: '#f2eee0',
  },
  vaca: {
    name: 'Vaca',
    icon: '🐄',
    price: 150,
    productName: 'Leche',
    productIcon: '🥛',
    productPrice: 32,
    color: '#6b4729',
  },
};

function makeState(): AnimalState {
  return { money: 100, feed: 2, animalProducts: { gallina: 0, vaca: 0 } };
}

describe('AnimalLogic', () => {
  let bus: EventBus;
  let state: AnimalState;
  let logic: AnimalLogic;

  beforeEach(() => {
    bus = new EventBus();
    state = makeState();
    logic = new AnimalLogic(state, bus, ANIMALS, ['gallina']);
  });

  it('empieza con los animales iniciales sin alimentar', () => {
    expect(logic.animals).toEqual([{ type: 'gallina', fed: false }]);
    expect(logic.countOf('gallina')).toBe(1);
  });

  it('compra un animal si hay dinero suficiente', () => {
    expect(logic.buyAnimal('gallina')).toBe(true);
    expect(state.money).toBe(60);
    expect(logic.countOf('gallina')).toBe(2);
  });

  it('no compra si falta dinero, y no muta el estado', () => {
    state.money = 30;
    expect(logic.buyAnimal('vaca')).toBe(false);
    expect(state.money).toBe(30);
    expect(logic.countOf('vaca')).toBe(0);
  });

  it('alimentar consume pienso y marca al animal como alimentado', () => {
    expect(logic.feedAnimal(0)).toBe(true);
    expect(state.feed).toBe(1);
    expect(logic.animals[0].fed).toBe(true);
  });

  it('no alimenta dos veces al mismo animal el mismo día', () => {
    logic.feedAnimal(0);
    expect(logic.feedAnimal(0)).toBe(false);
    expect(state.feed).toBe(1);
  });

  it('no alimenta sin pienso', () => {
    state.feed = 0;
    expect(logic.feedAnimal(0)).toBe(false);
    expect(logic.animals[0].fed).toBe(false);
  });

  it('al nuevo día, los animales alimentados producen y vuelven a tener hambre', () => {
    logic.feedAnimal(0);
    const { produced } = logic.newDay();
    expect(produced).toBe(1);
    expect(state.animalProducts.gallina).toBe(1);
    expect(logic.animals[0].fed).toBe(false);
  });

  it('los animales sin alimentar no producen', () => {
    expect(logic.newDay().produced).toBe(0);
    expect(state.animalProducts.gallina).toBe(0);
  });

  it('serialize/deserialize conserva especies y estado de alimentación', () => {
    state.money = 200; // alcanza para la vaca (150)
    logic.feedAnimal(0);
    logic.buyAnimal('vaca');
    const saved = logic.serialize();

    const other = new AnimalLogic(makeState(), bus, ANIMALS, []);
    other.deserialize(JSON.parse(JSON.stringify(saved)));
    expect(other.animals).toEqual([
      { type: 'gallina', fed: true },
      { type: 'vaca', fed: false },
    ]);
  });

  it('deserialize ignora datos inválidos o especies desconocidas', () => {
    logic.deserialize('no-es-un-array');
    expect(logic.countOf('gallina')).toBe(1); // sin cambios

    logic.deserialize([{ type: 'dragon', fed: true }, { type: 'vaca', fed: true }, null]);
    expect(logic.animals).toEqual([{ type: 'vaca', fed: true }]);
  });
});
