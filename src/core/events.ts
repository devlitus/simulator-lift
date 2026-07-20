// EventBus: patrón Observer para desacoplar sistemas.
// Los sistemas de dominio emiten eventos; las vistas y la UI se suscriben.
// Así, p. ej., las misiones se enteran de las cosechas sin conocer la granja.
// El mapa EventPayloads tipa el payload de cada evento: emitir o escuchar con
// el tipo equivocado es un error de compilación.
export const EVENTS = {
  NOTIFY: 'notify',
  DAY_NEW: 'day:new',
  FARM_CHANGED: 'farm:changed', // la parcela cambió (vista debe resincronizar)
  FARM_HARVESTED: 'farm:harvested',
  ANIMALS_CHANGED: 'animals:changed', // los animales cambiaron (compra, comida, carga)
  INVENTORY_CHANGED: 'inventory:changed', // semillas/cosecha/regalos cambiaron
  MONEY_CHANGED: 'money:changed',
  FRIENDSHIP_ADD: 'friendship:add', // petición de sumar puntos
  FRIENDSHIP_CHANGED: 'friendship:changed',
  NPC_TALKED: 'npc:talked', // primera charla del día
  QUEST_CHANGED: 'quest:changed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type EventPayloads = {
  notify: string; // mensaje para el jugador
  'day:new': { day: number };
  'farm:changed': void;
  'farm:harvested': { type: string };
  'animals:changed': void;
  'inventory:changed': void;
  'money:changed': void;
  'friendship:add': { npcId: string; pts: number };
  'friendship:changed': { npcId: string; points: number; leveledUp: boolean; levelLabel: string };
  'npc:talked': { npcId: string };
  'quest:changed': void;
};

type Listener<E extends EventName> = (payload: EventPayloads[E]) => void;

export class EventBus {
  private _listeners = new Map<EventName, Array<(payload: never) => void>>();

  /** Devuelve una función para desuscribirse. */
  on<E extends EventName>(event: E, fn: Listener<E>): () => void {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event)!.push(fn as (payload: never) => void);
    return () => this.off(event, fn);
  }

  off<E extends EventName>(event: E, fn: Listener<E>): void {
    const list = this._listeners.get(event);
    if (!list) return;
    const i = list.indexOf(fn as (payload: never) => void);
    if (i >= 0) list.splice(i, 1);
  }

  emit<E extends EventName>(
    event: E,
    ...args: EventPayloads[E] extends void ? [] : [EventPayloads[E]]
  ): void {
    const payload = (args as unknown[])[0];
    for (const fn of this._listeners.get(event) || []) {
      (fn as (p: unknown) => void)(payload);
    }
  }
}
