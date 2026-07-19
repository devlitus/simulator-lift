// Economy (dominio puro, SIN Babylon): monedas, compras y venta de cosecha.
import { EVENTS, EventBus } from '../core/events';
import type { CropDef, GiftDef } from '../../data/schemas';

// Subconjunto del GameState (ver core/store.ts) que necesita Economy.
export interface EconomyState {
  money: number;
  seeds: Record<string, number>;
  produce: Record<string, number>;
  gifts: Record<string, number>;
}

export class Economy {
  state: EconomyState;
  bus: EventBus;
  crops: Record<string, CropDef>;
  gifts: Record<string, GiftDef>;

  constructor(
    state: EconomyState,
    bus: EventBus,
    cropsData: Record<string, CropDef>,
    giftsData: Record<string, GiftDef>,
  ) {
    this.state = state;
    this.bus = bus;
    this.crops = cropsData;
    this.gifts = giftsData;
  }

  buySeed(type: string): boolean {
    const price = this.crops[type].seedPrice;
    if (this.state.money < price) {
      this.bus.emit(EVENTS.NOTIFY, '🪙 No tienes suficiente dinero');
      return false;
    }
    this.state.money -= price;
    this.state.seeds[type]++;
    this.bus.emit(EVENTS.MONEY_CHANGED);
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this.bus.emit(
      EVENTS.NOTIFY,
      `🌱 Compraste 1 semilla de ${this.crops[type].name} (-${price} 🪙)`,
    );
    return true;
  }

  buyGift(type: string): boolean {
    const price = this.gifts[type].price;
    if (this.state.money < price) {
      this.bus.emit(EVENTS.NOTIFY, '🪙 No tienes suficiente dinero');
      return false;
    }
    this.state.money -= price;
    this.state.gifts[type]++;
    this.bus.emit(EVENTS.MONEY_CHANGED);
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, `🎁 Compraste: ${this.gifts[type].name} (-${price} 🪙)`);
    return true;
  }

  /** Vende toda la cosecha del inventario; devuelve el total ganado. */
  sellAllProduce(): number {
    let total = 0;
    for (const key of Object.keys(this.state.produce)) {
      total += this.crops[key].sellPrice * this.state.produce[key];
      this.state.produce[key] = 0;
    }
    if (total > 0) {
      this.state.money += total;
      this.bus.emit(EVENTS.MONEY_CHANGED);
      this.bus.emit(EVENTS.INVENTORY_CHANGED);
    }
    return total;
  }
}
