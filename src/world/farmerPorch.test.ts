import { describe, it, expect } from 'vitest';
import {
  canEnterDoor,
  DOOR_SPOT,
  FARMER_HOUSE as H,
  floorHeightAt,
  PORCH,
  PORCH_BARRIERS,
} from './farmerPorch';

const MEDIA_CAJA = 0.35; // media caja del granjero (playerView)

function chocaBarrera(x: number, z: number): boolean {
  return PORCH_BARRIERS.some(
    (c) => Math.abs(x - c.cx) < c.w / 2 + MEDIA_CAJA && Math.abs(z - c.cz) < c.d / 2 + MEDIA_CAJA,
  );
}

describe('porche de la casa del granjero', () => {
  it('la puerta mira al oeste, hacia la entrada de la granja', () => {
    expect(DOOR_SPOT.x).toBeLessThan(H.x);
    expect(DOOR_SPOT.z).toBe(H.z);
  });

  it('solo se entra frente a la puerta, no desde detrás de la casa', () => {
    expect(canEnterDoor(DOOR_SPOT.x, DOOR_SPOT.z)).toBe(true);
    expect(canEnterDoor(H.x + H.depth / 2 + 1, H.z)).toBe(false);
    expect(canEnterDoor(H.x + 12, H.z)).toBe(false);
  });

  it('se sube por dos peldaños hasta la tarima', () => {
    expect(floorHeightAt(PORCH.stepFrontX - 0.1, H.z)).toBe(0);
    expect(floorHeightAt(PORCH.stepFrontX + 0.1, H.z)).toBe(PORCH.stepHeight);
    expect(floorHeightAt(PORCH.deckFrontX + 0.1, H.z)).toBe(PORCH.deckHeight);
  });

  it('lejos del porche se pisa el césped', () => {
    expect(floorHeightAt(0, 12)).toBe(0);
    expect(floorHeightAt(DOOR_SPOT.x, H.z + 3)).toBe(0);
  });

  it('hay paso libre de frente hasta la puerta', () => {
    for (let x = PORCH.stepFrontX - 1; x < DOOR_SPOT.x; x += 0.05) {
      expect(chocaBarrera(x, H.z)).toBe(false);
    }
  });

  it('no se sube a la tarima por los lados ni por el frente fuera del peldaño', () => {
    expect(chocaBarrera(DOOR_SPOT.x, H.z + PORCH.halfWidth + 0.1)).toBe(true);
    expect(chocaBarrera(DOOR_SPOT.x, H.z - PORCH.halfWidth - 0.1)).toBe(true);
    expect(chocaBarrera(PORCH.deckFrontX, H.z + 1)).toBe(true);
    expect(chocaBarrera(PORCH.deckFrontX, H.z - 1)).toBe(true);
  });

  it('solo se entra justo frente a la puerta, sobre la tarima', () => {
    expect(canEnterDoor(DOOR_SPOT.x, DOOR_SPOT.z)).toBe(true);
    expect(canEnterDoor(DOOR_SPOT.x, H.z + 0.7)).toBe(false); // a un lado de la puerta
    expect(canEnterDoor(PORCH.deckFrontX + 0.1, H.z)).toBe(false); // en el borde de la tarima
    expect(canEnterDoor(PORCH.stepFrontX - 0.5, H.z)).toBe(false); // al pie de los peldaños
  });
});
