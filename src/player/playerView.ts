// PlayerView (vista Babylon): avatar del jugador con física (impostor de caja)
// y movimiento con WASD / flechas. Sin reglas de juego: solo traduce input a
// velocidad y reproduce las animaciones (caminar, reposo, regar). Mientras
// gira la manivela del pozo se queda quieto mirándolo.
import { CONFIG } from '../core/constants';
import type { WorldView } from '../world/worldView';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import type { AnimationGroup, Mesh, Node, Scene } from '@babylonjs/core';

export class PlayerView {
  scene: Scene;
  root: Mesh;
  visual: TransformNode;
  private _imp: PhysicsImpostor;
  private _vel: Vector3;
  private _primitives: Mesh[];
  private _anims: { walk?: AnimationGroup; idle?: AnimationGroup; water?: AnimationGroup } = {};
  private _animActual: string | null = null;
  // Regadera del GLB (emparentada a la mano en Blender): solo se ve al regar
  private _regadera: Node | null = null;
  private _spoutTip: TransformNode | null = null;
  private _agua: ParticleSystem | null = null;
  private _aguaPos = new Vector3(); // emisor del chorro
  private _riego = 0; // segundos que faltan de la animación de riego
  private _riegoTotal = 0;
  private _recarga = 0; // segundos que faltan de girar la manivela

  constructor(scene: Scene, world: WorldView) {
    this.scene = scene;

    // Raíz física: caja invisible que choca con el entorno
    const root = MeshBuilder.CreateBox(
      'playerRoot',
      { width: 0.7, height: 1.3, depth: 0.7 },
      scene,
    );
    root.position = new Vector3(0, 1.2, 12);
    root.isVisible = false;
    // friction: 0 a propósito. Cannon 0.6.2 limita la fuerza de fricción a
    // μ·m·g por contacto y la aplica como impulso por paso (sin escalar por
    // dt), así que cada uno de los ~4 contactos con el suelo resta una
    // cantidad fija de velocidad por eje en cada frame. Con fricción > 0 el
    // jugador se mueve mucho más lento de lo configurado, y en diagonal peor
    // aún (la resta es por eje: ~45% de la velocidad en recta). Como la
    // velocidad se reasigna entera cada frame en update(), no hace falta
    // fricción para frenar.
    this._imp = root.physicsImpostor = new PhysicsImpostor(
      root,
      PhysicsImpostor.BoxImpostor,
      { mass: 1, friction: 0, restitution: 0 },
      scene,
    );
    // Impide que el cuerpo gire por los choques (API del cuerpo de Cannon.js)
    this._imp.physicsBody.fixedRotation = true;
    this._imp.physicsBody.updateMassProperties();
    this.root = root;

    // Nodo visual (se rota manualmente; la raíz la controla la física)
    this.visual = new TransformNode('playerVisual', scene);
    this.visual.parent = root;
    this.visual.position.y = -0.65; // origen a los pies del personaje
    // Orientación inicial: mirando hacia -z (el camino y la granja quedan
    // al norte del spawn). Con 0 aparecería de espaldas al camino.
    this.visual.rotation.y = Math.PI;

    const mat = (r: number, g: number, b: number) => {
      const m = new StandardMaterial('pmat', scene);
      m.diffuseColor = new Color3(r, g, b);
      m.specularColor = Color3.Black();
      return m;
    };

    // Cuerpo
    const body = MeshBuilder.CreateCylinder('pbody', { height: 0.8, diameter: 0.5 }, scene);
    body.parent = this.visual;
    body.position.y = 0.4;
    body.material = mat(0.25, 0.45, 0.85);
    world.addShadow(body);

    // Cabeza
    const head = MeshBuilder.CreateSphere('phead', { diameter: 0.45 }, scene);
    head.parent = this.visual;
    head.position.y = 1.0;
    head.material = mat(0.95, 0.8, 0.65);
    world.addShadow(head);

    // Gorro de granjero
    const hat = MeshBuilder.CreateCylinder('phat', { height: 0.12, diameter: 0.55 }, scene);
    hat.parent = this.visual;
    hat.position.y = 1.22;
    hat.material = mat(0.75, 0.6, 0.3);
    world.addShadow(hat);

    this._primitives = [body, head, hat];
    this._vel = new Vector3(); // scratch reutilizado en update()

    // Si carga el modelo GLB del granjero, sustituye a las primitivas
    this._loadFarmer(world);
  }

