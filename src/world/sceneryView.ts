// SceneryView (vista Babylon): decoración del entorno sin reglas de juego.
// Repite los props de escenario.glb (matas de hierba, flores silvestres,
// rocas, arbustos y pinos) con thin instances: una llamada
// de dibujo por malla aunque haya cientos de copias. Las colinas del
// horizonte rodean el mapa para que no termine en el vacío.
import { CONFIG } from '../core/constants';
import { PENS } from '../../data/animals';
import { FARM_CONFIG } from '../../data/farm';
import { Ray } from '@babylonjs/core/Culling/ray';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import type { AbstractMesh, Material, Scene } from '@babylonjs/core';
import { FARMER_HOUSE, PORCH } from './farmerPorch';
import {
  ENTRANCE_PATH,
  FARM_ENTRANCE,
  FARM_ZONE,
  SALES_STAND,
  WELL,
  type Rect,
} from './farmLayout';
import { MARKET_ZONE } from './marketLayout';
import { STORAGE } from './warehouse';
import type { WorldView } from './worldView';

interface Placement {
  x: number;
  y?: number;
  z: number;
  rotY: number;
  scale: number;
}

// Zonas donde no se siembra decoración: caminos, casas, jardín de Lila, rutas de
// los NPC (data/npcs.ts), el spawn y lo construido en la granja.
const around = (x1: number, x2: number, z1: number, z2: number, margin: number): Rect => ({
  minX: x1 - margin,
  maxX: x2 + margin,
  minZ: z1 - margin,
  maxZ: z2 + margin,
});

const CLEAR_ZONES: Rect[] = [
  { minX: -1.7, maxX: 1.7, minZ: -28.6, maxZ: 13.5 }, // camino norte-sur + spawn
  { minX: -16.6, maxX: 14.6, minZ: -5.7, maxZ: -2.3 }, // camino este-oeste
  { minX: -18.5, maxX: -9.5, minZ: -14.5, maxZ: -5.5 }, // casa de Gon
  { minX: -14.5, maxX: -7.5, minZ: -8.5, maxZ: -2.5 }, // ruta de Gon
  { minX: -0.5, maxX: 8.5, minZ: -22.5, maxZ: -13.5 }, // casa de Lila
  { minX: -4, maxX: 4.5, minZ: -17.5, maxZ: -10.5 }, // jardín y ruta de Lila
  MARKET_ZONE, // tienda de Marta y puestos del mercado
  { minX: -2, maxX: 1.7, minZ: FARM_ENTRANCE.z1 - 1, maxZ: FARM_ENTRANCE.z2 + 1 }, // ante la entrada
  around(ENTRANCE_PATH.minX, ENTRANCE_PATH.maxX, ENTRANCE_PATH.minZ, ENTRANCE_PATH.maxZ, 0.4),
  ...Object.values(PENS).map((p) => around(p.x1, p.x2, p.z1, p.z2, 0.8)),
  around(
    FARM_CONFIG.origin.x,
    FARM_CONFIG.origin.x + (FARM_CONFIG.cols - 1) * FARM_CONFIG.spacing,
    FARM_CONFIG.origin.z,
    FARM_CONFIG.origin.z + (FARM_CONFIG.rows - 1) * FARM_CONFIG.spacing,
    1.2,
  ),
  around(STORAGE.x, STORAGE.x, STORAGE.z, STORAGE.z, STORAGE.depth / 2 + 1),
  around(
    PORCH.stepFrontX,
    FARMER_HOUSE.x + FARMER_HOUSE.depth / 2,
    FARMER_HOUSE.z,
    FARMER_HOUSE.z,
    FARMER_HOUSE.width / 2 + 1,
  ),
  around(WELL.x, WELL.x, WELL.z, WELL.z, 2),
  around(SALES_STAND.x, SALES_STAND.x, SALES_STAND.z, SALES_STAND.z, 2.2),
];

