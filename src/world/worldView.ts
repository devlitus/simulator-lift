// WorldView (vista Babylon): terreno, edificios, decoración, colisiones
// estáticas, luces y ciclo día/noche. No contiene reglas de juego; solo
// mide el paso del tiempo y emite DAY_NEW cuando empieza un día nuevo.
import { CONFIG } from '../core/constants';
import { EVENTS, EventBus } from '../core/events';
import type { PenConfig } from '../../data/schemas';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import { Scene } from '@babylonjs/core/scene';
import type { ISceneLoaderAsyncResult, Node } from '@babylonjs/core';
import { FARMER_HOUSE, PORCH_BARRIERS } from './farmerPorch';
import {
  ENTRANCE_PATH,
  FARM_ENTRANCE,
  FARM_ENTRANCE_SOLIDS,
  FARM_FENCE,
  SALES_POINT,
  SALES_STAND,
  STREET_END_Z,
  WELL,
} from './farmLayout';
import { STORAGE, STORAGE_WALLS } from './warehouse';
import { WellView } from './wellView';

interface PathTile {
  x: number;
  z: number;
  width: number;
  depth: number;
  variant: number;
}

// Árboles del pueblo; SceneryView no siembra decoración encima de ellos.
export const TREE_SPOTS: number[][] = [
  [-6, 5],
  [-10, 9],
  [-13, 6],
  [-20, 3],
  [7, -11],
  [-7, -14],
  [21, -12],
  [-18, 12],
  [-4, 13],
  [-16, -16],
];

export class WorldView {
  scene: Scene;
  bus: EventBus;
  time: number;
  hemi: HemisphericLight;
  sun: DirectionalLight;
  shadow: ShadowGenerator | null;
  ground!: Mesh; // superficie física; SceneryView la oculta al cargar las colinas
  pens: Record<string, PenConfig>;
  sellBin: { x: number; z: number };
  well: { x: number; z: number };
  wellCrank: { x: number; z: number }; // donde se pone el granjero para girar la manivela
  wellView: WellView | null = null; // animación del cubo (si carga el GLB)
  private nightGlow: { mat: PBRMaterial; r: number; g: number; b: number }[] = []; // de noche
  indoors = false; // el granjero está en un interior: su casa o el almacén
  daylight = 1; // luz diurna fuera: 0 de noche, 1 al mediodía

  constructor(
    scene: Scene,
    bus: EventBus,
    { shadows = true, pens }: { shadows?: boolean; pens: Record<string, PenConfig> },
  ) {
    this.scene = scene;
    this.bus = bus;
    this.pens = pens;
    this.time = 0.08; // fracción del día transcurrida (0 = 06:00). Empieza ~08:00.

    scene.clearColor = new Color4(0.55, 0.78, 0.95, 1);
    // Niebla del color del cielo: funde las colinas del horizonte con él.
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = 55;
    scene.fogEnd = 150;
    scene.fogColor = new Color3(0.55, 0.78, 0.95);

    // Luz ambiental + sol direccional (con sombras)
    this.hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
    this.hemi.intensity = 0.7;
    this.sun = new DirectionalLight('sun', new Vector3(-0.4, -1, -0.35), scene);
    this.sun.position = new Vector3(25, 40, 15);
    this.sun.intensity = 1.0;

    // PCF filtra en el shader al muestrear: evita los pases de desenfoque por
    // frame del mapa exponencial, que dominaban el coste de GPU a 2048px.
    this.shadow = null;
    if (shadows) {
      this.shadow = new ShadowGenerator(1024, this.sun);
      this.shadow.usePercentageCloserFiltering = true;
    }

    // Punto de venta: delante del mostrador del puesto (main.ts lo usa como
    // interactuable).
    this.sellBin = SALES_POINT;
    this.well = WELL;
    // La manivela sale por el lado -x del pozo (a la derecha en pantalla):
    // pozo.glb la tiene en +x de Blender y la conversión de ejes la refleja.
    this.wellCrank = { x: this.well.x - 1.35, z: this.well.z };

    this.buildGround();
    this.buildBounds();
    this.buildPaths();
    this.buildBuildings();
    this.buildTrees();
    this.buildDecor();
    this.buildPens();
    this.buildFarmFence();
    this.buildFarmEntrance();
  }

  addShadow(mesh: AbstractMesh): void {
    this.shadow?.getShadowMap()?.renderList?.push(mesh);
  }

  mat(r: number, g: number, b: number): StandardMaterial {
    const m = new StandardMaterial('mat', this.scene);
    m.diffuseColor = new Color3(r, g, b);
    m.specularColor = Color3.Black();
    return m;
  }

  buildGround(): void {
    const s = CONFIG.groundSize;
    const ground = MeshBuilder.CreateBox('ground', { width: s, height: 1, depth: s }, this.scene);
    ground.position.y = -0.5;
    // Césped pintado (ComfyUI, ver assets/escenario/) repetido cada 5 m y
    // teñido por un mapa de variación que cubre todo el terreno una vez, para
    // que no se note la repetición. Sin las texturas queda el verde liso.
    const mat = this.mat(0.36, 0.62, 0.3);
    const grass = new Texture('/textures/cesped.jpg', this.scene);
    grass.uScale = grass.vScale = s / 5;
    mat.diffuseTexture = grass;
    mat.diffuseColor = new Color3(0.86, 0.9, 0.84);
    mat.ambientTexture = new Texture('/textures/variacion_suelo.jpg', this.scene);
    ground.material = mat;
    ground.receiveShadows = true;
    this.ground = ground;
    ground.physicsImpostor = new PhysicsImpostor(
      ground,
      PhysicsImpostor.BoxImpostor,
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
      const wall = MeshBuilder.CreateBox('wall', { width: b.w, height: 4, depth: b.d }, this.scene);
      wall.position.set(b.x, 2, b.z);
      wall.isVisible = false;
      wall.physicsImpostor = new PhysicsImpostor(
        wall,
        PhysicsImpostor.BoxImpostor,
        { mass: 0 },
        this.scene,
      );
    }
  }

