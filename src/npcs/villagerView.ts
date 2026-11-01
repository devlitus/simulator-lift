// VillagerView (vista Babylon): los transeúntes de data/villagers.ts. Cada uno
// tiene su modelo 3D con rig y animaciones walk/idle (assets/transeuntes/,
// publicado en /models/transeunte_<id>.glb); mientras carga, o si falla, queda
// un muñeco de primitivas que balancea brazos y piernas al andar. El paseo lo
// calcula npcs/villagerRoute.ts.
import type { VillagerDef } from '../../data/schemas';
import type { WorldView } from '../world/worldView';
import type { GameUI } from '../ui/ui';
import type { Interaction } from '../core/types';
import { CONFIG } from '../core/constants';
import { createWalker, stepWalker, type Walker } from './villagerRoute';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AnimationGroup, Mesh, Scene } from '@babylonjs/core';

const BALANCEO = 0.6; // amplitud del paso, en radianes
const ZANCADA = 1.6; // metros por ciclo completo de pasos
// Metros por ciclo de `walk` a altura 1 (metricas.json de assets/transeuntes/):
// la animación se acelera con la velocidad para que los pies no patinen.
const ZANCADA_MODELO = 0.666;
const CADENCIA_MAX = 2.6; // ciclos por segundo; más rápido parece frenético

interface VillagerInstance {
  def: VillagerDef;
  root: TransformNode;
  walker: Walker;
  limbs: { legL: TransformNode; legR: TransformNode; armL: TransformNode; armR: TransformNode };
  phase: number;
  saludo: number; // índice del próximo saludo
  anims?: { walk?: AnimationGroup; idle?: AnimationGroup };
  animActual?: 'walk' | 'idle';
}

export class VillagerView {
  villagers: VillagerInstance[];
  private ui: GameUI;

  constructor(scene: Scene, world: WorldView, ui: GameUI, defs: VillagerDef[]) {
    this.ui = ui;
    // Cada uno arranca en un punto distinto de su ruta para que no salgan en fila
    this.villagers = defs.map((def, i) => this.build(scene, world, def, i));
  }

  private build(scene: Scene, world: WorldView, def: VillagerDef, i: number): VillagerInstance {
    const { look } = def;
    const root = new TransformNode(`villager_${def.id}`, scene);
    const cuerpo = new TransformNode(`villagerBody_${def.id}`, scene);
    cuerpo.parent = root;
    cuerpo.scaling.setAll(look.height);

    const mat = (c: readonly [number, number, number]) => {
      const m = new StandardMaterial(`villagerMat_${def.id}`, scene);
      m.diffuseColor = new Color3(c[0], c[1], c[2]);
      m.specularColor = Color3.Black();
      return m;
    };
    const piel = mat(look.skin);
    const camisa = mat(look.shirt);
    const pantalon = mat(look.pants);
    const pelo = mat(look.hair);
    const sombrero = mat(look.hatColor);
    const mallas: Mesh[] = [];
    const pieza = (m: Mesh, parent: TransformNode, material: StandardMaterial) => {
      m.parent = parent;
      m.material = material;
      mallas.push(m);
      return m;
    };
    // Articulación: un nodo en la cadera/hombro del que cuelga la extremidad
    const articulacion = (nombre: string, x: number, y: number) => {
      const n = new TransformNode(`${nombre}_${def.id}`, scene);
      n.parent = cuerpo;
      n.position.set(x, y, 0);
      return n;
    };

    const w = look.build;
    const legL = articulacion('legL', -0.12 * w, 0.62);
    const legR = articulacion('legR', 0.12 * w, 0.62);
    for (const leg of [legL, legR]) {
      const p = MeshBuilder.CreateBox('vLeg', { width: 0.17, height: 0.62, depth: 0.2 }, scene);
      pieza(p, leg, pantalon).position.y = -0.31;
    }

    const tronco = MeshBuilder.CreateCylinder(
      'vTorso',
      { height: 0.55, diameterTop: 0.42 * w, diameterBottom: 0.48 * w, tessellation: 12 },
      scene,
    );
    pieza(tronco, cuerpo, camisa).position.y = 0.9;

    const armL = articulacion('armL', -0.27 * w, 1.13);
    const armR = articulacion('armR', 0.27 * w, 1.13);
    for (const arm of [armL, armR]) {
      const manga = MeshBuilder.CreateBox(
        'vArm',
        { width: 0.12, height: 0.42, depth: 0.14 },
        scene,
      );
      pieza(manga, arm, camisa).position.y = -0.2;
      const mano = MeshBuilder.CreateSphere('vHand', { diameter: 0.13, segments: 6 }, scene);
      pieza(mano, arm, piel).position.y = -0.44;
    }

    const cabeza = MeshBuilder.CreateSphere('vHead', { diameter: 0.42, segments: 10 }, scene);
    pieza(cabeza, cuerpo, piel).position.y = 1.4;
    // Pelo: un casquete que cubre la coronilla y la nuca
    const melena = MeshBuilder.CreateSphere(
      'vHair',
      { diameter: 0.45, segments: 10, slice: 0.55 },
      scene,
    );
    pieza(melena, cuerpo, pelo).position.set(0, 1.42, -0.02);

    switch (look.hat) {
      case 'sombrero': {
        const ala = MeshBuilder.CreateCylinder('vBrim', { height: 0.03, diameter: 0.75 }, scene);
        pieza(ala, cuerpo, sombrero).position.y = 1.56;
        const copa = MeshBuilder.CreateCylinder(
          'vCrown',
          { height: 0.2, diameterTop: 0.32, diameterBottom: 0.38 },
          scene,
        );
        pieza(copa, cuerpo, sombrero).position.y = 1.66;
        break;
      }
      case 'gorra': {
        const casquete = MeshBuilder.CreateSphere(
          'vCap',
          { diameter: 0.46, segments: 10, slice: 0.5 },
          scene,
        );
        pieza(casquete, cuerpo, sombrero).position.y = 1.47;
        const visera = MeshBuilder.CreateBox(
          'vVisor',
          { width: 0.3, height: 0.03, depth: 0.2 },
          scene,
        );
        pieza(visera, cuerpo, sombrero).position.set(0, 1.5, 0.27);
        break;
      }
      case 'panuelo': {
        const tela = MeshBuilder.CreateSphere(
          'vScarf',
          { diameter: 0.47, segments: 10, slice: 0.45 },
          scene,
        );
        pieza(tela, cuerpo, sombrero).position.set(0, 1.46, -0.01);
        const nudo = MeshBuilder.CreateSphere('vKnot', { diameter: 0.12, segments: 6 }, scene);
        pieza(nudo, cuerpo, sombrero).position.set(0, 1.38, -0.24);
        break;
      }
      case 'mono': {
        const mono = MeshBuilder.CreateSphere('vBun', { diameter: 0.2, segments: 8 }, scene);
        pieza(mono, cuerpo, sombrero).position.set(0, 1.62, -0.1);
        break;
      }
      case 'ninguno':
        break;
    }

    for (const m of mallas) world.addShadow(m);

    const walker = createWalker(def.route, i % def.route.length);
    root.position.set(walker.x, 0, walker.z);
    const v: VillagerInstance = {
      def,
      root,
      walker,
      limbs: { legL, legR, armL, armR },
      phase: 0,
      saludo: i % def.greetings.length,
    };
    void this._loadModel(scene, world, v, cuerpo);
    return v;
  }

