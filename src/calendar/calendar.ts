// Calendar (dominio puro, SIN Babylon): estaciones y clima.
// La estación se deriva del día de juego (una sola fuente de verdad); el clima
// se tira al empezar cada día con un RNG inyectable para que los tests sean
// deterministas. Los datos de cada estación viven en data/seasons.ts.
import type { CropDef, SeasonDef, SeasonId, SeasonsConfig } from '../../data/schemas';

/** Clima de un día. La lluvia riega la granja; la nieve es solo visual. */
export type WeatherKind = 'sol' | 'nublado' | 'lluvia' | 'nieve';

export const WEATHER_INFO: Record<WeatherKind, { name: string; icon: string }> = {
  sol: { name: 'Soleado', icon: '☀️' },
  nublado: { name: 'Nublado', icon: '☁️' },
  lluvia: { name: 'Lluvia', icon: '🌧️' },
  nieve: { name: 'Nieve', icon: '🌨️' },
};

/** Posición (0-based) de la estación del día `day` (el día 1 es el primero). */
export function seasonIndex(day: number, cfg: SeasonsConfig): number {
  return Math.floor((day - 1) / cfg.daysPerSeason) % cfg.seasons.length;
}

export function seasonOf(day: number, cfg: SeasonsConfig): SeasonDef {
  return cfg.seasons[seasonIndex(day, cfg)];
}

/** Día dentro de su estación, de 1 a daysPerSeason. */
export function dayOfSeason(day: number, cfg: SeasonsConfig): number {
  return ((day - 1) % cfg.daysPerSeason) + 1;
}

/** Año de juego, empezando en 1. */
export function yearOf(day: number, cfg: SeasonsConfig): number {
  return Math.floor((day - 1) / (cfg.daysPerSeason * cfg.seasons.length)) + 1;
}

/** El día `day` estrena estación (el día 1 no cuenta: la partida empieza ahí). */
export function isSeasonStart(day: number, cfg: SeasonsConfig): boolean {
  return day > 1 && dayOfSeason(day, cfg) === 1;
}

/** Tira el clima del día según las probabilidades de la estación. */
export function rollWeather(season: SeasonDef, rng: () => number): WeatherKind {
  const r = rng();
  if (r < season.rainChance) return season.precipitation;
  if (r < season.rainChance + season.cloudChance) return 'nublado';
  return 'sol';
}

/** La lluvia riega sola los cultivos. */
export function watersCrops(weather: WeatherKind): boolean {
  return weather === 'lluvia';
}

export function inSeason(crop: CropDef, season: SeasonId): boolean {
  return crop.seasons.includes(season);
}

// Subconjunto del GameState (ver core/store.ts) que necesita el calendario.
export interface CalendarState {
  day: number;
  season: SeasonId;
  weather: WeatherKind;
}

export interface DayStart {
  season: SeasonDef;
  seasonChanged: boolean; // hoy estrena estación: lo que no es de temporada se marchita
  rain: boolean; // hoy llueve: la granja se riega sola
}

/** Empieza el día `day`: fija su estación y tira su clima. */
export function beginDay(
  state: CalendarState,
  day: number,
  cfg: SeasonsConfig,
  rng: () => number,
): DayStart {
  const season = seasonOf(day, cfg);
  state.day = day;
  state.season = season.id;
  state.weather = rollWeather(season, rng);
  return { season, seasonChanged: isSeasonStart(day, cfg), rain: watersCrops(state.weather) };
}
