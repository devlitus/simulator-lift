// Datos de animales de granja: especies comprables en la tienda, el pienso
// para alimentarlos y el cercado de cada una. Para añadir una especie basta
// con agregar una entrada; tienda, cercados y guardado la recogen solos (añade también su cercado en PENS).
import {
  AnimalsSchema,
  FeedSchema,
  PensSchema,
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

// Un cercado por especie, junto al camino este-oeste (ver worldView.buildPens y
// docs/plans/distribucion-granja.md). Cada animal pasea siempre dentro del suyo.
// Son contiguos: comparten valla y la puerta de cada uno da al sur.
export const PENS: Record<string, PenConfig> = PensSchema.parse({
  oveja: { x1: 1.6, x2: 5.7, z1: -2.5, z2: 6.3, gateX1: 2.8, gateX2: 4.5 },
  vaca: { x1: 5.7, x2: 10.6, z1: -2.5, z2: 6.3, gateX1: 7.3, gateX2: 9 },
  gallina: { x1: 10.6, x2: 16.6, z1: -2.5, z2: 6.3, gateX1: 12.75, gateX2: 14.45 },
});