  // El GLB ya viene a escala métrica, con la cara hacia +Z y los pies en 0:
  // se cuelga del root tal cual y sustituye a las primitivas.
  private async _loadModel(
    scene: Scene,
    world: WorldView,
    v: VillagerInstance,
    primitivas: TransformNode,
  ): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        `transeunte_${v.def.id}.glb`,
        scene,
      );
      res.meshes[0].parent = v.root;
      for (const m of res.meshes) {
        if (m.getTotalVertices() > 0) world.addShadow(m);
      }
      v.anims = {};
      for (const g of res.animationGroups ?? []) {
        const nombre = g.name.toLowerCase();
        if (nombre.includes('walk')) v.anims.walk = g;
        else if (nombre.includes('idle')) v.anims.idle = g;
        g.stop();
      }
      if (v.anims.walk) {
        v.anims.walk.speedRatio = Math.min(
          CADENCIA_MAX,
          v.def.speed / (ZANCADA_MODELO * v.def.look.height),
        );
      }
      primitivas.dispose();
      v.root.position.y = 0; // sin el bote de las primitivas
      v.animActual = undefined;
    } catch {
      // fallback: se queda el muñeco de primitivas
    }
  }

  // Alterna walk/idle según ande o esté parado (sin transiciones, como los NPC).
  private _animar(v: VillagerInstance, moviendo: boolean): void {
    const siguiente = moviendo ? 'walk' : 'idle';
    if (!v.anims || siguiente === v.animActual) return;
    const grupo = v.anims[siguiente];
    if (!grupo) return;
    if (v.animActual) v.anims[v.animActual]?.stop();
    grupo.start(true, grupo.speedRatio);
    v.animActual = siguiente;
  }

  update(dt: number, player: { x: number; z: number }): void {
    for (const v of this.villagers) {
      const { walker: w, def } = v;
      stepWalker(w, def.route, def.speed, def.pause, dt, player);
      v.root.position.x = w.x;
      v.root.position.z = w.z;
      v.root.rotation.y = w.heading;

      if (v.anims) {
        this._animar(v, w.moving);
        continue;
      }
      // Paso: la fase avanza con la distancia recorrida; parado, vuelve a reposo
      if (w.moving) v.phase += ((def.speed * dt) / ZANCADA) * Math.PI * 2;
      else v.phase *= Math.max(0, 1 - dt * 8);
      const a = w.moving ? Math.sin(v.phase) * BALANCEO : 0;
      v.limbs.legL.rotation.x = a;
      v.limbs.legR.rotation.x = -a;
      v.limbs.armL.rotation.x = -a * 0.8;
      v.limbs.armR.rotation.x = a * 0.8;
      // Un pequeño bote al andar
      v.root.position.y = w.moving ? Math.abs(Math.sin(v.phase)) * 0.04 : 0;
    }
  }

  getInteraction(pos: { x: number; z: number }): Interaction | null {
    let best: Interaction | null = null;
    for (const v of this.villagers) {
      const d = Math.hypot(pos.x - v.walker.x, pos.z - v.walker.z);
      if (d < CONFIG.interactionRadius && (!best || d < best.dist)) {
        best = { dist: d, label: `E: Saludar a ${v.def.name}`, action: () => this.greet(v) };
      }
    }
    return best;
  }

  private greet(v: VillagerInstance): void {
    const frase = v.def.greetings[v.saludo];
    v.saludo = (v.saludo + 1) % v.def.greetings.length;
    this.ui.notify(`💬 ${v.def.name}: «${frase}»`);
  }
}
