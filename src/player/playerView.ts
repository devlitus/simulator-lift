// PlayerView (vista Babylon): avatar del jugador con física (impostor de caja)
// y movimiento WASD. Sin reglas de juego: solo traduce input a velocidad.
import { CONFIG } from '../core/constants';
import type { WorldView } from '../world/worldView';

export class PlayerView {
  scene: any;
  root: any;
  visual: any;
  private _vel: any;

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

    this._vel = new BABYLON.Vector3(); // scratch reutilizado en update()
  }

  get position(): any {
    return this.root.position;
  }

  update(dt: number, keys: Record<string, boolean>, canMove: boolean): void {
    let dx = 0;
    let dz = 0;
    if (canMove) {
      if (keys['w'] || keys['arrowup']) dz -= 1;
      if (keys['s'] || keys['arrowdown']) dz += 1;
      if (keys['a'] || keys['arrowleft']) dx += 1;
      if (keys['d'] || keys['arrowright']) dx -= 1;
    }
    if (dx !== 0 && dz !== 0) {
      dx *= Math.SQRT1_2;
      dz *= Math.SQRT1_2;
    }

    const imp = this.root.physicsImpostor;
    const v = imp.getLinearVelocity();
    this._vel.copyFromFloats(dx * CONFIG.playerSpeed, v.y, dz * CONFIG.playerSpeed);
    imp.setLinearVelocity(this._vel);

    if (dx !== 0 || dz !== 0) {
      this.visual.rotation.y = Math.atan2(dx, dz);
    }

    // Red de seguridad: si algo raro lo lanza fuera del mundo, reaparece
    if (this.root.position.y < -2) {
      imp.setDeltaPosition(new BABYLON.Vector3(0, 1.2, 12));
      imp.setLinearVelocity(BABYLON.Vector3.Zero());
    }
  }
}
