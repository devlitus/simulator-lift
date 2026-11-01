import { describe, it, expect } from 'vitest';
import { canSleep } from './sleep';
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
