// Datos de balance general del juego (economía inicial). Editar aquí sin tocar lógica.
import { BalanceSchema, type BalanceConfig } from './schemas';

export const BALANCE: BalanceConfig = BalanceSchema.parse({
  startMoney: 100,
  startSeeds: { zanahoria: 3 }, // semillas con las que empieza el jugador
});
