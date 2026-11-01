// Paseo de un transeúnte por su circuito (sin Babylon): avanza hacia el
// siguiente punto, se para un rato al llegar y sigue; al acabar la ruta vuelve
// al primer punto. Si el jugador se le pone delante, se detiene y le mira un
// momento; si no se aparta, sigue su camino (no se queda atascado).

export type Point = readonly [number, number];

export interface Walker {
  x: number;
  z: number;
  heading: number; // rotación y (atan2(dx, dz))
  target: number; // índice del punto hacia el que va
  wait: number; // segundos que le quedan parado
  moving: boolean;
  yielded: number; // segundos que lleva parado por el jugador
}

/** Distancia a la que el transeúnte se para si el jugador está cerca. */
export const YIELD_RADIUS = 1.1;
/** Tiempo máximo que cede el paso antes de seguir andando. */
export const YIELD_MAX = 2;
const LLEGADA = 0.05;

export function createWalker(route: readonly Point[], start = 0): Walker {
  const [x, z] = route[start % route.length];
  return {
    x,
    z,
    heading: 0,
    target: (start + 1) % route.length,
    wait: 0,
    moving: false,
    yielded: 0,
  };
}

export function stepWalker(
  w: Walker,
  route: readonly Point[],
  speed: number,
  pause: number,
  dt: number,
  player?: { x: number; z: number },
): void {
  const cerca = player !== undefined && Math.hypot(player.x - w.x, player.z - w.z) < YIELD_RADIUS;
  if (!cerca) w.yielded = 0;
  else if (w.yielded < YIELD_MAX) {
    w.yielded += dt;
    w.heading = Math.atan2(player.x - w.x, player.z - w.z);
    w.moving = false;
    return;
  }
  if (w.wait > 0) {
    w.wait = Math.max(0, w.wait - dt);
    w.moving = false;
    return;
  }
  const [tx, tz] = route[w.target];
  const dx = tx - w.x;
  const dz = tz - w.z;
  const dist = Math.hypot(dx, dz);
  if (dist < LLEGADA) {
    w.target = (w.target + 1) % route.length;
    w.wait = pause;
    w.moving = false;
    return;
  }
  const paso = Math.min(speed * dt, dist);
  w.x += (dx / dist) * paso;
  w.z += (dz / dist) * paso;
  w.heading = Math.atan2(dx, dz);
  w.moving = true;
}
