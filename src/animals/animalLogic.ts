// AnimalLogic (dominio puro, SIN Babylon): reglas de los animales de granja.
// Compra en tienda, alimentación con pienso y producción diaria sobre datos
// planos. No crea meshes ni mueve nada: la vista (src/animals/animalView.ts)
// refleja este estado y pasea a los animales dentro del recinto.
import { EVENTS, EventBus } from '../core/events';
import type { AnimalDef } from '../../data/schemas';

export interface Animal {
  type: string;
  fed: boolean; // alimentado hoy (produce al empezar el día siguiente)
}

// Subconjunto del GameState (ver core/store.ts) que necesita AnimalLogic.
export interface AnimalState {
  money: number;
  feed: number;
  animalProducts: Record<string, number>;
}

export class AnimalLogic {
  state: AnimalState;
  bus: EventBus;
  defs: Record<string, AnimalDef>;
  animals: Animal[];

  constructor(
    state: AnimalState,
    bus: EventBus,
    animalsData: Record<string, AnimalDef>,
    startAnimals: string[] = [],
  ) {
    this.state = state;
    this.bus = bus;
    this.defs = animalsData;
    this.animals = startAnimals.map((type) => ({ type, fed: false }));
  }

  countOf(type: string): number {
    return this.animals.filter((a) => a.type === type).length;
  }

  buyAnimal(type: string): boolean {
    const def = this.defs[type];
    if (this.state.money < def.price) {
      this.bus.emit(EVENTS.NOTIFY, '🪙 No tienes suficiente dinero');
      return false;
    }
    this.state.money -= def.price;
    this.animals.push({ type, fed: false });
    this.bus.emit(EVENTS.MONEY_CHANGED);
    this.bus.emit(EVENTS.ANIMALS_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, `${def.icon} Compraste 1 ${def.name} (-${def.price} 🪙)`);
    return true;
  }

  feedAnimal(index: number): boolean {
    const a = this.animals[index];
    if (!a || a.fed) return false;
    if (this.state.feed <= 0) {
      this.bus.emit(EVENTS.NOTIFY, '🌾 No te queda pienso (cómpralo en la tienda)');
      return false;
    }
    this.state.feed--;
    a.fed = true;
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this.bus.emit(EVENTS.ANIMALS_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, `🍽️ ${this.defs[a.type].name} alimentada`);
    return true;
  }

  // Avance diario: cada animal alimentado deja 1 unidad de su producto
  newDay(): { produced: number } {
    let produced = 0;
    for (const a of this.animals) {
      if (!a.fed) continue;
      this.state.animalProducts[a.type]++;
      a.fed = false;
      produced++;
    }
    if (produced > 0) {
      this.bus.emit(EVENTS.NOTIFY, `🧺 ¡Tus animales dejaron ${produced} producto(s)!`);
      this.bus.emit(EVENTS.INVENTORY_CHANGED);
    }
    this.bus.emit(EVENTS.ANIMALS_CHANGED);
    return { produced };
  }

  serialize(): Animal[] {
    return this.animals.map((a) => ({ ...a }));
  }

  deserialize(data: unknown): void {
    if (!Array.isArray(data)) return;
    this.animals = (data as Animal[])
      .filter((a) => a && typeof a.type === 'string' && this.defs[a.type])
      .map((a) => ({ type: a.type, fed: !!a.fed }));
    this.bus.emit(EVENTS.ANIMALS_CHANGED);
  }
}
