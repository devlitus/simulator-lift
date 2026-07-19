// QuestSystem (dominio puro, SIN Babylon): misiones, progreso y recompensas.
// Se suscribe a eventos del bus (cosechas, conversaciones) en vez de recibir
// llamadas directas: así no depende de quién produjo el evento.
// Las misiones son objetos de datos (ver data/quests.ts) con una máquina de
// estados: available → active → (ready) → done.
import { EVENTS, EventBus } from '../core/events';
import type { QuestDef } from '../../data/schemas';
import type { QuestSave } from '../core/save';

export type QuestRunState = 'available' | 'active' | 'ready' | 'done';

export interface Quest extends QuestDef {
  progress: number;
  talked: string[];
  state: QuestRunState;
}

// Subconjunto del GameState (ver core/store.ts) que necesita QuestSystem.
export interface QuestState {
  money: number;
  produce: Record<string, number>;
}

export class QuestSystem {
  state: QuestState;
  bus: EventBus;
  quests: Quest[];

  constructor(state: QuestState, bus: EventBus, questDefs: QuestDef[]) {
    this.state = state;
    this.bus = bus;
    this.quests = questDefs.map((def): Quest => ({
      ...def,
      progress: 0,
      talked: [],
      state: def.autoStart ? 'active' : 'available',
    }));

    bus.on(EVENTS.FARM_HARVESTED, ({ type }) => this._onHarvest(type));
    bus.on(EVENTS.NPC_TALKED, ({ npcId }) => this._onTalk(npcId));
  }

  byId(id: string): Quest | null {
    return this.quests.find((q) => q.id === id) || null;
  }

  get active(): Quest[] {
    return this.quests.filter((q) => q.state === 'active' || q.state === 'ready');
  }

  /** Misión que un NPC puede ofrecer al hablar con él. */
  availableFrom(npcId: string): Quest | null {
    return this.quests.find((q) => q.state === 'available' && q.npc === npcId) || null;
  }

  start(id: string): void {
    const q = this.byId(id);
    if (!q || q.state !== 'available') return;
    q.state = 'active';
    this.bus.emit(EVENTS.NOTIFY, `📜 Nueva misión: ${q.title}`);
    this.bus.emit(EVENTS.QUEST_CHANGED);
  }

  private _onTalk(npcId: string): void {
    const q = this.quests.find((q) => q.type === 'talkAll' && q.state === 'active');
    if (!q || q.talked.includes(npcId)) return;
    q.talked.push(npcId);
    q.progress = q.talked.length;
    if (q.progress >= q.amount) {
      this._finish(q);
    } else {
      this.bus.emit(EVENTS.NOTIFY, `📜 ${q.title}: ${q.progress}/${q.amount}`);
      this.bus.emit(EVENTS.QUEST_CHANGED);
    }
  }

  private _onHarvest(cropType: string): void {
    const q = this.quests.find(
      (q) => q.type === 'harvest' && q.state === 'active' && q.item === cropType,
    );
    if (!q) return;
    q.progress = Math.min(q.amount, q.progress + 1);
    if (q.progress >= q.amount) {
      q.state = 'ready';
      this.bus.emit(EVENTS.NOTIFY, `✅ ¡Objetivo cumplido! Vuelve con ${q.npcName} para cobrar`);
    } else {
      this.bus.emit(EVENTS.NOTIFY, `📜 ${q.title}: ${q.progress}/${q.amount}`);
    }
    this.bus.emit(EVENTS.QUEST_CHANGED);
  }

  /** Misión de entrega completable con este NPC (activa + ítems en inventario). */
  deliverableAt(npcId: string): Quest | null {
    const q = this.quests.find(
      (q) => q.type === 'deliver' && q.state === 'active' && q.npc === npcId,
    );
    // Las misiones deliver siempre tienen item (ver data/quests.ts)
    if (q && this.state.produce[q.item!] >= q.amount) return q;
    return null;
  }

  deliver(npcId: string): void {
    const q = this.deliverableAt(npcId);
    if (!q) return;
    this.state.produce[q.item!] -= q.amount;
    this.bus.emit(EVENTS.INVENTORY_CHANGED);
    this._finish(q);
  }

  /** Misión lista para cobrar hablando con su NPC. */
  readyAt(npcId: string): Quest | null {
    return this.quests.find((q) => q.state === 'ready' && q.npc === npcId) || null;
  }

  complete(npcId: string): void {
    const q = this.readyAt(npcId);
    if (q) this._finish(q);
  }

  // Progreso numérico para el panel de misiones. Las de tipo 'deliver' se
  // miden por lo que hay en el inventario, no por un contador propio; el
  // icono del ítem lo añade la UI (no es responsabilidad del dominio).
  progressOf(q: Quest): { have: number; amount: number } {
    if (q.type === 'deliver') return { have: this.state.produce[q.item!], amount: q.amount };
    return { have: q.progress, amount: q.amount };
  }

  private _finish(q: Quest): void {
    q.state = 'done';
    const r = q.reward || {};
    const extras: string[] = [];
    if (r.money) {
      this.state.money += r.money;
      this.bus.emit(EVENTS.MONEY_CHANGED);
      extras.push(`+${r.money} 🪙`);
    }
    if (r.friend && q.npc) {
      this.bus.emit(EVENTS.FRIENDSHIP_ADD, { npcId: q.npc, pts: r.friend });
      extras.push(`+${r.friend} ❤️ ${q.npcName}`);
    }
    this.bus.emit(EVENTS.NOTIFY, `🏆 ¡Misión completada: ${q.title}! ${extras.join(' · ')}`);
    this.bus.emit(EVENTS.QUEST_CHANGED);
  }

  serialize(): QuestSave[] {
    return this.quests.map((q) => ({
      id: q.id,
      state: q.state,
      progress: q.progress,
      talked: q.talked || [],
    }));
  }

  deserialize(data: unknown): void {
    if (!Array.isArray(data)) return;
    for (const s of data as QuestSave[]) {
      const q = this.byId(s.id);
      if (q) {
        q.state = s.state;
        q.progress = s.progress || 0;
        q.talked = s.talked || [];
      }
    }
    this.bus.emit(EVENTS.QUEST_CHANGED);
  }
}
