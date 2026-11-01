// Datos de NPCs: identidad, aspecto, posición/ruta y diálogos por nivel de amistad.
// Para añadir un NPC basta con agregar una entrada; el sistema la crea sola.
// dialogs[i] corresponde al nivel de amistad i (ver data/friendship.ts).
import { NpcsSchema, type NpcDef } from './schemas';

export const NPC_DEFS: NpcDef[] = NpcsSchema.parse([
  {
    id: 'marta',
    name: 'Marta',
    role: 'Tendera',
    color: [0.85, 0.4, 0.62], // rosa
    home: { x: 400, z: -402.3 }, // tras el mostrador (keeperSpot, src/world/marketLayout.ts)
    waypoints: null, // se queda en su tienda
    shop: 'semillas',
    dialogs: [
      '¿Sí? No te conozco... ¿buscas semillas? La tienda está abierta, mira sin compromiso.',
      '¡Hola de nuevo! Recuerda regar tus cultivos cada día, o se marchitarán.',
      '¡Mi cliente favorito! Cuentan que las calabazas pagan muy bien en el mercado.',
      '¡Eres como de la familia! Te guardaré siempre las mejores semillas.',
    ],
  },
  {
    id: 'gon',
    name: 'Gon',
    role: 'Herrero',
    color: [0.48, 0.5, 0.55], // gris
    home: { x: -13, z: -4 },
    waypoints: [
      [-13, -4],
      [-9, -7],
    ], // patrulla entre la forja y el camino
    shop: null,
    dialogs: [
      'Hmm. ¿Quién eres tú? Estoy ocupado, habla rápido.',
      'Ah, la persona nueva de la granja. Trabaja duro y nos llevaremos bien.',
      '¡Colega! Pásate cuando quieras, tengo historias buenísimas de la mina.',
      'Eres mi mejor amigo. Si alguna vez necesitas algo, aquí estaré.',
    ],
  },
  {
    id: 'lila',
    name: 'Lila',
    role: 'Florista',
    color: [0.35, 0.68, 0.4], // verde
    home: { x: 0, z: -402.3 }, // tras el mostrador de la floristería
    waypoints: null,
    shop: 'flores',
    dialogs: [
      'Oh... hola. No suelo hablar con desconocidos, la verdad.',
      'Hola otra vez. ¿Viste mis flores? Las regué esta misma mañana.',
      '¡Me alegra verte! Te juro que los girasoles se giran cuando pasas.',
      'Contigo el pueblo florece. Gracias por ser tan buena persona.',
    ],
  },
  {
    id: 'tomas',
    name: 'Tomás',
    role: 'Ganadero',
    color: [0.45, 0.32, 0.2], // marrón
    home: { x: -400, z: -402.3 }, // tras el mostrador del rancho
    waypoints: null,
    shop: 'animales',
    dialogs: [
      'Buenas. Si buscas animales o pienso, has llegado al sitio. Mira lo que hay.',
      '¿Qué tal esas gallinas? Bien comidas ponen un huevo cada día, ya verás.',
      'Se nota que cuidas a tus animales. Eso no lo hace cualquiera.',
      'Eres el mejor ganadero que ha pasado por aquí... después de mí, claro.',
    ],
  },
]);