  // Carga el modelo 3D del granjero (assets/granjero.glb, publicado en
  // /models/). Si falla (sin red, asset ausente, loaders no cargados) el
  // avatar se queda con las primitivas de siempre.
  private async _loadFarmer(world: WorldView): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/', 'granjero.glb', this.scene);
      const model = res.meshes[0];
      const nodos = [...res.meshes, ...(res.transformNodes ?? [])];
      this._regadera = nodos.find((n) => n.name === 'Regadera') ?? null;
      this._spoutTip = nodos.find((n) => n.name === 'spout_tip') ?? null;
      this._regadera?.setEnabled(false);
      // Se escala a la altura del avatar de primitivas (~1.3 m) y se apoya
      // en el suelo a partir de la caja envolvente real del modelo, así el
      // código no depende de las medidas de cada .glb. La regadera no cuenta.
      const { min, max } = model.getHierarchyBoundingVectors(
        true,
        (m) => !m.name.startsWith('Regadera'),
      );
      const escala = 1.3 / (max.y - min.y);
      model.parent = this.visual;
      model.scaling = new Vector3(escala, escala, escala);
      model.position.y = -min.y * escala;
      for (const m of res.meshes) {
        if (m.getTotalVertices() > 0) world.addShadow(m);
      }
      this._cargarAnimaciones(res.animationGroups ?? []);
      for (const p of this._primitives) p.dispose();
    } catch {
      // fallback: se quedan las primitivas
    }
  }

  // Recoge los grupos de animación del GLB (walk/idle, exportados desde
  // Blender como pistas NLA) y arranca el idle en bucle. Si el modelo no
  // trae animaciones, el avatar se mueve sin animar, como antes.
  private _cargarAnimaciones(grupos: AnimationGroup[]): void {
    for (const g of grupos) {
      const nombre = (g.name ?? '').toLowerCase();
      if (nombre.includes('walk')) this._anims.walk = g;
      else if (nombre.includes('idle')) this._anims.idle = g;
      else if (nombre.includes('water')) this._anims.water = g;
      g.stop();
    }
    if (this._anims.idle) {
      this._anims.idle.start(true);
      this._animActual = 'idle';
    }
  }

  // Alterna walk/idle según se mueva; sin transiciones (estilo cartoon).
  private _animar(moviendo: boolean): void {
    const siguiente = moviendo ? 'walk' : 'idle';
    if (siguiente === this._animActual) return;
    const grupo = this._anims[siguiente];
    if (!grupo) return;
    if (this._animActual) this._anims[this._animActual as 'walk' | 'idle' | 'water']?.stop();
    grupo.start(true);
    this._animActual = siguiente;
  }

  /** Mientras riega o llena la regadera, el granjero no se mueve ni interactúa. */
  get busy(): boolean {
    return this._riego > 0 || this._recarga > 0;
  }

  // Riega el surco en (x, z): se gira hacia él, saca la regadera y reproduce
  // `water` una vez. Sin el GLB (primitivas) solo cae el agua delante.
  playWater(target: { x: number; z: number }): void {
    const p = this.root.position;
    this.visual.rotation.y = Math.atan2(target.x - p.x, target.z - p.z);
    const imp = this._imp;
    imp.setLinearVelocity(new Vector3(0, imp.getLinearVelocity()?.y ?? 0, 0));

    const water = this._anims.water;
    // Duración real: el cargador glTF expresa los frames a sus propios fps
    const fps = water?.targetedAnimations[0]?.animation.framePerSecond ?? 60;
    this._riegoTotal = water ? (water.to - water.from) / fps : 0.9;
    this._riego = this._riegoTotal;
    if (!water) return;
    if (this._animActual) this._anims[this._animActual as 'walk' | 'idle' | 'water']?.stop();
    this._regadera?.setEnabled(true);
    water.start(false);
    this._animActual = 'water';
  }

  // Gira la manivela del pozo de (x, z): mirándolo y sin moverse durante
  // `segundos` (lo que tarda el cubo en bajar y subir, ver wellView).
  playRefill(well: { x: number; z: number }, segundos: number): void {
    const p = this.root.position;
    this.visual.rotation.y = Math.atan2(well.x - p.x, well.z - p.z);
    const imp = this._imp;
    imp.setLinearVelocity(new Vector3(0, imp.getLinearVelocity()?.y ?? 0, 0));
    this._recarga = segundos;
    this._animar(false);
  }

  // Chorro de agua: partículas pequeñas que caen desde la alcachofa
  private _crearAgua(): ParticleSystem {
    const tex = new DynamicTexture('gotaTex', 32, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();
    tex.hasAlpha = true;
    tex.update();
    const ps = new ParticleSystem('agua', 300, this.scene);
    ps.particleTexture = tex;
    ps.emitter = this._aguaPos;
    ps.minEmitBox = new Vector3(-0.02, 0, -0.02);
    ps.maxEmitBox = new Vector3(0.02, 0, 0.02);
    ps.color1 = new Color4(0.45, 0.7, 1, 1);
    ps.color2 = new Color4(0.7, 0.88, 1, 1);
    ps.colorDead = new Color4(0.6, 0.8, 1, 0);
    ps.minSize = 0.06;
    ps.maxSize = 0.1;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.4;
    ps.emitRate = 220;
    ps.gravity = new Vector3(0, -9, 0);
    ps.direction1 = new Vector3(-0.3, -0.5, -0.3);
    ps.direction2 = new Vector3(0.3, -0.2, 0.3);
    ps.minEmitPower = 0.4;
    ps.maxEmitPower = 0.8;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    return ps;
  }

  // Avanza el riego: agua en la parte central (la regadera inclinada) y, al
  // terminar, guarda la regadera y vuelve al reposo.
  private _actualizarRiego(dt: number): void {
    this._riego = Math.max(0, this._riego - dt);
    const t = 1 - this._riego / this._riegoTotal; // progreso 0..1
    const vertiendo = this._riego > 0 && t > 0.33 && t < 0.8;
    if (vertiendo) {
      this._agua ??= this._crearAgua();
      if (this._spoutTip) {
        this._aguaPos.copyFrom(this._spoutTip.getAbsolutePosition());
      } else {
        // Sin regadera: el agua cae delante del granjero, a media altura
        const r = this.visual.rotation.y;
        const p = this.root.position;
        this._aguaPos.copyFromFloats(p.x + Math.sin(r) * 0.5, p.y, p.z + Math.cos(r) * 0.5);
      }
      if (!this._agua.isStarted()) this._agua.start();
    } else if (this._agua?.isStarted()) {
      this._agua.stop();
    }
    if (this._riego === 0) {
      this._regadera?.setEnabled(false);
      this._anims.water?.stop();
      this._animActual = null;
    }
  }

  get position(): Vector3 {
    return this.root.position;
  }

  // Coloca al granjero quieto en (x, z) mirando a la cámara (al despertar).
  // La física copia la posición de la malla al cuerpo en el siguiente paso.
  teleport(x: number, z: number): void {
    this.root.position.set(x, 1.2, z);
    this._imp.setLinearVelocity(Vector3.Zero());
    this.visual.rotation.y = 0;
  }

  // La cámara es fija (mira hacia -z desde +z), así que el input se mapea
  // directo al mundo: W/arriba = -z (alejarse, arriba en pantalla),
  // D/derecha = -x (derecha en pantalla).
  update(dt: number, keys: Record<string, boolean>, canMove: boolean): void {
    if (this._riego > 0) this._actualizarRiego(dt);
    if (this._recarga > 0) this._recarga = Math.max(0, this._recarga - dt);
    if (this.busy) canMove = false;
    let ix = 0;
    let iz = 0;
    if (canMove) {
      if (keys['w'] || keys['arrowup']) iz -= 1;
      if (keys['s'] || keys['arrowdown']) iz += 1;
      if (keys['a'] || keys['arrowleft']) ix += 1;
      if (keys['d'] || keys['arrowright']) ix -= 1;
    }
    if (ix !== 0 && iz !== 0) {
      ix *= Math.SQRT1_2;
      iz *= Math.SQRT1_2;
    }
    const dx = ix;
    const dz = iz;

    const imp = this._imp;
    const vy = imp.getLinearVelocity()?.y ?? 0;
    this._vel.copyFromFloats(dx * CONFIG.playerSpeed, vy, dz * CONFIG.playerSpeed);
    imp.setLinearVelocity(this._vel);

    if (dx !== 0 || dz !== 0) {
      this.visual.rotation.y = Math.atan2(dx, dz);
    }
    if (!this.busy) this._animar(dx !== 0 || dz !== 0);

    // Red de seguridad: si algo raro lo lanza fuera del mundo, reaparece
    if (this.root.position.y < -2) {
      imp.setDeltaPosition(new Vector3(0, 1.2, 12));
      imp.setLinearVelocity(Vector3.Zero());
    }
  }
}