// Generador pseudoaleatorio con semilla (mulberry32): el decorado es el
// mismo en cada partida.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SceneryView {
  scene: Scene;
  world: WorldView;
  trees: number[][];
  private rocks: (Placement & { variant: number })[];
  private bushes: (Placement & { variant: number })[];

  constructor(scene: Scene, world: WorldView, trees: number[][]) {
    this.scene = scene;
    this.world = world;
    this.trees = trees;

    // Las colisiones de rocas y arbustos no dependen de la carga del GLB.
    this.rocks = this.scatter(rng(31), 18, 1.4, 27, (r) => ({ variant: Math.floor(r() * 3) }));
    this.bushes = this.scatter(rng(32), 22, 1.6, 28, (r) => ({ variant: Math.floor(r() * 2) }));
    for (const rock of this.rocks) {
      const size = [0.9, 1.5, 0.6][rock.variant] * rock.scale;
      if (size > 0.7) this.addCollider(rock.x, rock.z, size);
    }
    for (const bush of this.bushes) this.addCollider(bush.x, bush.z, 1.2 * bush.scale);

    void this.load();
  }

  private isFree(x: number, z: number, margin: number, zones = CLEAR_ZONES): boolean {
    for (const r of zones) {
      if (
        x > r.minX - margin &&
        x < r.maxX + margin &&
        z > r.minZ - margin &&
        z < r.maxZ + margin
      ) {
        return false;
      }
    }
    for (const [tx, tz] of this.trees) {
      if (Math.hypot(x - tx, z - tz) < 1.6 + margin) return false;
    }
    return true;
  }

  // Puntos libres al azar dentro de ±half, separados `spacing` entre sí.
  private scatter<T>(
    r: () => number,
    count: number,
    spacing: number,
    half: number,
    extra: (r: () => number) => T,
  ): (Placement & T)[] {
    const out: (Placement & T)[] = [];
    for (let tries = 0; out.length < count && tries < count * 60; tries++) {
      const x = (r() * 2 - 1) * half;
      const z = (r() * 2 - 1) * half;
      // Rocas y arbustos chocan: fuera de toda la granja, no solo de lo construido
      if (!this.isFree(x, z, spacing * 0.5, [...CLEAR_ZONES, FARM_ZONE])) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.z - z) < spacing)) continue;
      out.push({ x, z, rotY: r() * Math.PI * 2, scale: 0.75 + r() * 0.6, ...extra(r) });
    }
    return out;
  }

  private addCollider(x: number, z: number, size: number): void {
    const hit = MeshBuilder.CreateBox(
      'sceneryHit',
      { width: size, height: 1, depth: size },
      this.scene,
    );
    hit.position.set(x, 0.5, z);
    hit.isVisible = false;
    hit.isPickable = false;
    hit.physicsImpostor = new PhysicsImpostor(
      hit,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      this.scene,
    );
  }

  // Altura de las colinas en (x, z); 0 dentro del mapa o sin colinas.
  private heightAt(hills: AbstractMesh | undefined, x: number, z: number): number | null {
    const half = CONFIG.groundSize / 2;
    if (!hills || (Math.abs(x) < half && Math.abs(z) < half)) return 0;
    const hit = new Ray(new Vector3(x, 100, z), new Vector3(0, -1, 0), 200).intersectsMesh(hills);
    return hit.hit && hit.pickedPoint ? hit.pickedPoint.y : null;
  }

  // Hierba y flores: matas sueltas por todo el prado y flores en corros. Se
  // siembran también un poco más allá del borde para que no se note.
  private grassAndFlowers(hills: AbstractMesh | undefined): {
    tufts: Placement[][];
    flowers: Placement[][];
  } {
    const r = rng(33);
    const half = CONFIG.groundSize / 2 + 6;
    const tufts: Placement[][] = [[], []];
    for (let i = 0; i < 1100; i++) {
      const x = (r() * 2 - 1) * half;
      const z = (r() * 2 - 1) * half;
      const rotY = r() * Math.PI * 2;
      const scale = 0.7 + r() * 0.7;
      const y = this.heightAt(hills, x, z);
      if (y === null || !this.isFree(x, z, 0.1)) continue;
      tufts[i % 2].push({ x, y, z, rotY, scale });
    }
    const flowers: Placement[][] = [[], [], []];
    for (let c = 0; c < 34; c++) {
      const cx = (r() * 2 - 1) * half;
      const cz = (r() * 2 - 1) * half;
      const kind = Math.floor(r() * 3);
      const n = 4 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const x = cx + (r() * 2 - 1) * 1.4;
        const z = cz + (r() * 2 - 1) * 1.4;
        const rotY = r() * Math.PI * 2;
        const scale = 1.1 + r() * 0.6;
        const y = this.heightAt(hills, x, z);
        if (y === null || !this.isFree(x, z, 0.2)) continue;
        flowers[kind].push({ x, y, z, rotY, scale });
      }
    }
    return { tufts, flowers };
  }

  // Pinos sobre las colinas, más densos cerca del mapa.
  private pines(hills: AbstractMesh | undefined): Placement[][] {
    const r = rng(34);
    const out: Placement[][] = [[], []];
    for (let i = 0; i < 520; i++) {
      const x = (r() * 2 - 1) * 95;
      const z = (r() * 2 - 1) * 95;
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d < CONFIG.groundSize / 2 + 2.5) continue;
      if (r() > 1.15 - (d - 34) / 70) continue; // se aclaran al alejarse
      const y = this.heightAt(hills, x, z);
      if (y === null) continue;
      out[i % 2].push({ x, y: y - 0.1, z, rotY: r() * Math.PI * 2, scale: 0.8 + r() * 0.7 });
    }
    return out;
  }

  private async load(): Promise<void> {
    let res;
    try {
      res = await SceneLoader.ImportMeshAsync('', '/models/', 'escenario.glb', this.scene);
    } catch {
      return; // sin decoración: el prado texturizado sigue funcionando
    }
    const parts = (prefix: string): Mesh[] =>
      res.meshes.filter(
        (m): m is Mesh =>
          m instanceof Mesh && m.name.startsWith(prefix) && m.getTotalVertices() > 0,
      );

    // Las colinas pasan a ser el suelo visible de todo el mundo, con el
    // material del terreno (sus UV cubren el mapa igual que las de su cara
    // superior): así no hay costura en el borde. El terreno sigue como
    // superficie física invisible y vuelve a verse si el GLB falla.
    const hills = parts('Colinas')[0];
    if (hills) {
      hills.material = this.world.ground.material;
      hills.isPickable = false;
      hills.receiveShadows = true;
      hills.computeWorldMatrix(true);
      this.world.ground.isVisible = false;
    }

    const { tufts, flowers } = this.grassAndFlowers(hills);
    this.instance(parts('Hierba_01'), tufts[0]);
    this.instance(parts('Hierba_02'), tufts[1]);
    this.instance(parts('Flores_Blanca'), flowers[0]);
    this.instance(parts('Flores_Amarilla'), flowers[1]);
    this.instance(parts('Flores_Malva'), flowers[2]);
    for (let v = 0; v < 3; v++) {
      const meshes = parts(`Roca_0${v + 1}`);
      this.instance(
        meshes,
        this.rocks.filter((p) => p.variant === v),
      );
      for (const m of meshes) this.world.addShadow(m);
    }
    for (let v = 0; v < 2; v++) {
      const meshes = parts(`Arbusto_0${v + 1}`);
      this.instance(
        meshes,
        this.bushes.filter((p) => p.variant === v),
      );
      for (const m of meshes) {
        m.material = this.matte(m.material);
        this.world.addShadow(m);
      }
    }
    const pines = this.pines(hills);
    this.instance(parts('Pino_01'), pines[0]);
    this.instance(parts('Pino_02'), pines[1]);
  }

  // Copia mate (StandardMaterial sin brillo, como el resto de la escena) de
  // un material PBR del glTF: sin mapa de entorno el PBR sale blanquecino.
  // Las hojas traen normales hacia fuera del arbusto, así que no se usa la
  // luz de doble cara (las caras traseras se verían oscuras).
  private matte(source: Material | null): Material | null {
    if (!(source instanceof PBRMaterial)) return source;
    const mat = new StandardMaterial(`${source.name}_mate`, this.scene);
    mat.diffuseTexture = source.albedoTexture;
    mat.diffuseColor = source.albedoColor;
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = source.backFaceCulling;
    mat.twoSidedLighting = false;
    if (source.transparencyMode === PBRMaterial.MATERIAL_ALPHATEST && mat.diffuseTexture) {
      mat.diffuseTexture.hasAlpha = true; // recorte alfa, sin mezcla
      mat.alphaCutOff = source.alphaCutOff;
    }
    return mat;
  }

  // Thin instances de cada malla del prop. La matriz de cada copia es
  // W·D·W⁻¹ (W: matriz de mundo de la malla importada, con la conversión de
  // ejes del glTF; D: colocación deseada), así la copia queda en D sin
  // reflejar la geometría ni invertir el orden de las caras.
  private instance(meshes: Mesh[], placements: Placement[]): void {
    for (const mesh of meshes) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      if (placements.length === 0) {
        mesh.setEnabled(false);
        continue;
      }
      const w = mesh.computeWorldMatrix(true);
      const wInv = w.clone().invert();
      const matrices = placements.map((p) => {
        const d = Matrix.Compose(
          new Vector3(p.scale, p.scale, p.scale),
          Quaternion.RotationAxis(Vector3.Up(), p.rotY),
          new Vector3(p.x, p.y ?? 0, p.z),
        );
        return w.multiply(d).multiply(wInv);
      });
      mesh.thinInstanceAdd(matrices);
      mesh.thinInstanceRefreshBoundingInfo();
    }
  }
}
