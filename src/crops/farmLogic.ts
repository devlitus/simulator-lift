// FarmLogic (dominio puro, SIN Babylon): reglas de la granja.
// Plantar, regar, crecimiento por días, marchitez y cosecha sobre datos planos.
// Cada cultivo solo se planta y crece en sus estaciones; la lluvia riega sola.
// Las labores (plantar, regar, cosechar, limpiar) cansan: si se le inyecta un
// medidor de energía, sin energía suficiente no se hacen.
// No crea meshes: la vista (src/crops/farmView.ts) refleja este estado.
import { EVENTS, EventBus } from '../core/events';
import { WATERING_CAN_CAPACITY, WILT_DAYS } from '../../data/farm';
import type { CropDef, FarmAction, SeasonId } from '../../data/schemas';
import { inSeason } from '../calendar/calendar';

export interface TileCrop {
  type: string;
  stage: number;
  watered: boolean;
  wiltDays: number;
  withered: boolean;
}

// Estados posibles de un surco (máquina de estados implícita):
// empty → growing → mature → (cosecha) → empty
//   growing --(2 días sin agua)--> withered → (limpiar) → empty
//   growing/mature --(llega una estación que no es la suya)--> withered
export const TILE_STATUS = {
  EMPTY: 'empty',
  GROWING: 'growing',
  MATURE: 'mature',
  WITHERED: 'withered',
} as const;
export type TileStatusKind = (typeof TILE_STATUS)[keyof typeof TILE_STATUS];

export interface TileStatus {
  kind: TileStatusKind;
  crop: TileCrop | null;
}

// Subconjunto del GameState (ver core/store.ts) que necesita FarmLogic.
export interface FarmState {
  seeds: Record<string, number>;
  produce: Record<string, number>;
  water: number; // riegos que quedan en la regadera
  season?: SeasonId; // sin estación (tests antiguos) no hay reglas de temporada
}

// Contrato mínimo que FarmLogic necesita del medidor de energía (player/energy.ts).
export interface FarmEnergy {
  cost(action: FarmAction): number;
  canAfford(action: FarmAction): boolean;
  spend(action: FarmAction): boolean;
}

export class FarmLogic {
  state: FarmState;
  bus: EventBus;
  crops: Record<string, CropDef>;
  tiles: Array<TileCrop | null>;
  energy: FarmEnergy | null; // sin medidor (tests antiguos) las labores no cansan

  constructor(
    state: FarmState,
    bus: EventBus,
    cropsData: Record<string, CropDef>,
    tileCount: number,
    energy: FarmEnergy | null = null,
  ) {
    this.state = state;
    this.bus = bus;
    this.crops = cropsData;
    this.tiles = new Array(tileCount).fill(null);
    this.energy = energy;
  }

  /** Energía que gasta la labor (0 si no se mide la energía). */
  energyCost(action: FarmAction): number {
    return this.energy ? this.energy.cost(action) : 0;
  }

  /** Queda energía para la labor (o no se mide la energía). */
  canAfford(action: FarmAction): boolean {
    return !this.energy || this.energy.canAfford(action);
  }

  // Se llama tras validar la labor y antes de cambiar nada: si no hay energía
  // la labor no se hace y el surco queda como estaba.
  private tire(action: FarmAction): boolean {
    return !this.energy || this.energy.spend(action);
  }

  status(index: number): TileStatus {
    const c = this.tiles[index];
    if (!c) return { kind: TILE_STATUS.EMPTY, crop: null };
    if (c.withered) return { kind: TILE_STATUS.WITHERED, crop: c };
    if (c.stage >= this.crops[c.type].daysToGrow) return { kind: TILE_STATUS.MATURE, crop: c };
    return { kind: TILE_STATUS.GROWING, crop: c };
  }

  /** El cultivo se puede plantar y crece en la estación actual. */
  isInSeason(type: string): boolean {
    return !this.state.season || inSeason(this.crops[type], this.state.season);
  }

