// FarmLogic (dominio puro, SIN Babylon): reglas de la granja.
// Plantar, regar, crecimiento por días, marchitez y cosecha sobre datos planos.
// No crea meshes: la vista (src/crops/farmView.ts) refleja este estado.
import { EVENTS, EventBus } from '../core/events';
import { WILT_DAYS } from '../../data/farm';
import type { CropDef } from '../../data/schemas';

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
}

export class FarmLogic {
  state: FarmState;
  bus: EventBus;
  crops: Record<string, CropDef>;
  tiles: Array<TileCrop | null>;

  constructor(
    state: FarmState,
    bus: EventBus,
    cropsData: Record<string, CropDef>,
    tileCount: number,
  ) {
    this.state = state;
    this.bus = bus;
    this.crops = cropsData;
    this.tiles = new Array(tileCount).fill(null);
  }

  status(index: number): TileStatus {
    const c = this.tiles[index];
    if (!c) return { kind: TILE_STATUS.EMPTY, crop: null };
    if (c.withered) return { kind: TILE_STATUS.WITHERED, crop: c };
    if (c.stage >= this.crops[c.type].daysToGrow) return { kind: TILE_STATUS.MATURE, crop: c };
    return { kind: TILE_STATUS.GROWING, crop: c };
  }

  plant(index: number, type: string): boolean {
    if (this.tiles[index] || this.state.seeds[type] <= 0) return false;
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
    c.watered = true;
    this.bus.emit(EVENTS.FARM_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, '💧 Cultivo regado');
    return true;
  }

  clear(index: number): boolean {
    if (!this.tiles[index]) return false;
    this.tiles[index] = null;
    this.bus.emit(EVENTS.FARM_CHANGED);
    this.bus.emit(EVENTS.NOTIFY, '🧹 Surco limpiado');
    return true;
  }

  /** Devuelve el tipo de cultivo cosechado, o null si no se pudo. */
  harvest(index: number): string | null {
    const c = this.tiles[index];
    if (!c || c.withered || c.stage < this.crops[c.type].daysToGrow) return null;
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
