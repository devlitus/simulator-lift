// Datos de balance general del juego (economía inicial). Editar aquí sin tocar lógica.
import { BalanceSchema, type BalanceConfig } from './schemas';

export const BALANCE: BalanceConfig = BalanceSchema.parse({
  startMoney: 100,
  startSeeds: { zanahoria: 3 }, // semillas con las que empieza el jugador
  startFeed: 3, // pienso con el que empieza el jugador
  startAnimals: ['gallina'], // animales con los que empieza el jugador
});
