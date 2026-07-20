// Esquemas Zod del contenido del juego. Cada archivo de data/ valida su
// contenido con .parse() al cargarse: un dato mal formado revienta en el
// arranque con un error claro, no a mitad de partida. Los tipos que usa el
// dominio se derivan de aquí con z.infer (ver ADR 0009).
import { z } from 'zod';

export const CropSchema = z.object({
  name: z.string(),
  icon: z.string(),
  seedPrice: z.number().int().positive(),
  sellPrice: z.number().int().positive(),
  daysToGrow: z.number().int().positive(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type CropDef = z.infer<typeof CropSchema>;
export const CropsSchema = z.record(CropSchema);

export const GiftSchema = z.object({
  name: z.string(),
  icon: z.string(),
  price: z.number().int().positive(),
  points: z.number().int().positive(),
});
export type GiftDef = z.infer<typeof GiftSchema>;
export const GiftsSchema = z.record(GiftSchema);

export const QuestRewardSchema = z.object({
  money: z.number().int().positive().optional(),
  friend: z.number().int().positive().optional(),
});
export const QuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  desc: z.string(),
  type: z.enum(['talkAll', 'deliver', 'harvest']),
  npc: z.string().nullable(),
  npcName: z.string().nullable(),
  item: z.string().nullable(),
  amount: z.number().int().positive(),
  autoStart: z.boolean(),
  reward: QuestRewardSchema,
});
export type QuestDef = z.infer<typeof QuestSchema>;
export const QuestsSchema = z.array(QuestSchema);

export const NpcSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  color: z.tuple([z.number(), z.number(), z.number()]), // RGB 0-1
  home: z.object({ x: z.number(), z: z.number() }),
  waypoints: z.array(z.tuple([z.number(), z.number()])).nullable(), // null = se queda fijo
  hasShop: z.boolean(),
  dialogs: z.array(z.string()).min(4), // uno por nivel de amistad (data/friendship.ts)
});
export type NpcDef = z.infer<typeof NpcSchema>;
export const NpcsSchema = z.array(NpcSchema);

export const FriendshipLevelSchema = z.object({
  min: z.number().int().min(0),
  label: z.string(),
});
export type FriendshipLevel = z.infer<typeof FriendshipLevelSchema>;
export const FriendshipLevelsSchema = z.array(FriendshipLevelSchema).min(1);

export const BalanceSchema = z.object({
  startMoney: z.number().int().min(0),
  startSeeds: z.record(z.number().int().min(0)), // semillas iniciales por tipo de cultivo
  startFeed: z.number().int().min(0), // pienso inicial
  startAnimals: z.array(z.string()), // especies con las que empieza el jugador
});
export type BalanceConfig = z.infer<typeof BalanceSchema>;

export const FarmConfigSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  spacing: z.number().positive(), // distancia entre surcos
  origin: z.object({ x: z.number(), z: z.number() }), // esquina de la parcela
  tileSize: z.number().positive(),
});
export type FarmConfig = z.infer<typeof FarmConfigSchema>;

export const AnimalSchema = z.object({
  name: z.string(),
  icon: z.string(),
  price: z.number().int().positive(), // precio de compra del animal
  productName: z.string(), // lo que produce si se le alimenta (Huevo, Leche…)
  productIcon: z.string(),
  productPrice: z.number().int().positive(), // precio de venta del producto
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), // color del cuerpo en la vista
});
export type AnimalDef = z.infer<typeof AnimalSchema>;
export const AnimalsSchema = z.record(AnimalSchema);

export const FeedSchema = z.object({
  name: z.string(),
  icon: z.string(),
  price: z.number().int().positive(),
});
export type FeedDef = z.infer<typeof FeedSchema>;

// Rectángulo del recinto de animales: la valla (worldView) y el paseo de los
// animales (animalView) leen las mismas coordenadas para que nunca diverjan.
export const PenConfigSchema = z.object({
  x1: z.number(),
  x2: z.number(),
  z1: z.number(),
  z2: z.number(),
  gateZ1: z.number(), // hueco de la puerta en el lado este (entre gateZ1 y gateZ2)
  gateZ2: z.number(),
});
export type PenConfig = z.infer<typeof PenConfigSchema>;
