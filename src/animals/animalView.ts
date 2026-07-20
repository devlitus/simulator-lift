// AnimalView (vista Babylon): dibuja los animales de AnimalLogic y los pasea
// por el recinto. Los objetivos de paseo se eligen siempre dentro del vallado
// (con margen), así que un animal no puede salir del recinto por mucho que se
// mueva. No decide reglas: compra, pienso y producción viven en AnimalLogic.
import { CONFIG } from '../core/constants';
import { EVENTS, EventBus } from '../core/events';
import type { GameState } from '../core/store';
import type { WorldView } from '../world/worldView';
import type { Animal, AnimalLogic } from './animalLogic';
import type { AnimalDef, PenConfig } from '../../data/schemas';
import type { Interaction } from '../core/types';

interface AnimalVisual {
  root: any;
  tx: number; // objetivo de paseo
  tz: number;
  pause: number; // segundos quieto antes de buscar otro rincón
}

const SPEED = 0.8; // unidades/segundo (más lento que el jugador y los NPCs)
const MARGIN = 0.8; // distancia mínima a la valla al pasear

export class AnimalView {
  scene: any;
  world: WorldView;
  state: GameState;
  logic: AnimalLogic;
  defs: Record<string, AnimalDef>;
  pen: PenConfig;
  visuals: Map<Animal, AnimalVisual>;
  mats: Record<string, any>;

  constructor(
    scene: any,
    world: WorldView,
    state: GameState,
    bus: EventBus,
    logic: AnimalLogic,
    animalsData: Record<string, AnimalDef>,
    pen: PenConfig,
  ) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.logic = logic;
    this.defs = animalsData;
    this.pen = pen;
    this.visuals = new Map();
    this.mats = {};

