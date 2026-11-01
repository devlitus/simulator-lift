// PlayerView (vista Babylon): avatar del jugador con física (impostor de caja)
// y movimiento con WASD / flechas. Sin reglas de juego: solo traduce input a
// velocidad y reproduce las animaciones (caminar, reposo, regar).
import { CONFIG } from '../core/constants';
import type { WorldView } from '../world/worldView';

export class PlayerView {
  scene: any;
  root: any;
  visual: any;
  private _vel: any;
  private _primitives: any[];
  private _anims: { walk?: any; idle?: any; water?: any } = {};
  private _animActual: string | null = null;
  // Regadera del GLB (emparentada a la mano en Blender): solo se ve al regar
  private _regadera: any = null;
  private _spoutTip: any = null;
  private _agua: any = null;
  private _riego = 0; // segundos que faltan de la animación de riego
  private _riegoTotal = 0;

  constructor(scene: any, world: WorldView) {
    this.scene = scene;

    // Raíz física: caja invisible que choca con el entorno
    const root = BABYLON.MeshBuilder.CreateBox(
      'playerRoot',
      { width: 0.7, height: 1.3, depth: 0.7 },
      scene,
    );
    root.position = new BABYLON.Vector3(0, 1.2, 12);
    root.isVisible = false;
    // friction: 0 a propósito. Cannon 0.6.2 limita la fuerza de fricción a
    // μ·m·g por contacto y la aplica como impulso por paso (sin escalar por
    // dt), así que cada uno de los ~4 contactos con el suelo resta una
    // cantidad fija de velocidad por eje en cada frame. Con fricción > 0 el
    // jugador se mueve mucho más lento de lo configurado, y en diagonal peor
    // aún (la resta es por eje: ~45% de la velocidad en recta). Como la
    // velocidad se reasigna entera cada frame en update(), no hace falta
    // fricción para frenar.
    root.physicsImpostor = new BABYLON.PhysicsImpostor(
      root,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 1, friction: 0, restitution: 0 },
      scene,
    );
    // Impide que el cuerpo gire por los choques (API del cuerpo de Cannon.js)
    root.physicsImpostor.physicsBody.fixedRotation = true;
    root.physicsImpostor.physicsBody.updateMassProperties();
    this.root = root;

    // Nodo visual (se rota manualmente; la raíz la controla la física)
    this.visual = new BABYLON.TransformNode('playerVisual', scene);
    this.visual.parent = root;
    this.visual.position.y = -0.65; // origen a los pies del personaje
    // Orientación inicial: mirando hacia -z (el camino y la granja quedan
    // al norte del spawn). Con 0 aparecería de espaldas al camino.
    this.visual.rotation.y = Math.PI;

    const mat = (r: number, g: number, b: number) => {
      const m = new BABYLON.StandardMaterial('pmat', scene);
      m.diffuseColor = new BABYLON.Color3(r, g, b);
      m.specularColor = BABYLON.Color3.Black();
      return m;
    };

    // Cuerpo
    const body = BABYLON.MeshBuilder.CreateCylinder('pbody', { height: 0.8, diameter: 0.5 }, scene);
    body.parent = this.visual;
    body.position.y = 0.4;
    body.material = mat(0.25, 0.45, 0.85);
    world.addShadow(body);

    // Cabeza
    const head = BABYLON.MeshBuilder.CreateSphere('phead', { diameter: 0.45 }, scene);
    head.parent = this.visual;
    head.position.y = 1.0;
    head.material = mat(0.95, 0.8, 0.65);
    world.addShadow(head);

    // Gorro de granjero
    const hat = BABYLON.MeshBuilder.CreateCylinder('phat', { height: 0.12, diameter: 0.55 }, scene);
    hat.parent = this.visual;
    hat.position.y = 1.22;
    hat.material = mat(0.75, 0.6, 0.3);
    world.addShadow(hat);

    this._primitives = [body, head, hat];
    this._vel = new BABYLON.Vector3(); // scratch reutilizado en update()

