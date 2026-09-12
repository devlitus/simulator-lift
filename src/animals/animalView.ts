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
  anims?: { walk?: any; idle?: any }; // grupos clonados por instancia (oveja)
  animActual?: string | null;
  skeleton?: any; // esqueleto clonado por instancia (oveja)
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
  modelCache: Record<string, Promise<any>>;

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
    this.modelCache = {};

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
        // Liberar animación y esqueleto clonados de la instancia (oveja)
        if (v.anims) {
          for (const g of Object.values(v.anims)) (g as any)?.dispose?.();
        }
        v.skeleton?.dispose?.();
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
        this._animar(v, false);
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
        this._animar(v, false);
        continue;
      }
      const step = Math.min(SPEED * dt, dist);
      v.root.position.x += (dx / dist) * step;
      v.root.position.z += (dz / dist) * step;
      // Los modelos miran hacia +x: con la convención de Babylon (Y arriba,
      // mano izquierda) girar hacia (dx, dz) es atan2(-dz, dx)
      v.root.rotation.y = Math.atan2(-dz, dx);
      this._animar(v, true);
    }
  }

  // Alterna walk/idle de la instancia según se mueva (como playerView);
  // sin animaciones clonadas no hace nada.
  private _animar(v: AnimalVisual, moviendo: boolean): void {
    if (!v.anims) return;
    const siguiente = moviendo ? 'walk' : 'idle';
    if (siguiente === v.animActual) return;
    const grupo = v.anims[siguiente as 'walk' | 'idle'];
    if (!grupo) return;
    if (v.animActual) v.anims[v.animActual as 'walk' | 'idle']?.stop();
    grupo.start(true);
    v.animActual = siguiente;
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
    throw new Error(`especie de animal desconocida: ${type}`);
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

    const legs: any[] = [];
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
      legs.push(leg);
    }
    this.loadModel(
      root,
      'vaca.glb',
      [body, head, muzzle, ...legs],
      (model, res) => this._attachAnims(root, model, res, false),
      true,
    );
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
    this.loadModel(
      root,
      'oveja.glb',
      [body, head],
      (model, res) => this._attachAnims(root, model, res, true),
      true,
    );
    return root;
  }

  // Carga el modelo 3D de una especie (assets/models/, publicado en /models/)
  // y, si tiene éxito, sustituye las primitivas. Si falla (asset ausente,
  // loaders no cargados) el animal se queda con las primitivas de siempre.
  // El .glb se descarga y parsea una sola vez por especie: el original queda
  // desactivado como plantilla y cada animal es una instancia de su jerarquía.
  // Con `clonar`, clones reales (Mesh.clone recursivo) en vez de
  // InstancedMesh: necesario para esqueletizar y animar por instancia
  // (instantiateHierarchy instancia las mallas con piel en esta versión).
  // Convención del modelo: pies en y=0, mirando hacia +x (ver update()).
  private _modelSeq = 0;
  private async loadModel(
    root: any,
    file: string,
    primitives: any[],
    onModel?: (model: any, res: any) => void,
    clonar = false,
  ): Promise<void> {
    try {
      this.modelCache[file] ??= BABYLON.SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        file,
        this.scene,
      ).then((res: any) => {
        res.meshes[0].setEnabled(false);
        return res;
      });
      const cached = await this.modelCache[file];
      const template = cached.meshes[0];
      // Sin clonar: instantiateHierarchy crea InstancedMesh (rápido, pero
      // comparte esqueleto: no sirve para animar por instancia).
      const model = clonar
        ? template.clone(`${file}_${this._modelSeq++}`, null, false)
        : template.instantiateHierarchy();
      model.parent = root;
      model.setEnabled(true);
      for (const m of model.getChildMeshes()) {
        if (m.getTotalVertices() > 0) this.world.addShadow(m);
      }
      for (const p of primitives) p.dispose();
      onModel?.(model, cached);
    } catch {
      // fallback: se quedan las primitivas
    }
  }

  // Anima un animal con su propio esqueleto: clona el esqueleto de la
  // plantilla, lo re-enlaza a los nodos clonados y clona los grupos de
  // animación (walk/idle) redirigidos a esos nodos. Sin esqueleto o sin
  // grupos, el animal se queda estático con el modelo.
  // Con `medioGiro`, compone además medio giro en Y sobre el modelo: el
  // cargador glTF deja en `__root__` un giro de 180° en Y (conversión
  // diestro→zurdo), así que un fichero que mira hacia +x aparece mirando
  // hacia -x en el juego (caso de la oveja). Los ficheros que ya miran
  // hacia -x (vaca) no lo necesitan.
  private _attachAnims(root: any, model: any, res: any, medioGiro: boolean): void {
    const visual = [...this.visuals.values()].find((v) => v.root === root);
    if (!visual) return;
    const tplSkel = (res.skeletons ?? [])[0];
    const grupos = res.animationGroups ?? [];
    if (!tplSkel || grupos.length === 0) return;
    if (medioGiro) {
      // Solo para ficheros que miran hacia +x (caso de la oveja): compone
      // otro medio giro vía cuaternio (manda sobre `rotation`) para que mire
      // hacia +x como el resto de modelos. Rotación propia: no altera
      // geometría ni culling.
      const giro = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI);
      model.rotationQuaternion = (
        model.rotationQuaternion ?? BABYLON.Quaternion.Identity()
      ).multiply(giro);
    }
    // La plantilla queda parada: solo los clones por instancia animan.
    // (El cargador glTF arranca el primer grupo solo.)
    for (const g of grupos) g.stop?.();
    // Mesh.clone conserva los nombres: mapa de este modelo por nombre
    // (con fallback al prefijo "Clone of " de instantiateHierarchy).
    const porNombre = new Map<string, any>();
    porNombre.set(model.name, model);
    for (const d of model.getDescendants(false)) porNombre.set(d.name, d);
    const buscar = (nombre: string): any =>
      porNombre.get(nombre) ?? porNombre.get(`Clone of ${nombre}`);
    let esqueleto = tplSkel;
    if (typeof tplSkel.clone === 'function') {
      esqueleto = tplSkel.clone(`${model.name}_skeleton`);
      for (const hueso of esqueleto.bones ?? []) {
        const nodo = buscar(hueso.name);
        if (nodo && typeof hueso.linkTransformNode === 'function') {
          hueso.linkTransformNode(nodo);
        }
      }
      for (const m of model.getChildMeshes(false)) {
        if (m.skeleton === tplSkel) m.skeleton = esqueleto;
      }
    }
    visual.skeleton = esqueleto === tplSkel ? undefined : esqueleto;
    visual.anims = {};
    visual.animActual = null;
    for (const g of grupos) {
      const nombre = (g.name ?? '').toLowerCase();
      const clave = nombre.includes('walk') ? 'walk' : nombre.includes('idle') ? 'idle' : null;
      if (!clave || typeof g.clone !== 'function') continue;
      const clon = g.clone(`${model.name}_${clave}`, (viejo: any) => buscar(viejo.name) ?? viejo);
      clon.stop();
      visual.anims[clave as 'walk' | 'idle'] = clon;
    }
    if (Object.keys(visual.anims).length === 0) visual.anims = undefined;
  }
}
