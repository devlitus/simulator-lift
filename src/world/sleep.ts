// Regla pura de dormir (sin Babylon): el día de juego va de 06:00 a 06:00,
// así que se puede dormir desde `fromHour` hasta el amanecer siguiente.

/** Hora del amanecer: a esta hora empieza cada día. */
export const DAWN_HOUR = 6;

export function canSleep(hour: number, fromHour: number): boolean {
  return hour >= fromHour || hour < DAWN_HOUR;
}

/** Ya es medianoche (o más tarde): hora de avisar de que conviene acostarse. */
export function isPastMidnight(hour: number): boolean {
  return hour < DAWN_HOUR;
}

/** Quien sigue despierto desde `passOutHour` hasta el amanecer cae rendido. */
export function shouldPassOut(hour: number, passOutHour: number): boolean {
  return hour >= passOutHour && hour < DAWN_HOUR;
}