  // Tierra entre las baldosas; el terreno sigue siendo la superficie física.
  buildPaths(): void {
    const sand = this.mat(0.78, 0.7, 0.52);
    const p1 = MeshBuilder.CreateBox(
      'path1',
      { width: 2.2, height: 0.04, depth: STREET_END_Z + 28 },
      this.scene,
    );
    p1.position.set(0, 0.02, (STREET_END_Z - 28) / 2);
    p1.material = sand;
    p1.receiveShadows = true;
    const p2 = MeshBuilder.CreateBox('path2', { width: 30, height: 0.04, depth: 2.2 }, this.scene);
    p2.position.set(-1, 0.02, -4);
    p2.material = sand;
    p2.receiveShadows = true;
    const { minX, maxX, minZ, maxZ } = ENTRANCE_PATH;
    const p3 = MeshBuilder.CreateBox(
      'path3',
      { width: maxX - minX, height: 0.04, depth: maxZ - minZ },
      this.scene,
    );
    p3.position.set((minX + maxX) / 2, 0.02, (minZ + maxZ) / 2);
    p3.material = sand;
    p3.receiveShadows = true;

    // Una rejilla compartida une ambas franjas sin solapar piedras en el
    // cruce. Las piezas de los extremos se recortan a los límites del camino.
    const step = 1.1;
    const zOrigin = -5.1;
    const tiles = new Map<string, PathTile>();
    const paths = [
      { minX: -1.1, maxX: 1.1, minZ: -28, maxZ: STREET_END_Z },
      { minX: -16, maxX: 14, minZ: -5.1, maxZ: -2.9 },
      ENTRANCE_PATH,
    ];
    for (const path of paths) {
      const minCol = Math.floor(path.minX / step);
      const maxCol = Math.ceil(path.maxX / step) - 1;
      const minRow = Math.floor((path.minZ - zOrigin) / step);
      const maxRow = Math.ceil((path.maxZ - zOrigin) / step) - 1;
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const minX = Math.max(path.minX, col * step);
          const maxX = Math.min(path.maxX, (col + 1) * step);
          const minZ = Math.max(path.minZ, zOrigin + row * step);
          const maxZ = Math.min(path.maxZ, zOrigin + (row + 1) * step);
          const width = maxX - minX - 0.12;
          const depth = maxZ - minZ - 0.12;
          if (width <= 0 || depth <= 0) continue;
          tiles.set(`${col}_${row}`, {
            x: (minX + maxX) / 2,
            z: (minZ + maxZ) / 2,
            width,
            depth,
            variant: (((col * 7 + row * 11) % 3) + 3) % 3,
          });
        }
      }
    }

    const stone = this.mat(0.69, 0.59, 0.43);
    const prims = [...tiles.values()].map((tile, i) => {
      const mesh = MeshBuilder.CreateBox(
        `pathTileFallback_${i}`,
        { width: tile.width, height: 0.035, depth: tile.depth },
        this.scene,
      );
      mesh.position.set(tile.x, 0.0575, tile.z);
      mesh.material = stone;
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      return mesh;
    });
    void this._loadPathTiles([...tiles.values()], prims);
  }

  private async _loadPathTiles(tiles: PathTile[], prims: Mesh[]): Promise<void> {
    const imports: ISceneLoaderAsyncResult[] = [];
    const roots: TransformNode[] = [];
    try {
      // Solo tres importaciones; cada baldosa comparte la geometría y el
      // material de su variante mediante instancias de Babylon.
      for (let i = 1; i <= 3; i++) {
        const res = await SceneLoader.ImportMeshAsync(
          '',
          '/models/',
          `baldosa_camino_0${i}.glb`,
          this.scene,
        );
        imports.push(res);
        const template = res.meshes[0];
        if (!template || !res.meshes.some((mesh) => mesh.getTotalVertices() > 0)) {
          throw new Error('Baldosa sin malla');
        }
        const { min, max } = template.getHierarchyBoundingVectors(true);
        const spans = [max.x - min.x, max.y - min.y, max.z - min.z];
        if (spans.some((span) => !Number.isFinite(span) || span <= 0)) {
          throw new Error('Baldosa sin dimensiones válidas');
        }
        // Las instancias se dibujan con la configuración de su malla fuente.
        for (const mesh of res.meshes) {
          mesh.receiveShadows = true;
          mesh.isPickable = false;
        }
        template.setEnabled(false);
        for (let j = 0; j < tiles.length; j++) {
          const tile = tiles[j];
          if (tile.variant !== i - 1) continue;
          const sx = tile.width / spans[0];
          const sy = 0.035 / spans[1];
          const sz = tile.depth / spans[2];
          const root = new TransformNode(`pathTile_${j}`, this.scene);
          roots.push(root);
          root.scaling.set(sx, sy, sz);
          root.position.set(
            tile.x - ((min.x + max.x) / 2) * sx,
            0.04 - min.y * sy,
            tile.z - ((min.z + max.z) / 2) * sz,
          );
          template.instantiateHierarchy(
            root,
            { doNotInstantiate: false },
            (_source: Node, clone: Node) => {
              clone.setEnabled(true);
              if (!(clone instanceof AbstractMesh)) return;
              clone.receiveShadows = true;
              clone.isPickable = false;
            },
          );
          root.setEnabled(false);
        }
      }
      for (const root of roots) root.setEnabled(true);
      for (const prim of prims) prim.dispose();
    } catch {
      for (const root of roots) root.dispose();
      for (const res of imports) {
        for (const mesh of res.meshes) mesh.dispose(false, true);
      }
      // Fallback: baldosas de cajas sobre los caminos de tierra actuales.
    }
  }

  // Forja de Gon: la colisión permanece aunque el GLB aún no haya cargado.
  // La casa gris original sirve de respaldo si falla la importación.
  buildGonHouse(): void {
    const x = -14;
    const z = -10;
    const hit = MeshBuilder.CreateBox(
      'gonHouseHit',
      { width: 4.4, height: 4.8, depth: 4.4 },
      this.scene,
    );
    hit.position.set(x, 2.4, z);
    hit.isVisible = false;
    hit.physicsImpostor = new PhysicsImpostor(
      hit,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );

    const root = new TransformNode('gonHouseRoot', this.scene);
    root.position.set(x, 0, z);
    const base = MeshBuilder.CreateBox(
      'gonHouseBase',
      { width: 4.4, height: 3, depth: 4.4 },
      this.scene,
    );
    base.parent = root;
    base.position.y = 1.5;
    base.material = this.mat(0.55, 0.56, 0.6);
    base.receiveShadows = true;
    this.addShadow(base);

    const roof = MeshBuilder.CreateCylinder(
      'gonHouseRoof',
      {
        diameterTop: 0,
        diameterBottom: 6.2,
        height: 2.2,
        tessellation: 4,
      },
      this.scene,
    );
    roof.parent = root;
    roof.position.y = 4.1;
    roof.rotation.y = Math.PI / 4;
    roof.material = this.mat(0.55, 0.22, 0.18);
    this.addShadow(roof);

    const door = MeshBuilder.CreateBox(
      'gonHouseDoor',
      { width: 1, height: 1.8, depth: 0.15 },
      this.scene,
    );
    door.parent = root;
    door.position.set(0, 0.9, 2.25);
    door.material = this.mat(0.35, 0.22, 0.1);
    this._loadGonHouse(root, [base, roof, door]);
  }

  private async _loadGonHouse(root: TransformNode, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/', 'casa_gon.glb', this.scene);
      const model = res.meshes[0];
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const escala = 4.8 / (max.y - min.y);
      model.parent = root;
      model.scaling = new Vector3(escala, escala, escala);
      model.position.set(
        -((min.x + max.x) / 2) * escala,
        -min.y * escala,
        -((min.z + max.z) / 2) * escala,
      );
      for (const mesh of res.meshes) {
        if (mesh.getTotalVertices() > 0) {
          mesh.receiveShadows = true;
          this.addShadow(mesh);
        }
      }
      for (const prim of prims) prim.dispose();
    } catch {
      // Fallback: la forja gris de primitivas permanece visible.
    }
  }

  buildBuildings(): void {
    this.buildMartaShop();
    this.buildGonHouse();
    this.buildLilaHouse();
    this.buildFarmerHouse(); // Casa del granjero, al sur del almacén
    this.buildStorage(); // Almacén del granjero, al sur de la parcela
    this.buildSalesStand(); // Puesto de ventas, en la esquina suroeste de la granja
  }

  // Casa de Lila: GLB texturizado con la misma colisión y el fallback verde
  // que tenía antes. La caja no depende de la carga asíncrona del modelo.
  buildLilaHouse(): void {
    const x = 4;
    const z = -18;
    const hit = MeshBuilder.CreateBox(
      'lilaHouseHit',
      { width: 4.4, height: 4.8, depth: 4.4 },
      this.scene,
    );
    hit.position.set(x, 2.4, z);
    hit.isVisible = false;
    hit.physicsImpostor = new PhysicsImpostor(
      hit,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );

    const root = new TransformNode('lilaHouseRoot', this.scene);
    root.position.set(x, 0, z);
    const prims: Mesh[] = [];

    const base = MeshBuilder.CreateBox(
      'lilaHouseBase',
      { width: 4.4, height: 3, depth: 4.4 },
      this.scene,
    );
    base.parent = root;
    base.position.y = 1.5;
    base.material = this.mat(0.5, 0.72, 0.5);
    base.receiveShadows = true;
    this.addShadow(base);
    prims.push(base);

    const roof = MeshBuilder.CreateCylinder(
      'lilaHouseRoof',
      { diameterTop: 0, diameterBottom: 6.2, height: 2.2, tessellation: 4 },
      this.scene,
    );
    roof.parent = root;
    roof.position.y = 4.1;
    roof.rotation.y = Math.PI / 4;
    roof.material = this.mat(0.55, 0.22, 0.18);
    this.addShadow(roof);
    prims.push(roof);

    const door = MeshBuilder.CreateBox(
      'lilaHouseDoor',
      { width: 1, height: 1.8, depth: 0.15 },
      this.scene,
    );
    door.parent = root;
    door.position.set(0, 0.9, 2.25);
    door.material = this.mat(0.35, 0.22, 0.1);
    prims.push(door);

    this._loadLilaHouse(root, prims);
  }

  private async _loadLilaHouse(root: TransformNode, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/', 'casa_lila.glb', this.scene);
      const model = res.meshes[0];
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const escala = 4.8 / (max.y - min.y);
      model.parent = root;
      model.scaling = new Vector3(escala, escala, escala);
      model.position.y = -min.y * escala;
      for (const mesh of res.meshes) {
        if (mesh.getTotalVertices() > 0) this.addShadow(mesh);
      }
      for (const prim of prims) prim.dispose();
    } catch {
      // Fallback: la casa verde de primitivas permanece visible.
    }
  }

  // Tienda de Marta: modelo GLB texturizado con una casa y escaparate de
  // respaldo. La colisión es independiente, para no depender de la malla
  // importada ni dejar que el jugador atraviese el edificio durante la carga.
  buildMartaShop(): void {
    const x = 12;
    const z = -8;
    const hit = MeshBuilder.CreateBox(
      'martaShopHit',
      { width: 4.7, height: 4.8, depth: 4.2 },
      this.scene,
    );
    hit.position.set(x, 2.4, z);
    hit.isVisible = false;
    hit.physicsImpostor = new PhysicsImpostor(
      hit,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );

    const root = new TransformNode('martaShopRoot', this.scene);
    root.position.set(x, 0, z);
    const prims: Mesh[] = [];

    const base = MeshBuilder.CreateBox(
      'martaShopBase',
      { width: 4.4, height: 3, depth: 4.4 },
      this.scene,
    );
    base.parent = root;
    base.position.y = 1.5;
    base.material = this.mat(0.85, 0.55, 0.65);
    base.receiveShadows = true;
    this.addShadow(base);
    prims.push(base);

    const roof = MeshBuilder.CreateCylinder(
      'martaShopRoof',
      { diameterTop: 0, diameterBottom: 6.2, height: 2.2, tessellation: 4 },
      this.scene,
    );
    roof.parent = root;
    roof.position.y = 4.1;
    roof.rotation.y = Math.PI / 4;
    roof.material = this.mat(0.55, 0.22, 0.18);
    this.addShadow(roof);
    prims.push(roof);

    const door = MeshBuilder.CreateBox(
      'martaShopDoor',
      { width: 1, height: 1.8, depth: 0.15 },
      this.scene,
    );
    door.parent = root;
    door.position.set(0, 0.9, 2.25);
    door.material = this.mat(0.35, 0.22, 0.1);
    prims.push(door);

    const counter = MeshBuilder.CreateBox(
      'martaShopCounter',
      { width: 2.6, height: 1, depth: 1 },
      this.scene,
    );
    counter.parent = root;
    counter.position.set(-1, 0.5, 3);
    counter.material = this.mat(0.55, 0.35, 0.18);
    this.addShadow(counter);
    prims.push(counter);

    this._loadMartaShop(root, prims);
  }

  private async _loadMartaShop(root: TransformNode, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/', 'tienda_marta.glb', this.scene);
      const model = res.meshes[0];
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const escala = 4.8 / (max.y - min.y);
      model.parent = root;
      model.scaling = new Vector3(escala, escala, escala);
      model.position.y = -min.y * escala;
      for (const mesh of res.meshes) {
        if (mesh.getTotalVertices() > 0) this.addShadow(mesh);
      }
      for (const prim of prims) prim.dispose();
    } catch {
      // Fallback: la casa y el mostrador de primitivas permanecen visibles.
    }
  }

  // Almacén del granjero: modelo GLB (assets/almacen.glb, publicado en
  // /models/) con fallback a primitivas si falla la carga. Va bajo la zona de
  // cosecha, con la puerta mirando al oeste (-x).
  // La colisión son cuatro paredes macizas: se entra con Intro frente a la
  // puerta, que lleva al interior (ver warehouse.ts).
  buildStorage(): void {
    const { x, z } = STORAGE; // centro del almacén
    const k = STORAGE.height / 2.2; // las primitivas se midieron para 2,2 m de alto

    // Paredes: colisión fija (independiente del modelo) y, a la vez,
    // primitivas de respaldo visibles hasta que carga el GLB.
    const wallMat = this.mat(0.55, 0.38, 0.22);
    const wallMeshes: Mesh[] = [];
    for (const { w, d, px, pz } of STORAGE_WALLS) {
      const wall = MeshBuilder.CreateBox(
        'storageWall',
        { width: w, height: 1.6 * k, depth: d },
        this.scene,
      );
      wall.position.set(px, 0.8 * k, pz);
      wall.material = wallMat;
      wall.receiveShadows = true;
      wall.physicsImpostor = new PhysicsImpostor(
        wall,
        PhysicsImpostor.BoxImpostor,
        { mass: 0 },
        this.scene,
      );
      this.addShadow(wall);
      wallMeshes.push(wall);
    }

    // Nodo raíz: posición y giro para que la puerta mire al oeste (-x): la puerta del GLB mira hacia +z, como las casas; -π/2 en
    // Y la deja en -x.
    const root = new TransformNode('storageRoot', this.scene);
    root.position.set(x, 0, z);
    root.rotation.y = -Math.PI / 2;

    // Tejado de respaldo a dos aguas (colgado del root: la cumbrera va de
    // la puerta a la pared trasera), con el estilo del resto del pueblo
    const prims: Mesh[] = [];
    const roofMat = this.mat(0.55, 0.22, 0.18);
    for (const side of [-1, 1]) {
      const slope = MeshBuilder.CreateBox(
        'storageRoof',
        { width: 2.7 * k, height: 0.08, depth: 1.05 * k },
        this.scene,
      );
      slope.parent = root;
      slope.position.set(0, 2.0 * k, side * 0.5 * k);
      slope.rotation.x = side * 0.72;
      slope.material = roofMat;
      this.addShadow(slope);
      prims.push(slope);
    }

    this._loadStorage(root, prims, wallMeshes);
  }

  // Carga el GLB del almacén y sustituye a las primitivas (mismo patrón que
  // playerView/npcView: escala y apoyo en suelo por caja envolvente real).
  // El GLB no tiene el origen en su centro: se centra en el root para que
  // coincida con las paredes de colisión.
  private async _loadStorage(root: TransformNode, prims: Mesh[], walls: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/', 'almacen.glb', this.scene);
      const model = res.meshes[0];
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const escala = STORAGE.height / (max.y - min.y);
      model.parent = root;
      model.scaling = new Vector3(escala, escala, escala);
      model.position.y = -min.y * escala;
      // Centrado medido ya en el mundo (tras escala y giro del root)
      const placed = model.getHierarchyBoundingVectors(true);
      root.position.x += STORAGE.x - (placed.min.x + placed.max.x) / 2;
      root.position.z += STORAGE.z - (placed.min.z + placed.max.z) / 2;
      for (const m of res.meshes) {
        if (m.getTotalVertices() > 0) this.addShadow(m);
      }
      for (const p of prims) p.dispose();
      // Las paredes siguen colisionando, pero ya no se ven ni dan sombra
      const renderList = this.shadow?.getShadowMap()?.renderList;
      for (const w of walls) {
        w.isVisible = false;
        if (renderList) renderList.splice(renderList.indexOf(w), 1);
      }
    } catch {
      // fallback: se quedan las primitivas
    }
  }

  // Puesto de ventas: modelo GLB (assets/puesto_ventas.glb, publicado en
  // /models/) con fallback a primitivas si falla la carga. Va en la esquina
  // suroeste de la granja, con el mostrador mirando al norte (-z), hacia el
  // camino de la entrada. El GLB mide ~1.96×1.94×1.21 (la vista lo escala a
  // ~1.9 de alto): es ancho y poco profundo, con el mostrador en su cara
  // frontal. La rotación π en Y lleva la fachada local +z hacia el norte;
  // sellBin queda delante del mostrador.
  buildSalesStand(): void {
    const { x, z } = SALES_STAND;

    // Colisión fija (independiente del modelo): caja invisible que cubre el
    // volumen del puesto (~1.9×1.9×1.2 tras el giro), con el mostrador en
    // la cara norte.
    const hit = MeshBuilder.CreateBox(
      'salesStandHit',
      { width: 2.0, height: 2.0, depth: 1.4 },
      this.scene,
    );
    hit.position.set(x, 1.0, z - 0.6);
    hit.isVisible = false;
    hit.physicsImpostor = new PhysicsImpostor(
      hit,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );

    // El frente local +z del GLB rota al norte, hacia el camino de la entrada.
    const root = new TransformNode('salesStandRoot', this.scene);
    root.position.set(x, 0, z);
    root.rotation.y = Math.PI;

    // Primitivas de respaldo, con el estilo del resto del pueblo. El
    // mostrador local +z hereda el giro del root.
    const prims: Mesh[] = [];
    const counter = MeshBuilder.CreateBox(
      'salesStandCounter',
      { width: 1.8, height: 0.9, depth: 0.5 },
      this.scene,
    );
    counter.parent = root;
    counter.position.set(0, 0.45, 0.85);
    counter.material = this.mat(0.55, 0.38, 0.22);
    counter.receiveShadows = true;
    this.addShadow(counter);
    prims.push(counter);

    const awning = MeshBuilder.CreateBox(
      'salesStandAwning',
      { width: 2.0, height: 0.08, depth: 1.3 },
      this.scene,
    );
    awning.parent = root;
    awning.position.set(0, 1.8, 0.6);
    awning.rotation.x = 0.1;
    awning.material = this.mat(0.78, 0.2, 0.18);
    this.addShadow(awning);
    prims.push(awning);

    for (const [px, pz] of [
      [-0.8, 0.15],
      [0.8, 0.15],
      [-0.8, 1.05],
      [0.8, 1.05],
    ]) {
      const pole = MeshBuilder.CreateBox(
        'salesStandPole',
        { width: 0.12, height: 1.8, depth: 0.12 },
        this.scene,
      );
      pole.parent = root;
      pole.position.set(px, 0.9, pz);
      pole.material = this.mat(0.45, 0.32, 0.2);
      this.addShadow(pole);
      prims.push(pole);
    }

    this._loadSalesStand(root, prims);
  }

  // Carga el GLB del puesto y sustituye a las primitivas (mismo patrón que
  // _loadStorage: escala y apoyo en suelo por caja envolvente real).
  private async _loadSalesStand(root: TransformNode, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        'puesto_ventas.glb',
        this.scene,
      );
      const model = res.meshes[0];
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const escala = 1.9 / (max.y - min.y);
      model.parent = root;
      model.scaling = new Vector3(escala, escala, escala);
      model.position.y = -min.y * escala;
      for (const m of res.meshes) {
        if (m.getTotalVertices() > 0) this.addShadow(m);
      }
      for (const p of prims) p.dispose();
    } catch {
      // fallback: se quedan las primitivas
    }
  }

  buildTree(x: number, z: number, variant: string): void {
    const root = new TransformNode('treeRoot', this.scene);
    root.position.set(x, 0, z);
    const prims: Mesh[] = [];

    // La colisión no depende del GLB: se mantiene al cargar y si la carga falla.
    const hit = MeshBuilder.CreateCylinder('treeHit', { height: 1.6, diameter: 0.5 }, this.scene);
    hit.position.set(x, 0.8, z);
    hit.isVisible = false;
    hit.physicsImpostor = new PhysicsImpostor(
      hit,
      PhysicsImpostor.CylinderImpostor,
      { mass: 0 },
      this.scene,
    );

    const trunk = MeshBuilder.CreateCylinder('trunk', { height: 1.6, diameter: 0.4 }, this.scene);
    trunk.parent = root;
    trunk.position.set(0, 0.8, 0);
    trunk.material = this.mat(0.4, 0.26, 0.13);
    this.addShadow(trunk);
    prims.push(trunk);

    const leafMat = this.mat(0.16, 0.45, 0.18);
    const l1 = MeshBuilder.CreateSphere('leaf1', { diameter: 2.2 }, this.scene);
    l1.parent = root;
    l1.position.set(0, 2.4, 0);
    l1.material = leafMat;
    this.addShadow(l1);
    prims.push(l1);
    const l2 = MeshBuilder.CreateSphere('leaf2', { diameter: 1.4 }, this.scene);
    l2.parent = root;
    l2.position.set(0, 3.3, 0);
    l2.material = leafMat;
    this.addShadow(l2);
    prims.push(l2);

    this._loadTree(root, variant, prims);
  }

  private async _loadTree(root: TransformNode, variant: string, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/', variant, this.scene);
      const model = res.meshes[0];
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const escala = 4 / (max.y - min.y);
      model.parent = root;
      model.scaling = new Vector3(escala, escala, escala);
      model.position.y = -min.y * escala;
      for (const mesh of res.meshes) {
        if (mesh.getTotalVertices() > 0) this.addShadow(mesh);
      }
      for (const prim of prims) prim.dispose();
    } catch {
      // fallback: se mantienen las primitivas y la colisión fija.
    }
  }

  // Casa del granjero: colisión fija (cuerpo y barreras del porche, que solo
  // deja subir por el peldaño) que no depende del GLB, y casa de primitivas
  // como respaldo si falla la carga.
  buildFarmerHouse(): void {
    const { x, z, width, depth, height } = FARMER_HOUSE;
    const colliders = [
      // Cuerpo, con la chimenea y la leña a los lados de la fachada
      { w: depth, h: height, d: width + 1.4, cx: x, cz: z },
      ...PORCH_BARRIERS.map((b) => ({ ...b, h: 1 })),
      { w: 0.7, h: 0.8, d: 0.7, cx: x - depth / 2 - 0.75, cz: z - 2 }, // barril
    ];
    for (const c of colliders) {
      const hit = MeshBuilder.CreateBox(
        'farmerHouseHit',
        { width: c.w, height: c.h, depth: c.d },
        this.scene,
      );
      hit.position.set(c.cx, c.h / 2, c.cz);
      hit.isVisible = false;
      hit.physicsImpostor = new PhysicsImpostor(
        hit,
        PhysicsImpostor.BoxImpostor,
        { mass: 0 },
        this.scene,
      );
    }

    // La fachada del GLB mira a +z; -π/2 en Y la deja mirando a -x, hacia la entrada
    const root = new TransformNode('farmerHouseRoot', this.scene);
    root.position.set(x, 0, z);
    root.rotation.y = -Math.PI / 2;
    const base = MeshBuilder.CreateBox(
      'farmerHouseBase',
      { width, height: 2.6, depth },
      this.scene,
    );
    base.parent = root;
    base.position.y = 1.3;
    base.material = this.mat(0.62, 0.42, 0.24);
    base.receiveShadows = true;
    this.addShadow(base);

    const roof = MeshBuilder.CreateCylinder(
      'farmerHouseRoof',
      { diameterTop: 0, diameterBottom: 6.6, height: 2, tessellation: 4 },
      this.scene,
    );
    roof.parent = root;
    roof.position.y = 3.6;
    roof.rotation.y = Math.PI / 4;
    roof.material = this.mat(0.68, 0.29, 0.2);
    this.addShadow(roof);

    const door = MeshBuilder.CreateBox(
      'farmerHouseDoor',
      { width: 1, height: 1.9, depth: 0.15 },
      this.scene,
    );
    door.parent = root;
    door.position.set(0, 0.95, depth / 2);
    door.material = this.mat(0.26, 0.47, 0.44);
    void this._loadFarmerHouse(root, [base, roof, door]);
  }

  private async _loadFarmerHouse(root: TransformNode, prims: Mesh[]): Promise<void> {
    let imported: ISceneLoaderAsyncResult | null = null;
    try {
      imported = await SceneLoader.ImportMeshAsync('', '/models/', 'casa_granjero.glb', this.scene);
      const model = imported.meshes[0];
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const alto = max.y - min.y;
      if (!Number.isFinite(alto) || alto <= 0) throw new Error('Casa sin dimensiones');
      const escala = FARMER_HOUSE.height / alto;
      model.parent = root;
      // El pivote del GLB es el centro de la planta (el porche y la chimenea
      // descentran la caja), así que solo se apoya en el suelo. Se conserva
      // el signo de la escala del root glTF (conversión de ejes).
      model.scaling.scaleInPlace(escala);
      model.position.y = -min.y * escala;
      for (const mesh of imported.meshes) {
        if (mesh.getTotalVertices() > 0) {
          mesh.receiveShadows = true;
          this.addShadow(mesh);
        }
        if (mesh.material instanceof PBRMaterial && mesh.material.name === 'M_Cristal') {
          this.nightGlow.push({ mat: mesh.material, r: 1, g: 0.72, b: 0.35 });
        }
      }
      for (const prim of prims) {
        this.shadow?.removeShadowCaster(prim);
        prim.dispose(false, true);
      }
    } catch {
      // Fallback: la casa de primitivas y su colisión siguen disponibles.
      if (imported) {
        for (const mesh of imported.meshes) mesh.dispose(false, true);
      }
    }
  }

  // Dormir: salta al amanecer siguiente. Como el día va de 06:00 a 06:00,
  // tanto a las 22:00 como a las 02:00 se despierta en el día `day + 1`.
  sleep(day: number): void {
    this.time = 0;
    this.bus.emit(EVENTS.DAY_NEW, { day: day + 1 });
  }

  buildTrees(): void {
    const variants = ['arbol_01.glb', 'arbol_02.glb', 'arbol_03.glb'];
    for (const [index, [x, z]] of TREE_SPOTS.entries()) {
      this.buildTree(x, z, variants[index % variants.length]);
    }
  }

  // Pozo junto a la granja: colisión estable durante la carga y si falla el GLB.
  buildWell(): void {
    const root = new TransformNode('wellRoot', this.scene);
    root.position.set(this.well.x, 0, this.well.z); // Sobre el césped, al sur de la parcela.

    const hit = MeshBuilder.CreateBox('wellHit', { width: 1.6, height: 1, depth: 1.6 }, this.scene);
    hit.position.set(this.well.x, 0.5, this.well.z);
    hit.isVisible = false;
    hit.physicsImpostor = new PhysicsImpostor(
      hit,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );

    const well = MeshBuilder.CreateCylinder(
      'wellFallback',
      { height: 1, diameter: 1.6 },
      this.scene,
    );
    well.parent = root;
    well.position.y = 0.5;
    well.material = this.mat(0.55, 0.55, 0.58);
    well.receiveShadows = true;
    this.addShadow(well);
    void this._loadWell(root, well);
  }

  private async _loadWell(root: TransformNode, fallback: Mesh): Promise<void> {
    let imported: ISceneLoaderAsyncResult | null = null;
    try {
      imported = await SceneLoader.ImportMeshAsync('', '/models/', 'pozo.glb', this.scene);
      const model = imported.meshes[0];
      const lod0 = imported.meshes.find((m) => m.name === 'SM_Pozo_LOD0');
      if (!model || !(lod0 instanceof Mesh) || lod0.getTotalVertices() === 0) {
        throw new Error('Pozo sin malla');
      }

      const { min, max } = model.getHierarchyBoundingVectors(true);
      const height = max.y - min.y;
      if (!Number.isFinite(height) || height <= 0) throw new Error('Pozo sin dimensiones');
      const scale = 2.2 / height;
      model.parent = root;
      // Conservar el signo de la escala del root glTF (conversión de ejes).
      model.scaling.scaleInPlace(scale);
      model.position.set(
        (-(min.x + max.x) / 2) * scale,
        -min.y * scale,
        (-(min.z + max.z) / 2) * scale,
      );

      for (const [name, distance] of [
        ['SM_Pozo_LOD1', 22],
        ['SM_Pozo_LOD2', 38],
      ] as const) {
        const lod = imported.meshes.find((m) => m.name === name);
        if (lod instanceof Mesh) lod0.addLODLevel(distance, lod);
      }
      for (const mesh of imported.meshes) mesh.receiveShadows = true;
      this.addShadow(lod0);
      this.shadow?.removeShadowCaster(fallback);
      fallback.dispose(false, true);

      // Cubo, cuerda y manivela vienen como mallas sueltas para animarlas
      const pieza = (name: string) => imported!.meshes.find((m) => m.name === name);
      const cubo = pieza('SM_Pozo_Cubo');
      const cuerda = pieza('SM_Pozo_Cuerda');
      const manivela = pieza('SM_Pozo_Manivela');
      if (cubo && cuerda && manivela) {
        for (const m of [cubo, cuerda, manivela]) this.addShadow(m);
        root.computeWorldMatrix(true);
        for (const n of [model, ...model.getDescendants(false)]) {
          (n as TransformNode).computeWorldMatrix?.(true);
        }
        this.wellView = new WellView(this.scene, { cubo, cuerda, manivela });
      }
    } catch {
      // El respaldo y su colisión siguen disponibles incluso con un GLB inválido.
      if (imported) {
        for (const mesh of imported.meshes) mesh.dispose(false, true);
      }
    }
  }

  buildDecor(): void {
    this.buildWell();

    // Jardín de flores de Lila: los modelos se cargan de forma independiente
    // para que un GLB defectuoso no deje el jardín vacío.
    const spots = [
      [-3, -13],
      [-1.8, -13],
      [-0.6, -13],
      [-3, -14.2],
      [-1.8, -14.2],
      [-0.6, -14.2],
    ];
    const variants = [
      'flor_margarita.glb',
      'flor_tulipan.glb',
      'flor_lavanda.glb',
      'flor_amapola.glb',
      'flor_campanilla.glb',
    ];
    for (const [index, [x, z]] of spots.entries()) {
      this.buildFlower(x, z, variants[index % variants.length], index);
    }
  }

  private buildFlower(x: number, z: number, variant: string, index: number): void {
    const root = new TransformNode('lilaFlowerRoot', this.scene);
    root.position.set(x, 0, z);
    const prims: Mesh[] = [];

    // Respaldo visible durante la carga y ante un GLB inválido.
    const flowerColors = [
      this.mat(0.9, 0.3, 0.4),
      this.mat(0.95, 0.85, 0.3),
      this.mat(0.7, 0.4, 0.9),
    ];
    const stem = MeshBuilder.CreateCylinder(
      'flowerFallbackStem',
      { height: 0.5, diameter: 0.06 },
      this.scene,
    );
    stem.parent = root;
    stem.position.y = 0.25;
    stem.material = this.mat(0.2, 0.55, 0.2);
    prims.push(stem);
    const head = MeshBuilder.CreateSphere('flowerFallbackHead', { diameter: 0.28 }, this.scene);
    head.parent = root;
    head.position.y = 0.55;
    head.material = flowerColors[index % flowerColors.length];
    prims.push(head);
    this.addShadow(stem);
    this.addShadow(head);
    void this._loadFlower(root, variant, prims);
  }

  private async _loadFlower(root: TransformNode, variant: string, prims: Mesh[]): Promise<void> {
    let imported: ISceneLoaderAsyncResult | null = null;
    try {
      imported = await SceneLoader.ImportMeshAsync('', '/models/', variant, this.scene);
      const model = imported.meshes[0];
      if (!model) throw new Error('Flor sin malla raíz');
      const { min, max } = model.getHierarchyBoundingVectors(true);
      const height = max.y - min.y;
      if (!Number.isFinite(height) || height <= 0) throw new Error('Flor sin dimensiones');
      const scale = 0.86 / height;
      model.parent = root;
      model.scaling.scaleInPlace(scale);
      model.position.set(
        (-(min.x + max.x) / 2) * scale,
        -min.y * scale,
        (-(min.z + max.z) / 2) * scale,
      );
      for (const mesh of imported.meshes) {
        if (mesh.getTotalVertices() > 0) {
          mesh.receiveShadows = true;
          this.addShadow(mesh);
        }
      }
      for (const prim of prims) {
        this.shadow?.removeShadowCaster(prim);
        prim.dispose();
      }
    } catch {
      if (imported) {
        for (const mesh of imported.meshes) mesh.dispose(false, true);
      }
    }
  }

  // Un cercado por especie: suelo de paja y valla de madera con puerta al sur.
  // Las coordenadas vienen de data/animals.ts (PENS): cada animal (animalView)
  // pasea dentro del suyo. Los animales los gestiona AnimalLogic/AnimalView.
  buildPens(): void {
    const pens = Object.values(this.pens);
    const floorMat = this.mat(0.82, 0.72, 0.45);
    const fenceMat = this.mat(0.5, 0.36, 0.2);
    for (const { x1, x2, z1, z2, gateX1, gateX2 } of pens) {
      const floor = MeshBuilder.CreateBox(
        'penFloor',
        { width: x2 - x1, height: 0.04, depth: z2 - z1 },
        this.scene,
      );
      floor.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
      floor.material = floorMat;
      floor.receiveShadows = true;

      this.fenceSide(x1, z1, x2, z1, fenceMat); // norte
      this.fenceSide(x1, z2, gateX1, z2, fenceMat); // sur, a un lado de la puerta
      this.fenceSide(gateX2, z2, x2, z2, fenceMat); // sur, al otro
      this.fenceSide(x1, z1, x1, z2, fenceMat); // oeste
      // El lado este solo si no lo pone ya el cercado vecino como su oeste
      if (!pens.some((p) => p.x1 === x2)) this.fenceSide(x2, z1, x2, z2, fenceMat);
    }
  }

  // Valla de la granja, con su único hueco en el lado de la calle (ver farmLayout).
  buildFarmFence(): void {
    const fenceMat = this.mat(0.5, 0.36, 0.2);
    for (const [x1, z1, x2, z2] of FARM_FENCE) this.fenceSide(x1, z1, x2, z2, fenceMat);
  }

  // Arco de entrada: modelo GLB (assets/entrada_granja/, publicado en /models/) con
  // colisiones fijas, primitivas de respaldo y el nombre pintado en su letrero.
  buildFarmEntrance(): void {
    const { x, z, z1, z2, signY } = FARM_ENTRANCE;
    for (const c of FARM_ENTRANCE_SOLIDS) {
      const hit = MeshBuilder.CreateBox(
        'farmEntranceHit',
        { width: c.w, height: 1.5, depth: c.d },
        this.scene,
      );
      hit.position.set(c.cx, 0.75, c.cz);
      hit.isVisible = false;
      hit.physicsImpostor = new PhysicsImpostor(
        hit,
        PhysicsImpostor.BoxImpostor,
        { mass: 0 },
        this.scene,
      );
    }

    // El exterior del GLB mira a -Y de Blender; -π/2 en Y lo deja hacia la calle (-x)
    const root = new TransformNode('farmEntranceRoot', this.scene);
    root.position.set(x, 0, z);
    root.rotation.y = -Math.PI / 2;

    const wood = this.mat(0.45, 0.3, 0.18);
    const prims: Mesh[] = [];
    const box = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
      const b = MeshBuilder.CreateBox(
        'farmEntrancePrim',
        { width: w, height: h, depth: d },
        this.scene,
      );
      b.position.set(px, py, pz);
      b.material = wood;
      this.addShadow(b);
      prims.push(b);
    };
    box(0.4, 3.3, 0.4, x, 1.65, z1);
    box(0.4, 3.3, 0.4, x, 1.65, z2);
    box(0.3, 0.3, z2 - z1 + 0.9, x, 3.2, z);
    box(0.06, 1.2, 0.06, x, 3.8, z); // soporte del letrero

    // Letrero, sobre la cumbrera: de cara a la calle (-x), como el exterior del arco
    const tex = new DynamicTexture(
      'granjaLetreroTex',
      { width: 512, height: 184 },
      this.scene,
      true,
    );
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#b5834f';
    ctx.fillRect(0, 0, 512, 184);
    ctx.fillStyle = '#3a2614';
    ctx.font = 'bold 96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌾 Granja', 256, 98);
    tex.update();
    const signMat = new StandardMaterial('granjaLetreroMat', this.scene);
    signMat.diffuseTexture = tex;
    signMat.specularColor = Color3.Black();
    const sign = MeshBuilder.CreatePlane(
      'granjaLetrero',
      { width: 1.34, height: 0.48 },
      this.scene,
    );
    sign.position.set(x - 0.055, signY, z);
    sign.rotation.y = Math.PI / 2; // la cara del plano (-z local) pasa a mirar a -x
    sign.material = signMat;

    void this._loadFarmEntrance(root, prims);
  }

  private async _loadFarmEntrance(root: TransformNode, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        'entrada_granja.glb',
        this.scene,
      );
      res.meshes[0].parent = root; // medidas métricas: las colisiones se apoyan en ellas
      for (const m of res.meshes) {
        if (m.getTotalVertices() === 0) continue;
        m.receiveShadows = true;
        this.addShadow(m);
        if (m.material instanceof PBRMaterial && m.material.name === 'M_Farol') {
          this.nightGlow.push({ mat: m.material, r: 1, g: 0.72, b: 0.35 });
        }
      }
      for (const p of prims) {
        this.shadow?.removeShadowCaster(p);
        p.dispose();
      }
    } catch {
      // fallback: se quedan los postes y la viga de primitivas
    }
  }

  // Un lado de valla: postes cada ~1.9 unidades, dos travesaños
  // horizontales y una pared invisible para la colisión del jugador.
  fenceSide(x1: number, z1: number, x2: number, z2: number, fenceMat: StandardMaterial): void {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const alongX = Math.abs(dx) > Math.abs(dz);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const n = Math.max(2, Math.round(len / 1.9) + 1);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const post = MeshBuilder.CreateBox(
        'fencePost',
        { width: 0.16, height: 0.9, depth: 0.16 },
        this.scene,
      );
      post.position.set(x1 + dx * t, 0.45, z1 + dz * t);
      post.material = fenceMat;
      this.addShadow(post);
    }

    for (const y of [0.35, 0.68]) {
      const rail = MeshBuilder.CreateBox(
        'fenceRail',
        alongX
          ? { width: len, height: 0.09, depth: 0.09 }
          : { width: 0.09, height: 0.09, depth: len },
        this.scene,
      );
      rail.position.set(cx, y, cz);
      rail.material = fenceMat;
      this.addShadow(rail);
    }

    const wall = MeshBuilder.CreateBox(
      'fenceWall',
      alongX ? { width: len, height: 1, depth: 0.2 } : { width: 0.2, height: 1, depth: len },
      this.scene,
    );
    wall.position.set(cx, 0.5, cz);
    wall.isVisible = false;
    wall.physicsImpostor = new PhysicsImpostor(
      wall,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );
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
    this.wellView?.update(dt);
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
    const sky = this.scene.clearColor;
    this.scene.fogColor.copyFromFloats(sky.r, sky.g, sky.b);

    // Luz cálida en las ventanas de casa y en los faroles de la entrada al anochecer
    const noche = 1 - Math.min(1, f * 3);
    for (const { mat, r, g, b } of this.nightGlow) {
      mat.emissiveColor.copyFromFloats(r * noche, g * noche, b * noche);
    }

    this.daylight = f;
    // En un interior manda la luz de la estancia, sea la hora que sea, y detrás
    // del diorama no hay paisaje.
    if (this.indoors) {
      this.sun.intensity = 0.45;
      this.hemi.intensity = 0.8;
      sky.copyFromFloats(0.07, 0.05, 0.04, 1);
    }
  }
}
