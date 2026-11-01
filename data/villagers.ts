// Transeúntes: vecinos de ambiente que pasean por los caminos del pueblo.
// Cada uno tiene aspecto, ritmo y ruta propios; no entran en amistad ni
// misiones (eso es data/npcs.ts), solo saludan si les hablas.
// Las rutas son circuitos cerrados sobre los caminos (ver src/world/*Layout.ts):
// camino norte-sur en x ∈ [-1,1, 1,1], este-oeste en z ∈ [-5,1, -2,9] y las
// calles del barrio en z ≈ -12,8 y z ≈ -21,6. Cada sentido va por su lado.
import { VillagersSchema, type VillagerDef } from './schemas';

const PIEL_CLARA: [number, number, number] = [0.96, 0.82, 0.68];
const PIEL_MEDIA: [number, number, number] = [0.84, 0.64, 0.46];
const PIEL_OSCURA: [number, number, number] = [0.52, 0.36, 0.24];
const PIEL_ROSADA: [number, number, number] = [0.98, 0.76, 0.66];

export const VILLAGERS: VillagerDef[] = VillagersSchema.parse([
  {
    id: 'rosa',
    name: 'Doña Rosa',
    look: {
      skin: PIEL_CLARA,
      shirt: [0.55, 0.3, 0.55],
      pants: [0.3, 0.22, 0.32],
      hair: [0.88, 0.88, 0.9], // canosa
      hat: 'mono',
      hatColor: [0.88, 0.88, 0.9],
      height: 0.88,
      build: 1.05,
    },
    speed: 0.7, // va despacito
    pause: 3,
    route: [
      [-0.5, -3.6],
      [5, -3.6],
      [13, -3.6],
      [21.5, -3.6],
      [21.5, -4.5],
      [13, -4.5],
      [5, -4.5],
      [-0.5, -4.5],
    ], // de escaparate en escaparate por el mercado
    greetings: [
      'Ay, hijo, qué calor hace hoy.',
      'Voy a ver si Marta tiene ya las semillas de calabaza.',
      'En mis tiempos esto era todo campo, ¿sabes?',
    ],
  },
  {
    id: 'pablo',
    name: 'Pablo',
    look: {
      skin: PIEL_MEDIA,
      shirt: [0.2, 0.45, 0.8],
      pants: [0.18, 0.2, 0.3],
      hair: [0.15, 0.1, 0.06],
      hat: 'gorra',
      hatColor: [0.85, 0.2, 0.2],
      height: 0.8, // un chaval
      build: 0.85,
    },
    speed: 2.2, // siempre corriendo
    pause: 0.3,
    route: [
      [0.5, 12.5],
      [0.5, -27],
      [-0.5, -27],
      [-0.5, 12.5],
    ], // el camino norte-sur entero, de punta a punta
    greetings: [
      '¡No me pillas!',
      '¡Hola! ¡Voy a casa de mi abuela!',
      '¿Tienes gallinas? ¡Qué guay!',
    ],
  },
  {
    id: 'ernesto',
    name: 'Ernesto',
    look: {
      skin: PIEL_ROSADA,
      shirt: [0.92, 0.9, 0.82],
      pants: [0.45, 0.35, 0.22],
      hair: [0.45, 0.42, 0.4],
      hat: 'sombrero',
      hatColor: [0.82, 0.7, 0.42], // de paja
      height: 1.05,
      build: 1.2,
    },
    speed: 1.0,
    pause: 2,
    route: [
      [-29.5, -3.6],
      [-2, -3.6],
      [-2, -4.4],
      [-29.5, -4.4],
    ], // el camino este-oeste por delante del barrio
    greetings: [
      'Buenas. Este año la cosecha viene buena, ya verás.',
      'Gon ha vuelto a quemar la comida en la forja, huele desde aquí.',
      'Si riegas por la mañana, la tierra lo agradece.',
    ],
  },
  {
    id: 'clara',
    name: 'Clara',
    look: {
      skin: PIEL_OSCURA,
      shirt: [0.95, 0.75, 0.2],
      pants: [0.25, 0.3, 0.5],
      hair: [0.08, 0.06, 0.05],
      hat: 'panuelo',
      hatColor: [0.2, 0.65, 0.55],
      height: 0.98,
      build: 0.95,
    },
    speed: 1.3,
    pause: 1.5,
    route: [
      [-0.4, -12.4],
      [-29.5, -12.4],
      [-29.5, -13.2],
      [-0.4, -13.2],
    ], // la calle de la primera fila del barrio
    greetings: [
      '¡Hola, vecino! ¿Ya te has instalado en la granja?',
      'Mañana hago pan; si te pasas, te guardo una hogaza.',
    ],
  },
  {
    id: 'mateo',
    name: 'Mateo',
    look: {
      skin: PIEL_CLARA,
      shirt: [0.3, 0.55, 0.3],
      pants: [0.35, 0.28, 0.2],
      hair: [0.75, 0.45, 0.18], // pelirrojo
      hat: 'ninguno',
      hatColor: [0, 0, 0],
      height: 1.12, // el más alto del pueblo
      build: 0.9,
    },
    speed: 1.5,
    pause: 1,
    route: [
      [-0.3, -21.3],
      [-29.5, -21.3],
      [-29.5, -21.9],
      [-0.3, -21.9],
    ], // la calle de la última fila del barrio
    greetings: [
      '¿Has visto a mi perro? Se llama Trufa.',
      'Desde aquí arriba se ve todo el pueblo, ¿eh?',
    ],
  },
  {
    id: 'ines',
    name: 'Inés',
    look: {
      skin: PIEL_MEDIA,
      shirt: [0.85, 0.35, 0.3],
      pants: [0.2, 0.2, 0.22],
      hair: [0.3, 0.18, 0.1],
      hat: 'mono',
      hatColor: [0.3, 0.18, 0.1],
      height: 0.96,
      build: 0.9,
    },
    speed: 1.2,
    pause: 2.5,
    route: [
      [0.4, 10],
      [0.4, -3.8],
      [18, -3.8],
      [18, -4.6],
      [-0.4, -4.6],
      [-0.4, 10],
    ], // de la entrada de la granja al mercado y vuelta
    greetings: [
      '¡Hola! Voy a por flores a la tienda de Lila.',
      'Tu granja está quedando preciosa, de verdad.',
      'Dicen que esta noche habrá estrellas fugaces.',
    ],
  },
  {
    id: 'bruno',
    name: 'Bruno',
    look: {
      skin: PIEL_OSCURA,
      shirt: [0.25, 0.25, 0.28],
      pants: [0.3, 0.38, 0.55], // peto vaquero
      hair: [0.05, 0.05, 0.05],
      hat: 'gorra',
      hatColor: [0.2, 0.4, 0.25],
      height: 1.0,
      build: 1.25, // corpulento
    },
    speed: 1.1,
    pause: 1.5,
    route: [
      [-0.6, -4.6],
      [-0.6, -21.6],
      [-20, -21.6],
      [-20, -21.9],
      [-0.9, -21.9],
      [-0.9, -4.6],
    ], // del cruce a lo alto del barrio
    greetings: [
      'Vengo de cortar leña. Hoy no me sobra ni una gota de energía.',
      'Si necesitas una mano con la valla, avísame.',
    ],
  },
  {
    id: 'lucia',
    name: 'Lucía',
    look: {
      skin: PIEL_ROSADA,
      shirt: [0.6, 0.8, 0.95],
      pants: [0.9, 0.9, 0.92],
      hair: [0.95, 0.82, 0.45], // rubia
      hat: 'sombrero',
      hatColor: [0.95, 0.55, 0.65],
      height: 0.92,
      build: 0.85,
    },
    speed: 0.9,
    pause: 4, // se para a mirar cada esquina
    route: [
      [0.3, -27],
      [0.3, -12.6],
      [-12, -12.6],
      [-12, -12.9],
      [-0.3, -12.9],
      [-0.3, -27],
    ], // el norte del pueblo, sin prisa
    greetings: [
      'Estoy pintando el pueblo. ¿Te importa salir en el cuadro?',
      'La luz de la tarde aquí es preciosa.',
    ],
  },
  {
    id: 'anselmo',
    name: 'Anselmo',
    look: {
      skin: PIEL_MEDIA,
      shirt: [0.5, 0.32, 0.2],
      pants: [0.22, 0.2, 0.18],
      hair: [0.6, 0.6, 0.6],
      hat: 'sombrero',
      hatColor: [0.2, 0.18, 0.16], // de fieltro
      height: 0.95,
      build: 1.1,
    },
    speed: 0.8,
    pause: 2,
    route: [
      [4.5, 13.6],
      [0.2, 13.6],
      [0.2, -3.7],
      [10, -3.7],
      [10, -4.3],
      [-0.2, -4.3],
      [-0.2, 13.4],
      [4.5, 13.4],
    ], // de la puerta de tu granja al rancho de Tomás
    greetings: [
      'Antes esta granja era de tu abuelo. Buen hombre.',
      'Las vacas de Tomás dan la mejor leche de la comarca.',
      'No corras tanto, que la vida es larga.',
    ],
  },
  {
    id: 'nuria',
    name: 'Nuria',
    look: {
      skin: PIEL_CLARA,
      shirt: [0.45, 0.2, 0.6],
      pants: [0.15, 0.15, 0.2],
      hair: [0.12, 0.08, 0.06],
      hat: 'panuelo',
      hatColor: [0.95, 0.85, 0.3],
      height: 1.02,
      build: 0.95,
    },
    speed: 1.7, // va con prisa al trabajo
    pause: 0.8,
    route: [
      [-29.5, -3.5],
      [24, -3.5],
      [24, -4.5],
      [-29.5, -4.5],
    ], // el camino este-oeste entero
    greetings: ['¡Perdona, que llego tarde!', 'Hola, hola. Otro día charlamos, ¿vale?'],
  },
]);
