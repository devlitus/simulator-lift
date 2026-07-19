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
    home: { x: 11, z: -3.2 },
    waypoints: null, // se queda en su tienda
    hasShop: true,
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
    hasShop: false,
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
    home: { x: -2, z: -12 },
    waypoints: [
      [-2, -12],
      [3, -13],
      [0, -16],
    ], // pasea por su jardín
    hasShop: false,
    dialogs: [
      'Oh... hola. No suelo hablar con desconocidos, la verdad.',
      'Hola otra vez. ¿Viste mis flores? Las regué esta misma mañana.',
      '¡Me alegra verte! Te juro que los girasoles se giran cuando pasas.',
      'Contigo el pueblo florece. Gracias por ser tan buena persona.',
    ],
  },
]);
