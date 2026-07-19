// Datos de misiones. Tipos soportados por src/quests/questSystem.ts:
//   talkAll — hablar con N NPCs distintos (autoStart: empieza activa)
//   deliver — llevar `amount` de `item` al NPC `npc`
//   harvest — cosechar `amount` de `item` y volver con el NPC `npc`
// Para añadir una misión nueva basta con agregar una entrada a este array.
import { QuestsSchema, type QuestDef } from './schemas';

export const QUEST_DEFS: QuestDef[] = QuestsSchema.parse([
  {
    id: 'conocer',
    title: 'Nuevo en el pueblo',
    desc: 'Preséntate hablando con Marta, Gon y Lila',
    type: 'talkAll',
    npc: null,
    npcName: null,
    item: null,
    amount: 3,
    autoStart: true,
    reward: { money: 30 },
  },
  {
    id: 'pedido',
    title: 'El primer pedido',
    desc: 'Lleva 1 zanahoria a Marta (acéptala hablando con ella)',
    type: 'deliver',
    npc: 'marta',
    npcName: 'Marta',
    item: 'zanahoria',
    amount: 1,
    autoStart: false,
    reward: { money: 50, friend: 2 },
  },
  {
    id: 'tomates',
    title: 'Cosecha abundante',
    desc: 'Cosecha 3 tomates para Gon (acéptala hablando con él)',
    type: 'harvest',
    npc: 'gon',
    npcName: 'Gon',
    item: 'tomate',
    amount: 3,
    autoStart: false,
    reward: { money: 80, friend: 2 },
  },
]);
