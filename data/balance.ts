// Datos de balance general del juego (economía inicial). Editar aquí sin tocar lógica.
import { BalanceSchema, type BalanceConfig } from './schemas';

export const BALANCE: BalanceConfig = BalanceSchema.parse({
  startMoney: 100,
  startSeeds: { zanahoria: 3 }, // semillas con las que empieza el jugador
  startFeed: 3, // pienso con el que empieza el jugador
  startAnimals: ['gallina'], // animales con los que empieza el jugador
  sleepFromHour: 18, // se puede dormir desde las 18:00 hasta el amanecer
  energy: {
    max: 100,
    // Una parcela entera (24 surcos) no se planta y riega con una sola barra
    costs: { plant: 3, water: 2, harvest: 1, clear: 2 },
    lowWarning: 0.2, // aviso «te queda poca energía» al bajar del 20 %
    passOutHour: 2, // a las 02:00 el granjero cae rendido donde esté
    faintEnergy: 0.5, // tras desmayarse despierta con media barra
    faintMoneyLoss: 0.1, // y le cobran el 10 % de lo que lleva…
    faintMaxLoss: 100, // …hasta un máximo de 100 🪙
  },
});
