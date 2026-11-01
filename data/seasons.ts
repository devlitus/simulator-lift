// Datos de las estaciones del año y su clima. La estación sale del día de
// juego (src/calendar/calendar.ts): no se guarda. Cambiar aquí la duración o
// las probabilidades no requiere tocar lógica.
import { SeasonsConfigSchema, type SeasonsConfig } from './schemas';

export const SEASONS: SeasonsConfig = SeasonsConfigSchema.parse({
  daysPerSeason: 7, // con días de 150 s, ~17 min reales por estación
  seasons: [
    {
      id: 'primavera',
      name: 'Primavera',
      icon: '🌸',
      rainChance: 0.35,
      cloudChance: 0.25,
      precipitation: 'lluvia',
      grassTint: '#ffffff',
    },
    {
      id: 'verano',
      name: 'Verano',
      icon: '☀️',
      rainChance: 0.15,
      cloudChance: 0.15,
      precipitation: 'lluvia',
      grassTint: '#ffe9a0',
    },
    {
      id: 'otono',
      name: 'Otoño',
      icon: '🍂',
      rainChance: 0.3,
      cloudChance: 0.3,
      precipitation: 'lluvia',
      grassTint: '#e8a860',
    },
    {
      id: 'invierno',
      name: 'Invierno',
      icon: '❄️',
      rainChance: 0.2,
      cloudChance: 0.35,
      precipitation: 'nieve',
      grassTint: '#c6ccd8', // el tinte solo puede oscurecer: invierno apagado y frío
    },
  ],
});
