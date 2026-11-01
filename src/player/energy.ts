// Energy (dominio puro, SIN Babylon): la energía del granjero.
// Las labores de la granja la gastan (plantar, regar, cosechar, limpiar) y
// dormir en la cama la recupera entera. Quien sigue despierto a la hora del
// desmayo (ver world/sleep.ts) despierta en casa con menos energía y pierde
// parte de su dinero. Los costes y penalizaciones viven en data/balance.ts.
import { EVENTS, EventBus } from '../core/events';
import type { EnergyConfig, FarmAction } from '../../data/schemas';

// Subconjunto del GameState (ver core/store.ts) que necesita Energy.
export interface EnergyState {
  energy: number;
  money: number;
}

export class Energy {
  state: EnergyState;
  bus: EventBus;
  cfg: EnergyConfig;

  constructor(state: EnergyState, bus: EventBus, cfg: EnergyConfig) {
    this.state = state;
    this.bus = bus;
    this.cfg = cfg;
  }

  get max(): number {
    return this.cfg.max;
  }

  cost(action: FarmAction): number {
    return this.cfg.costs[action];
  }

  canAfford(action: FarmAction): boolean {
    return this.state.energy >= this.cost(action);
  }

  /** Gasta la energía de una labor. Devuelve false (y avisa) si no llega. */
  spend(action: FarmAction): boolean {
    if (!this.canAfford(action)) {
      this.bus.emit(EVENTS.NOTIFY, '😩 Estás agotado: vete a dormir para recuperar energía');
      return false;
    }
    const low = this.cfg.max * this.cfg.lowWarning;
    const before = this.state.energy;
    this.state.energy -= this.cost(action);
    this.bus.emit(EVENTS.ENERGY_CHANGED);
    if (before > low && this.state.energy <= low) {
      this.bus.emit(EVENTS.NOTIFY, '🥱 Te queda poca energía: descansa pronto');
    }
    return true;
  }

  /** Dormir en la cama: energía al máximo. */
  rest(): void {
    this.state.energy = this.cfg.max;
    this.bus.emit(EVENTS.ENERGY_CHANGED);
  }

  /**
   * Desmayo por quedarse despierto: se despierta con parte de la energía y se
   * pierde una fracción del dinero (con tope). Devuelve lo perdido.
   */
  faint(): number {
    const loss = Math.min(
      this.cfg.faintMaxLoss,
      Math.floor(this.state.money * this.cfg.faintMoneyLoss),
    );
    this.state.money -= loss;
    this.state.energy = Math.round(this.cfg.max * this.cfg.faintEnergy);
    this.bus.emit(EVENTS.ENERGY_CHANGED);
    if (loss > 0) this.bus.emit(EVENTS.MONEY_CHANGED);
    return loss;
  }
}