    this.syncMeshes();
    bus.on(EVENTS.ANIMALS_CHANGED, () => this.syncMeshes());
  }

  mat(hex: string): any {
    if (!this.mats[hex]) {
      const m = new BABYLON.StandardMaterial(`amat_${hex}`, this.scene);
      m.diffuseColor = BABYLON.Color3.FromHexString(hex);
      m.specularColor = BABYLON.Color3.Black();
      this.mats[hex] = m;
    }
    return this.mats[hex];
  }

  // Punto aleatorio dentro del recinto (nunca fuera: de aquí salen todos los
  // destinos de paseo)
  randomSpot(): { x: number; z: number } {
    const p = this.pen;
    return {
      x: p.x1 + MARGIN + Math.random() * (p.x2 - p.x1 - 2 * MARGIN),
      z: p.z1 + MARGIN + Math.random() * (p.z2 - p.z1 - 2 * MARGIN),
    };
  }

  // Alinea los meshes con logic.animals: crea los que faltan (aparecen en un
  // rincón aleatorio del recinto) y elimina los que sobran
  syncMeshes(): void {
    const alive = new Set(this.logic.animals);
    for (const [animal, v] of this.visuals) {
      if (!alive.has(animal)) {
        v.root.dispose();
        this.visuals.delete(animal);
      }
    }
    for (const animal of this.logic.animals) {
      if (this.visuals.has(animal)) continue;
      const root = this.buildAnimal(animal.type);
      const spot = this.randomSpot();
      root.position.set(spot.x, 0, spot.z);
      const target = this.randomSpot();
      this.visuals.set(animal, { root, tx: target.x, tz: target.z, pause: 0 });
    }
  }

  // Paseo: paso hacia el objetivo; al llegar, descansa un rato y elige otro
  update(dt: number): void {
    for (const v of this.visuals.values()) {
      if (v.pause > 0) {
        v.pause -= dt;
        continue;
      }
      const dx = v.tx - v.root.position.x;
      const dz = v.tz - v.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.1) {
        const target = this.randomSpot();
        v.tx = target.x;
        v.tz = target.z;
        v.pause = 0.5 + Math.random() * 2.5;
        continue;
      }
      const step = Math.min(SPEED * dt, dist);
      v.root.position.x += (dx / dist) * step;
      v.root.position.z += (dz / dist) * step;
      // Los modelos miran hacia +x: con la convención de Babylon (Y arriba,
      // mano izquierda) girar hacia (dx, dz) es atan2(-dz, dx)
      v.root.rotation.y = Math.atan2(-dz, dx);
    }
  }

  // Interacción contextual del animal más cercano (alimentar con pienso)
  getInteraction(pos: { x: number; z: number }): Interaction | null {
    let best: Interaction | null = null;
    this.logic.animals.forEach((animal, i) => {
      const v = this.visuals.get(animal);
      if (!v) return;
      const d = Math.hypot(pos.x - v.root.position.x, pos.z - v.root.position.z);
      if (d < CONFIG.interactionRadius && (!best || d < best.dist)) {
        best = { dist: d, ...this.describe(animal, i) };
      }
    });
    return best;
  }

  describe(animal: Animal, i: number): { label: string; action: (() => void) | null } {
    const def = this.defs[animal.type];
    if (animal.fed) {
      return {
        label: `${def.icon} ${def.name} alimentada ✓ — dejará ${def.productName} mañana`,
        action: null,
      };
    }
    if (this.state.feed > 0) {
      return {
        label: `E: Alimentar ${def.name} (🌾 pienso ×${this.state.feed})`,
        action: () => this.logic.feedAnimal(i),
      };
    }
    return {
      label: `${def.icon} ${def.name} tiene hambre — sin pienso (cómpralo en la tienda)`,
      action: null,
    };
  }

  // ---------- Fábricas de primitivas por especie ----------

  buildAnimal(type: string): any {
    if (type === 'vaca') return this.buildCow();
    if (type === 'oveja') return this.buildSheep();
    return this.buildChicken(); // gallina y cualquier especie pequeña futura
  }

  buildCow(): any {
    const root = new BABYLON.TransformNode('cow', this.scene);
    const bodyMat = this.mat(this.defs['vaca'].color);

    const body = BABYLON.MeshBuilder.CreateBox(
      'cowBody',
      { width: 1.25, height: 0.75, depth: 0.65 },
      this.scene,
    );
    body.parent = root;
    body.position.y = 0.85;
    body.material = bodyMat;
    this.world.addShadow(body);

    const head = BABYLON.MeshBuilder.CreateBox(
      'cowHead',
      { width: 0.42, height: 0.42, depth: 0.4 },
      this.scene,
    );
    head.parent = root;
    head.position.set(0.78, 1.05, 0);
    head.material = bodyMat;
    this.world.addShadow(head);

    const muzzle = BABYLON.MeshBuilder.CreateBox(
      'cowMuzzle',
      { width: 0.2, height: 0.22, depth: 0.3 },
      this.scene,
    );
    muzzle.parent = root;
    muzzle.position.set(1.05, 0.95, 0);
    muzzle.material = this.mat('#bf8c73');

    for (const [lx, lz] of [
      [-0.45, -0.22],
      [-0.45, 0.22],
      [0.45, -0.22],
      [0.45, 0.22],
    ]) {
      const leg = BABYLON.MeshBuilder.CreateCylinder(
        'cowLeg',
        { height: 0.5, diameter: 0.14 },
        this.scene,
      );
      leg.parent = root;
      leg.position.set(lx, 0.25, lz);
      leg.material = bodyMat;
    }
    return root;
  }

  buildSheep(): any {
    const root = new BABYLON.TransformNode('sheep', this.scene);

    const body = BABYLON.MeshBuilder.CreateSphere('sheepBody', { diameter: 0.95 }, this.scene);
    body.parent = root;
    body.position.y = 0.55;
    body.material = this.mat(this.defs['oveja'].color);
    this.world.addShadow(body);

    const head = BABYLON.MeshBuilder.CreateBox(
      'sheepHead',
      { width: 0.3, height: 0.3, depth: 0.26 },
      this.scene,
    );
    head.parent = root;
    head.position.set(0.45, 0.62, 0);
    head.material = this.mat('#40362e');
    this.world.addShadow(head);
    return root;
  }

  buildChicken(): any {
    const root = new BABYLON.TransformNode('chicken', this.scene);
    const bodyMat = this.mat(this.defs['gallina'].color);

    const body = BABYLON.MeshBuilder.CreateSphere('chickenBody', { diameter: 0.34 }, this.scene);
    body.parent = root;
    body.position.y = 0.22;
    body.material = bodyMat;
    this.world.addShadow(body);

    const head = BABYLON.MeshBuilder.CreateSphere('chickenHead', { diameter: 0.18 }, this.scene);
    head.parent = root;
    head.position.set(0.16, 0.42, 0);
    head.material = bodyMat;

    const beak = BABYLON.MeshBuilder.CreateBox(
      'chickenBeak',
      { width: 0.1, height: 0.05, depth: 0.05 },
      this.scene,
    );
    beak.parent = root;
    beak.position.set(0.28, 0.4, 0);
    beak.material = this.mat('#f2991f');

    const comb = BABYLON.MeshBuilder.CreateBox(
      'chickenComb',
      { width: 0.06, height: 0.08, depth: 0.1 },
      this.scene,
    );
    comb.parent = root;
    comb.position.set(0.16, 0.52, 0);
    comb.material = this.mat('#d93333');
    return root;
  }
}
