import { describe, it, expect } from 'vitest';
import {
  beginDay,
  dayOfSeason,
  inSeason,
  isSeasonStart,
  rollWeather,
  seasonOf,
  watersCrops,
  yearOf,
} from './calendar';
import type { CropDef, SeasonsConfig } from '../../data/schemas';

const CFG: SeasonsConfig = {
  daysPerSeason: 7,
  seasons: [
    {
      id: 'primavera',
      name: 'Primavera',
      icon: '🌸',
      rainChance: 0.3,
      cloudChance: 0.2,
      precipitation: 'lluvia',
      grassTint: '#ffffff',
    },
    {
      id: 'verano',
      name: 'Verano',
      icon: '☀️',
      rainChance: 0.1,
      cloudChance: 0.1,
      precipitation: 'lluvia',
      grassTint: '#ffffff',
    },
    {
      id: 'otono',
      name: 'Otoño',
      icon: '🍂',
      rainChance: 0.3,
      cloudChance: 0.3,
      precipitation: 'lluvia',
      grassTint: '#ffffff',
    },
    {
      id: 'invierno',
      name: 'Invierno',
      icon: '❄️',
      rainChance: 0.2,
      cloudChance: 0.3,
      precipitation: 'nieve',
      grassTint: '#ffffff',
    },
  ],
};

describe('calendar', () => {
  it('deriva la estación del día', () => {
    expect(seasonOf(1, CFG).id).toBe('primavera');
    expect(seasonOf(7, CFG).id).toBe('primavera');
    expect(seasonOf(8, CFG).id).toBe('verano');
    expect(seasonOf(22, CFG).id).toBe('invierno');
    expect(seasonOf(28, CFG).id).toBe('invierno');
    expect(seasonOf(29, CFG).id).toBe('primavera'); // vuelve a empezar el año
  });

  it('cuenta el día dentro de la estación y el año', () => {
    expect(dayOfSeason(1, CFG)).toBe(1);
    expect(dayOfSeason(7, CFG)).toBe(7);
    expect(dayOfSeason(8, CFG)).toBe(1);
    expect(yearOf(28, CFG)).toBe(1);
    expect(yearOf(29, CFG)).toBe(2);
  });

  it('marca el estreno de estación salvo el primer día de partida', () => {
    expect(isSeasonStart(1, CFG)).toBe(false);
    expect(isSeasonStart(7, CFG)).toBe(false);
    expect(isSeasonStart(8, CFG)).toBe(true);
    expect(isSeasonStart(29, CFG)).toBe(true);
  });

  it('tira el clima según las probabilidades de la estación', () => {
    const primavera = CFG.seasons[0];
    expect(rollWeather(primavera, () => 0.1)).toBe('lluvia');
    expect(rollWeather(primavera, () => 0.4)).toBe('nublado');
    expect(rollWeather(primavera, () => 0.9)).toBe('sol');
    expect(rollWeather(CFG.seasons[3], () => 0.1)).toBe('nieve');
  });

  it('solo la lluvia riega', () => {
    expect(watersCrops('lluvia')).toBe(true);
    expect(watersCrops('nieve')).toBe(false);
    expect(watersCrops('nublado')).toBe(false);
  });

  it('empieza el día fijando estación y clima', () => {
    const state = { day: 7, season: 'primavera' as const, weather: 'sol' as const };
    const start = beginDay(state, 8, CFG, () => 0.05);
    expect(state).toEqual({ day: 8, season: 'verano', weather: 'lluvia' });
    expect(start).toMatchObject({ seasonChanged: true, rain: true });
    expect(beginDay(state, 9, CFG, () => 0.99)).toMatchObject({
      seasonChanged: false,
      rain: false,
    });
  });

  it('sabe si un cultivo es de temporada', () => {
    const crop: CropDef = {
      name: 'Fresa',
      icon: '🍓',
      seedPrice: 1,
      sellPrice: 2,
      daysToGrow: 1,
      color: '#ff0000',
      seasons: ['primavera'],
    };
    expect(inSeason(crop, 'primavera')).toBe(true);
    expect(inSeason(crop, 'verano')).toBe(false);
  });
});
