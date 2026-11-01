// Datos de cultivos (balance de juego). Para añadir un cultivo nuevo basta
// con agregar una entrada aquí: lógica, UI, tienda y guardado la recogen sola.
// `seasons` dice en qué estaciones (data/seasons.ts) se planta y crece.
import { CropsSchema, type CropDef } from './schemas';

export const CROPS: Record<string, CropDef> = CropsSchema.parse({
  zanahoria: {
    name: 'Zanahoria',
    icon: '🥕',
    seedPrice: 10,
    sellPrice: 25,
    daysToGrow: 2,
    color: '#e07b2a',
    seasons: ['primavera', 'otono', 'invierno'], // la única que aguanta el frío
  },
  tomate: {
    name: 'Tomate',
    icon: '🍅',
    seedPrice: 15,
    sellPrice: 40,
    daysToGrow: 3,
    color: '#d1342c',
    seasons: ['primavera', 'verano'], // en primavera: la misión de Gon se hace al empezar
  },
  calabaza: {
    name: 'Calabaza',
    icon: '🎃',
    seedPrice: 25,
    sellPrice: 70,
    daysToGrow: 4,
    color: '#e8911c',
    seasons: ['verano', 'otono'],
  },
});
