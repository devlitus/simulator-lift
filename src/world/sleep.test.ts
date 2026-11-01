import { describe, it, expect } from 'vitest';
import { canSleep, isPastMidnight, shouldPassOut } from './sleep';
import { BALANCE } from '../../data/balance';

describe('canSleep', () => {
  const desde = BALANCE.sleepFromHour;

  it('no deja dormir de día', () => {
    expect(canSleep(6, desde)).toBe(false);
    expect(canSleep(12.5, desde)).toBe(false);
    expect(canSleep(desde - 0.01, desde)).toBe(false);
  });

  it('deja dormir desde la hora configurada', () => {
    expect(canSleep(desde, desde)).toBe(true);
    expect(canSleep(23.9, desde)).toBe(true);
  });

  it('deja dormir de madrugada, antes del amanecer', () => {
    expect(canSleep(0, desde)).toBe(true);
    expect(canSleep(5.99, desde)).toBe(true);
  });
});

describe('shouldPassOut', () => {
  const limite = BALANCE.energy.passOutHour;

  it('de día y por la noche antes de la hora límite se aguanta despierto', () => {
    expect(shouldPassOut(8, limite)).toBe(false);
    expect(shouldPassOut(23.9, limite)).toBe(false);
    expect(shouldPassOut(limite - 0.01, limite)).toBe(false);
  });

  it('desde la hora límite hasta el amanecer se cae rendido', () => {
    expect(shouldPassOut(limite, limite)).toBe(true);
    expect(shouldPassOut(5.99, limite)).toBe(true);
  });

  it('la hora límite cae siempre de madrugada, después de poder dormir', () => {
    expect(isPastMidnight(limite)).toBe(true);
    expect(canSleep(limite - 0.01, BALANCE.sleepFromHour)).toBe(true);
  });
});

describe('isPastMidnight', () => {
  it('solo de madrugada', () => {
    expect(isPastMidnight(23.99)).toBe(false);
    expect(isPastMidnight(0)).toBe(true);
    expect(isPastMidnight(6)).toBe(false);
  });
});
