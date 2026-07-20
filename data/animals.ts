// Datos de animales de granja: especies comprables en la tienda, el pienso
// para alimentarlos y el rectángulo del recinto. Para añadir una especie basta
// con agregar una entrada; tienda, recinto y guardado la recogen solos.
import {
  AnimalsSchema,
  FeedSchema,
  PenConfigSchema,
  type AnimalDef,
  type FeedDef,
  type PenConfig,
} from './schemas';

// Un animal alimentado produce 1 unidad de su producto al empezar el día
// siguiente (ver src/animals/animalLogic.ts).
export const ANIMALS: Record<string, AnimalDef> = AnimalsSchema.parse({
  gallina: {
    name: 'Gallina',
    icon: '🐔',
    price: 40,
    productName: 'Huevo',
    productIcon: '🥚',
    productPrice: 12,
    color: '#f2eee0',
  },
  oveja: {
    name: 'Oveja',
    icon: '🐑',
    price: 100,
    productName: 'Lana',
    productIcon: '🧶',
    productPrice: 22,
    color: '#eae5d9',
  },
  vaca: {
    name: 'Vaca',
    icon: '🐄',
    price: 150,
    productName: 'Leche',
    productIcon: '🥛',
    productPrice: 32,
    color: '#6b4729',
  },
});

// Comida para los animales: 1 unidad alimenta a 1 animal durante 1 día
export const ANIMAL_FEED: FeedDef = FeedSchema.parse({
  name: 'Pienso',
  icon: '🌾',
  price: 5,
});

// Recinto de animales al oeste de la calle, frente a la parcela (ver
// worldView.buildPen). Los animales pasean siempre dentro de este rectángulo.
export const PEN: PenConfig = PenConfigSchema.parse({
  x1: -10,
  x2: -2.5,
  z1: 2.5,
  z2: 8,
  gateZ1: 4.3, // la puerta al este queda entre z=4.3 y z=6.2
  gateZ2: 6.2,
});
