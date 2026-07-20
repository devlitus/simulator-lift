// SaveSystem: serialización pura del estado + repositorio de persistencia.
// buildSave/applySave son funciones puras (testeables sin navegador);
// SaveRepository aísla la dependencia de localStorage (inyectable en tests).
// El guardado que llega de localStorage se valida con Zod: un save corrupto o
// manipulado se rechaza entero en vez de romper el juego a medias.
import { z } from 'zod';
import type { GameState } from './store';
import type { TileCrop } from '../crops/farmLogic';
import type { Animal } from '../animals/animalLogic';

const KEY = 'pueblo3d_save_v1';

const TileCropSchema: z.ZodType<TileCrop> = z.object({
  type: z.string(),
  stage: z.number(),
  watered: z.boolean(),
  wiltDays: z.number(),
  withered: z.boolean(),
});

const AnimalSaveSchema: z.ZodType<Animal> = z.object({
  type: z.string(),
  fed: z.boolean(),
});

const QuestSaveSchema = z.object({
  id: z.string(),
  state: z.enum(['available', 'active', 'ready', 'done']),
  progress: z.number(),
  talked: z.array(z.string()),
});
export type QuestSave = z.infer<typeof QuestSaveSchema>;

// Todos los campos son opcionales: applySave siempre fue tolerante con saves
// parciales (rellena con el estado actual) y los tests dependen de ello.
export const SaveSchema = z.object({
  version: z.number().optional(),
  day: z.number().optional(),
  money: z.number().optional(),
  seeds: z.record(z.number()).optional(),
  produce: z.record(z.number()).optional(),
  gifts: z.record(z.number()).optional(),
  feed: z.number().optional(),
  animalProducts: z.record(z.number()).optional(),
  selectedSeed: z.string().optional(),
  friendships: z.record(z.number()).optional(),
  quests: z.array(QuestSaveSchema).optional(),
  farm: z.array(TileCropSchema.nullable()).optional(),
  animals: z.array(AnimalSaveSchema).optional(),
});
export type SaveData = z.infer<typeof SaveSchema>;

// Contratos mínimos que save necesita de FarmLogic, AnimalLogic y QuestSystem.
export interface FarmPersistence {
  serialize(): Array<TileCrop | null>;
  deserialize(data: unknown): void;
}
export interface AnimalPersistence {
  serialize(): Animal[];
  deserialize(data: unknown): void;
}
export interface QuestPersistence {
  serialize(): QuestSave[];
  deserialize(data: unknown): void;
}

export function buildSave(
  state: GameState,
  farm: FarmPersistence,
  quests: QuestPersistence,
  animals: AnimalPersistence,
): SaveData {
  return {
    version: 1,
    day: state.day,
    money: state.money,
    seeds: { ...state.seeds },
    produce: { ...state.produce },
    gifts: { ...state.gifts },
    feed: state.feed,
    animalProducts: { ...state.animalProducts },
    selectedSeed: state.selectedSeed,
    friendships: { ...state.friendships },
    quests: quests.serialize(),
    farm: farm.serialize(),
    animals: animals.serialize(),
  };
}

export function applySave(
  data: unknown,
  state: GameState,
  farm: FarmPersistence,
  quests: QuestPersistence,
  animals: AnimalPersistence,
): boolean {
  const parsed = SaveSchema.safeParse(data);
  if (!parsed.success) return false;
  const d = parsed.data;
  state.day = d.day ?? state.day;
  state.money = d.money ?? state.money;
  Object.assign(state.seeds, d.seeds || {});
  Object.assign(state.produce, d.produce || {});
  Object.assign(state.gifts, d.gifts || {});
  state.feed = d.feed ?? state.feed;
  Object.assign(state.animalProducts, d.animalProducts || {});
  state.selectedSeed = d.selectedSeed || state.selectedSeed;
  Object.assign(state.friendships, d.friendships || {});
  state.talkedToday = {};
  quests.deserialize(d.quests);
  farm.deserialize(d.farm);
  animals.deserialize(d.animals);
  return true;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class SaveRepository {
  constructor(
    private storage: StorageLike,
    private key: string = KEY,
  ) {}

  save(data: unknown): boolean {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('No se pudo guardar la partida:', e);
      return false;
    }
  }

  load(): unknown {
    try {
      const raw = this.storage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('No se pudo cargar la partida:', e);
      return null;
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key);
    } catch (e) {
      console.warn('No se pudo borrar la partida:', e);
    }
  }
}
