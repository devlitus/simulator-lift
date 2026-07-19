// WorldView (vista Babylon): terreno, edificios, decoración, colisiones
// estáticas, luces y ciclo día/noche. No contiene reglas de juego; solo
// mide el paso del tiempo y emite DAY_NEW cuando empieza un día nuevo.
// Babylon entra como UMD sin tipos (global `BABYLON`, ver src/global.d.ts),
// así que sus objetos se tipan como `any` en todas las vistas.
import { CONFIG } from '../core/constants';
import { EVENTS, EventBus } from '../core/events';

export class WorldView {
  scene: any;
  bus: EventBus;
  time: number;
  hemi: any;
  sun: any;
  shadow: any;
  sellBin: { x: number; z: number };

  constructor(scene: any, bus: EventBus, { shadows = true }: { shadows?: boolean } = {}) {
    this.scene = scene;
    this.bus = bus;
    this.time = 0.08; // fracción del día transcurrida (0 = 06:00). Empieza ~08:00.

    scene.clearColor = new BABYLON.Color4(0.55, 0.78, 0.95, 1);

    // Luz ambiental + sol direccional (con sombras)
    this.hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    this.hemi.intensity = 0.7;
    this.sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.4, -1, -0.35), scene);
    this.sun.position = new BABYLON.Vector3(25, 40, 15);
    this.sun.intensity = 1.0;

    // PCF filtra en el shader al muestrear: evita los pases de desenfoque por
    // frame del mapa exponencial, que dominaban el coste de GPU a 2048px.
    this.shadow = null;
    if (shadows) {
      this.shadow = new BABYLON.ShadowGenerator(1024, this.sun);
      this.shadow.usePercentageCloserFiltering = true;
    }

    this.buildGround();
    this.buildBounds();
    this.buildPaths();
    this.buildBuildings();
    this.buildTrees();
    this.buildDecor();

    // Posición de la caja de ventas (main.ts la usa como interactuable)
    this.sellBin = { x: 6, z: 5 };
  }

  addShadow(mesh: any): void {
    if (this.shadow) this.shadow.getShadowMap().renderList.push(mesh);
  }

  mat(r: number, g: number, b: number): any {
    const m = new BABYLON.StandardMaterial('mat', this.scene);
    m.diffuseColor = new BABYLON.Color3(r, g, b);
    m.specularColor = BABYLON.Color3.Black();
    return m;
  }

  buildGround(): void {
    const s = CONFIG.groundSize;
    const ground = BABYLON.MeshBuilder.CreateBox(
      'ground',
      { width: s, height: 1, depth: s },
      this.scene,
    );
    ground.position.y = -0.5;
    ground.material = this.mat(0.36, 0.62, 0.3);
    ground.receiveShadows = true;
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
      ground,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0, friction: 0.8, restitution: 0 },
      this.scene,
    );
  }

  // Muros invisibles en los bordes para que el jugador no se salga del mapa
  buildBounds(): void {
    const half = CONFIG.groundSize / 2;
    const defs = [
      { x: 0, z: half + 0.5, w: CONFIG.groundSize + 2, d: 1 },
      { x: 0, z: -half - 0.5, w: CONFIG.groundSize + 2, d: 1 },
      { x: half + 0.5, z: 0, w: 1, d: CONFIG.groundSize + 2 },
      { x: -half - 0.5, z: 0, w: 1, d: CONFIG.groundSize + 2 },
    ];
    for (const b of defs) {
      const wall = BABYLON.MeshBuilder.CreateBox(
        'wall',
        { width: b.w, height: 4, depth: b.d },
        this.scene,
      );
      wall.position.set(b.x, 2, b.z);
      wall.isVisible = false;
      wall.physicsImpostor = new BABYLON.PhysicsImpostor(
        wall,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0 },
        this.scene,
      );
    }
  }

  // Caminos de tierra decorativos
  buildPaths(): void {
    const sand = this.mat(0.78, 0.7, 0.52);
    const p1 = BABYLON.MeshBuilder.CreateBox(
      'path1',
      { width: 2.2, height: 0.04, depth: 40 },
      this.scene,
    );
    p1.position.set(0, 0.02, -8);
    p1.material = sand;
    p1.receiveShadows = true;
    const p2 = BABYLON.MeshBuilder.CreateBox(
      'path2',
      { width: 30, height: 0.04, depth: 2.2 },
      this.scene,
    );
    p2.position.set(-1, 0.02, -4);
    p2.material = sand;
    p2.receiveShadows = true;
  }

  // Casa simple: base de caja + tejado piramidal (cilindro de 4 caras) + puerta
  buildHouse(x: number, z: number, color: any): any {
    const base = BABYLON.MeshBuilder.CreateBox(
      'house',
      { width: 4.4, height: 3, depth: 4.4 },
      this.scene,
    );
    base.position.set(x, 1.5, z);
    base.material = color;
    base.receiveShadows = true;
    base.physicsImpostor = new BABYLON.PhysicsImpostor(
      base,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );
    this.addShadow(base);

    const roof = BABYLON.MeshBuilder.CreateCylinder(
      'roof',
      {
        diameterTop: 0,
        diameterBottom: 6.2,
        height: 2.2,
        tessellation: 4,
      },
      this.scene,
    );
    roof.position.set(x, 4.1, z);
    roof.rotation.y = Math.PI / 4;
    roof.material = this.mat(0.55, 0.22, 0.18);
    this.addShadow(roof);

    const door = BABYLON.MeshBuilder.CreateBox(
      'door',
      { width: 1, height: 1.8, depth: 0.15 },
      this.scene,
    );
    door.position.set(x, 0.9, z + 2.25);
    door.material = this.mat(0.35, 0.22, 0.1);
    return base;
  }

  buildBuildings(): void {
    this.buildHouse(12, -8, this.mat(0.85, 0.55, 0.65)); // Tienda de Marta (rosa)
    this.buildHouse(-14, -10, this.mat(0.55, 0.56, 0.6)); // Forja de Gon (gris)
    this.buildHouse(4, -18, this.mat(0.5, 0.72, 0.5)); // Casa de Lila (verde)

    // Escaparate de la tienda (mostrador)
    const counter = BABYLON.MeshBuilder.CreateBox(
      'counter',
      { width: 2.6, height: 1, depth: 1 },
      this.scene,
    );
    counter.position.set(11, 0.5, -5);
    counter.material = this.mat(0.55, 0.35, 0.18);
    counter.physicsImpostor = new BABYLON.PhysicsImpostor(
      counter,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );
    this.addShadow(counter);
  }

  buildTree(x: number, z: number): void {
    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      'trunk',
      { height: 1.6, diameter: 0.4 },
      this.scene,
    );
    trunk.position.set(x, 0.8, z);
    trunk.material = this.mat(0.4, 0.26, 0.13);
    trunk.physicsImpostor = new BABYLON.PhysicsImpostor(
      trunk,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );
    this.addShadow(trunk);

    const leafMat = this.mat(0.16, 0.45, 0.18);
    const l1 = BABYLON.MeshBuilder.CreateSphere('leaf1', { diameter: 2.2 }, this.scene);
    l1.position.set(x, 2.4, z);
    l1.material = leafMat;
    this.addShadow(l1);
    const l2 = BABYLON.MeshBuilder.CreateSphere('leaf2', { diameter: 1.4 }, this.scene);
    l2.position.set(x, 3.3, z);
    l2.material = leafMat;
    this.addShadow(l2);
  }

  buildTrees(): void {
    const spots = [
      [8, 11],
      [-10, 9],
      [17, 5],
      [-20, 3],
      [7, -11],
      [-7, -14],
      [21, -12],
      [-18, 12],
      [14, 14],
      [-16, -16],
    ];
    for (const [x, z] of spots) this.buildTree(x, z);
  }

  buildDecor(): void {
    // Pozo decorativo en la plaza
    const well = BABYLON.MeshBuilder.CreateCylinder(
      'well',
      { height: 1, diameter: 1.6 },
      this.scene,
    );
    well.position.set(-3, 0.5, -4);
    well.material = this.mat(0.55, 0.55, 0.58);
    well.physicsImpostor = new BABYLON.PhysicsImpostor(
      well,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );
    this.addShadow(well);

    // Caja de ventas junto a la granja
    const bin = BABYLON.MeshBuilder.CreateBox(
      'sellBin',
      { width: 1.4, height: 1, depth: 1.4 },
      this.scene,
    );
    bin.position.set(6, 0.5, 5);
    bin.material = this.mat(0.6, 0.4, 0.2);
    bin.physicsImpostor = new BABYLON.PhysicsImpostor(
      bin,
      BABYLON.PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );
    this.addShadow(bin);
    const lid = BABYLON.MeshBuilder.CreateBox(
      'sellBinLid',
      { width: 1.5, height: 0.12, depth: 1.5 },
      this.scene,
    );
    lid.position.set(6, 1.06, 5);
    lid.material = this.mat(0.45, 0.3, 0.14);

    // Jardín de flores de Lila (decorativo)
    const flowerColors = [
      this.mat(0.9, 0.3, 0.4),
      this.mat(0.95, 0.85, 0.3),
      this.mat(0.7, 0.4, 0.9),
    ];
    for (let i = 0; i < 6; i++) {
      const fx = -3 + (i % 3) * 1.2;
      const fz = -13 - Math.floor(i / 3) * 1.2;
      const stem = BABYLON.MeshBuilder.CreateCylinder(
        'fstem',
        { height: 0.5, diameter: 0.06 },
        this.scene,
      );
      stem.position.set(fx, 0.25, fz);
      stem.material = this.mat(0.2, 0.55, 0.2);
      const head = BABYLON.MeshBuilder.CreateSphere('fhead', { diameter: 0.28 }, this.scene);
      head.position.set(fx, 0.55, fz);
      head.material = flowerColors[i % 3];
    }
  }

  // ---------- Ciclo día/noche ----------

  getHour(): number {
    return (6 + this.time * 24) % 24; // el día empieza a las 06:00
  }

  getTimeString(): string {
    const h = Math.floor(this.getHour());
    return `${String(h).padStart(2, '0')}:00`;
  }

  update(dt: number, day: number): void {
    this.time += dt / CONFIG.dayLengthSeconds;
    if (this.time >= 1) {
      this.time -= 1;
      this.bus.emit(EVENTS.DAY_NEW, { day: day + 1 });
    }

    const h = this.getHour();
    // Factor de luz diurna: 0 de noche, 1 al mediodía
    let f = 0;
    if (h > 6 && h < 20) f = Math.sin(((h - 6) / 14) * Math.PI);

    this.sun.intensity = 0.1 + f * 1.0;
    this.hemi.intensity = 0.16 + f * 0.55;

    // El sol recorre el cielo de este a oeste durante el día
    if (f > 0.01) {
      const ang = ((h - 6) / 14) * Math.PI;
      const dy = Math.max(Math.sin(ang), 0.2);
      this.sun.direction.copyFromFloats(-Math.cos(ang), -dy, -0.35);
      this.sun.position.copyFromFloats(Math.cos(ang) * 40, dy * 40, 14);
    }

    // Color del cielo: azul noche ↔ azul día
    this.scene.clearColor.copyFromFloats(
      0.05 + (0.55 - 0.05) * f,
      0.07 + (0.78 - 0.07) * f,
      0.16 + (0.95 - 0.16) * f,
      1,
    );
  }
}