    // Si carga el modelo GLB del granjero, sustituye a las primitivas
    this._loadFarmer(world);
  }

  // Carga el modelo 3D del granjero (assets/granjero.glb, publicado en
  // /models/). Si falla (sin red, asset ausente, loaders no cargados) el
  // avatar se queda con las primitivas de siempre.
  private async _loadFarmer(world: WorldView): Promise<void> {
    try {
      const res = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        'granjero.glb',
        this.scene,
      );
      const model = res.meshes[0];
      const nodos = [...res.meshes, ...(res.transformNodes ?? [])];
      this._regadera = nodos.find((n: any) => n.name === 'Regadera') ?? null;
      this._spoutTip = nodos.find((n: any) => n.name === 'spout_tip') ?? null;
      this._regadera?.setEnabled(false);
      // Se escala a la altura del avatar de primitivas (~1.3 m) y se apoya
      // en el suelo a partir de la caja envolvente real del modelo, así el
      // código no depende de las medidas de cada .glb. La regadera no cuenta.
      const { min, max } = model.getHierarchyBoundingVectors(
        true,
        (m: any) => !m.name.startsWith('Regadera'),
      );
      const escala = 1.3 / (max.y - min.y);
      model.parent = this.visual;
      model.scaling = new BABYLON.Vector3(escala, escala, escala);
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
  private _cargarAnimaciones(grupos: any[]): void {
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

  /** Mientras riega, el granjero no se mueve ni interactúa. */
  get busy(): boolean {
    return this._riego > 0;
  }

  // Riega el surco en (x, z): se gira hacia él, saca la regadera y reproduce
  // `water` una vez. Sin el GLB (primitivas) solo cae el agua delante.
  playWater(target: { x: number; z: number }): void {
    const p = this.root.position;
    this.visual.rotation.y = Math.atan2(target.x - p.x, target.z - p.z);
    const imp = this.root.physicsImpostor;
    imp.setLinearVelocity(new BABYLON.Vector3(0, imp.getLinearVelocity().y, 0));

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

  // Chorro de agua: partículas pequeñas que caen desde la alcachofa
  private _crearAgua(): any {
    const tex = new BABYLON.DynamicTexture('gotaTex', 32, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();
    tex.hasAlpha = true;
    tex.update();
    const ps = new BABYLON.ParticleSystem('agua', 300, this.scene);
    ps.particleTexture = tex;
    ps.emitter = new BABYLON.Vector3();
    ps.minEmitBox = new BABYLON.Vector3(-0.02, 0, -0.02);
    ps.maxEmitBox = new BABYLON.Vector3(0.02, 0, 0.02);
    ps.color1 = new BABYLON.Color4(0.45, 0.7, 1, 1);
    ps.color2 = new BABYLON.Color4(0.7, 0.88, 1, 1);
    ps.colorDead = new BABYLON.Color4(0.6, 0.8, 1, 0);
    ps.minSize = 0.06;
    ps.maxSize = 0.1;
    ps.minLifeTime = 0.25;
    ps.maxLifeTime = 0.4;
    ps.emitRate = 220;
    ps.gravity = new BABYLON.Vector3(0, -9, 0);
    ps.direction1 = new BABYLON.Vector3(-0.3, -0.5, -0.3);
    ps.direction2 = new BABYLON.Vector3(0.3, -0.2, 0.3);
    ps.minEmitPower = 0.4;
    ps.maxEmitPower = 0.8;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
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
        this._agua.emitter.copyFrom(this._spoutTip.getAbsolutePosition());
      } else {
        // Sin regadera: el agua cae delante del granjero, a media altura
        const r = this.visual.rotation.y;
        const p = this.root.position;
        this._agua.emitter.copyFromFloats(p.x + Math.sin(r) * 0.5, p.y, p.z + Math.cos(r) * 0.5);
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

  get position(): any {
    return this.root.position;
  }

  // La cámara es fija (mira hacia -z desde +z), así que el input se mapea
  // directo al mundo: W/arriba = -z (alejarse, arriba en pantalla),
  // D/derecha = -x (derecha en pantalla).
  update(dt: number, keys: Record<string, boolean>, canMove: boolean): void {
    if (this.busy) {
      this._actualizarRiego(dt);
      canMove = false;
    }
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

    const imp = this.root.physicsImpostor;
    const v = imp.getLinearVelocity();
    this._vel.copyFromFloats(dx * CONFIG.playerSpeed, v.y, dz * CONFIG.playerSpeed);
    imp.setLinearVelocity(this._vel);

    if (dx !== 0 || dz !== 0) {
      this.visual.rotation.y = Math.atan2(dx, dz);
    }
    if (!this.busy) this._animar(dx !== 0 || dz !== 0);

    // Red de seguridad: si algo raro lo lanza fuera del mundo, reaparece
    if (this.root.position.y < -2) {
      imp.setDeltaPosition(new BABYLON.Vector3(0, 1.2, 12));
      imp.setLinearVelocity(BABYLON.Vector3.Zero());
    }
  }
}
