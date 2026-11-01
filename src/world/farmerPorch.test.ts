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
  it('se sube por dos peldaños hasta la tarima', () => {
    expect(floorHeightAt(H.x, PORCH.stepFrontZ + 0.1)).toBe(0);
    expect(floorHeightAt(H.x, PORCH.stepFrontZ - 0.1)).toBe(PORCH.stepHeight);
    expect(floorHeightAt(H.x, PORCH.deckFrontZ - 0.1)).toBe(PORCH.deckHeight);
  });

  it('lejos del porche se pisa el césped', () => {
    expect(floorHeightAt(0, 12)).toBe(0);
    expect(floorHeightAt(H.x + 3, DOOR_SPOT.z)).toBe(0);
  });

  it('hay paso libre de frente hasta la puerta', () => {
    for (let z = PORCH.stepFrontZ + 1; z > DOOR_SPOT.z; z -= 0.05) {
      expect(chocaBarrera(H.x, z)).toBe(false);
    }
  });

  it('no se sube a la tarima por los lados ni por el frente fuera del peldaño', () => {
    expect(chocaBarrera(H.x + PORCH.halfWidth + 0.1, DOOR_SPOT.z)).toBe(true);
    expect(chocaBarrera(H.x - PORCH.halfWidth - 0.1, DOOR_SPOT.z)).toBe(true);
    expect(chocaBarrera(H.x + 1, PORCH.deckFrontZ)).toBe(true);
    expect(chocaBarrera(H.x - 1, PORCH.deckFrontZ)).toBe(true);
  });

  it('solo se entra justo frente a la puerta, sobre la tarima', () => {
    expect(canEnterDoor(DOOR_SPOT.x, DOOR_SPOT.z)).toBe(true);
    expect(canEnterDoor(H.x + 0.7, DOOR_SPOT.z)).toBe(false); // a un lado de la puerta
    expect(canEnterDoor(H.x, PORCH.deckFrontZ - 0.1)).toBe(false); // en el borde de la tarima
    expect(canEnterDoor(H.x, PORCH.stepFrontZ + 0.5)).toBe(false); // al pie de los peldaños
  });
});