  plant(index: number, type: string): boolean {
    if (this.tiles[index] || this.state.seeds[type] <= 0) return false;
    if (!this.isInSeason(type)) {
      this.bus.emit(EVENTS.NOTIFY, `📅 ${this.crops[type].name} no se planta en esta estación`);
      return false;
    }
    if (!this.tire('plant')) return false;
    this.state.seeds[type]--;
    this.tiles[index] = { type, stage: 0, watered: false, wiltDays: 0, withered: false };
    this.bus.emit(EVENTS.FARM_CHANGED);
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, `🌱 Plantaste ${this.crops[type].name}`);
    return true;
  }

  water(index: number): boolean {
    const c = this.tiles[index];
    if (!c || c.withered || c.watered) return false;
    if (this.state.water <= 0) {
      this.bus.emit(EVENTS.NOTIFY, '🪣 La regadera está vacía: llénala en el pozo');
      return false;
    }
    if (!this.tire('water')) return false;
    this.state.water--;
    c.watered = true;
    this.bus.emit(EVENTS.FARM_CHANGED);
    this.bus.emit(EVENTS.FARM_WATERED, { index });
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this.bus.emit(
      EVENTS.NOTIFY,
      `💧 Cultivo regado (${this.state.water}/${WATERING_CAN_CAPACITY})`,
    );
    return true;
  }

  /** La regadera admite agua (no está llena). */
  canRefill(): boolean {
    return this.state.water < WATERING_CAN_CAPACITY;
  }

  /** Llena la regadera en el pozo. Devuelve false si ya estaba llena. */
  refillWater(): boolean {
    if (!this.canRefill()) return false;
    this.state.water = WATERING_CAN_CAPACITY;
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, `🪣 Regadera llena (${WATERING_CAN_CAPACITY} riegos)`);
    return true;
  }

  /** Día de lluvia: todos los cultivos vivos quedan regados sin gastar agua. */
  rain(): number {
    let watered = 0;
    for (const c of this.tiles) {
      if (!c || c.withered || c.watered) continue;
      c.watered = true;
      watered++;
    }
    if (watered > 0) this.bus.emit(EVENTS.FARM_CHANGED);
    return watered;
  }

  /** Estación nueva: se marchitan los cultivos que no son de temporada. */
  changeSeason(): number {
    const names = new Set<string>();
    let withered = 0;
    for (const c of this.tiles) {
      if (!c || c.withered || this.isInSeason(c.type)) continue;
      c.withered = true;
      names.add(this.crops[c.type].name);
      withered++;
    }
    if (withered > 0) {
      this.bus.emit(
        EVENTS.NOTIFY,
        `🍂 Se acabó la temporada de ${[...names].join(', ')}: ${withered} cultivo(s) marchitos`,
      );
      this.bus.emit(EVENTS.FARM_CHANGED);
    }
    return withered;
  }

  clear(index: number): boolean {
    if (!this.tiles[index] || !this.tire('clear')) return false;
    this.tiles[index] = null;
    this.bus.emit(EVENTS.FARM_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, '🧹 Surco limpiado');
    return true;
  }

  /** Devuelve el tipo de cultivo cosechado, o null si no se pudo. */
  harvest(index: number): string | null {
    const c = this.tiles[index];
    if (!c || c.withered || c.stage < this.crops[c.type].daysToGrow) return null;
    if (!this.tire('harvest')) return null;
    const type = c.type;
    this.state.produce[type]++;
    this.tiles[index] = null;
    this.bus.emit(EVENTS.FARM_CHANGED);
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, `🧺 +1 ${this.crops[type].icon} ${this.crops[type].name}`);
    this.bus.emit(EVENTS.FARM_HARVESTED, { type });
    return type;
  }

  // Avance diario: los cultivos regados crecen; los secos acumulan marchitez
  newDay(): { matured: number; withered: number } {
    let matured = 0;
    let withered = 0;
    for (let i = 0; i < this.tiles.length; i++) {
      const c = this.tiles[i];
      if (!c || c.withered) continue;
      if (c.watered) {
        c.stage++;
        c.watered = false;
        c.wiltDays = 0;
        if (c.stage >= this.crops[c.type].daysToGrow) matured++;
      } else {
        c.wiltDays++;
        if (c.wiltDays >= WILT_DAYS) {
          c.withered = true;
          withered++;
        }
      }
    }
    if (matured > 0) {
      this.bus.emit(EVENTS.NOTIFY, `🌾 ¡${matured} cultivo(s) listos para cosechar!`);
    }
    if (withered > 0) {
      this.bus.emit(EVENTS.NOTIFY, `🥀 ${withered} cultivo(s) se marchitaron por falta de agua`);
    }
    this.bus.emit(EVENTS.FARM_CHANGED);
    return { matured, withered };
  }

  serialize(): Array<TileCrop | null> {
    return this.tiles.map((c) => (c ? { ...c } : null));
  }

  deserialize(data: unknown): void {
    if (!Array.isArray(data)) return;
    (data as Array<TileCrop | null>).forEach((crop, i) => {
      if (i < this.tiles.length) this.tiles[i] = crop || null;
    });
    this.bus.emit(EVENTS.FARM_CHANGED);
  }
}
