// WarehouseView (vista Babylon): el interior del almacén, un escenario propio
// lejos del pueblo al que se llega por la puerta. Colisiones fijas independientes
// del GLB (assets/almacen_interior/), en dos alturas, y primitivas de respaldo si
// falla la carga. Sin reglas de juego.
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import type { AbstractMesh, Mesh, Scene } from '@babylonjs/core';
import {
  GROUND_COLLIDERS,
  LOFT,
  LOFT_COLLIDERS,
  LOFT_HEIGHT,
  LOFT_THICKNESS,
  WALL_HEIGHT,
  WAREHOUSE,
  WAREHOUSE_FEED_BAYS,
  WAREHOUSE_SHELVES,
  WAREHOUSE_WALLS,
} from './warehouse';

// Altura de las colisiones de cada nivel: las de abajo no llegan a la losa
const GROUND_SOLID_HEIGHT = LOFT_HEIGHT - LOFT_THICKNESS - 0.2;
const LOFT_SOLID_HEIGHT = 2;

const LOFT_FADE_ALPHA = 0.14; // cuánto se ve el altillo con el granjero debajo
const LOFT_FADE_RATE = 7; // rapidez del fundido (1/s)

/** Rótulos: nombre e icono de lo que guarda cada zona (los pone main.ts desde data/). */
export interface WarehouseLabels {
  shelf: (kind: 'crop' | 'animal', id: string) => string;
  feed: (animal: string) => string;
}

export class WarehouseView {
  scene: Scene;
  private loftMeshes: AbstractMesh[] = []; // rótulos y primitivas: translúcidos bajo el altillo
  private loftMaterials: PBRMaterial[] = []; // ídem, los del GLB
  private loftAlpha = 1;
  private glass: PBRMaterial | null = null; // las ventanas dejan ver el día o la noche

  constructor(scene: Scene, labels: WarehouseLabels) {
    this.scene = scene;
    const { x, z, width, depth } = WAREHOUSE;

    const solid = (
      name: string,
      w: number,
      h: number,
      d: number,
      cx: number,
      y0: number,
      cz: number,
    ) => {
      const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      box.position.set(cx, y0 + h / 2, cz);
      box.isVisible = false;
      box.physicsImpostor = new PhysicsImpostor(
        box,
        PhysicsImpostor.BoxImpostor,
        { mass: 0 },
        scene,
      );
    };
    // Suelo propio: el terreno del pueblo no llega hasta aquí
    solid('almacenSueloHit', width + 2, 1, depth + 2, x, -1, z);
    for (const c of WAREHOUSE_WALLS) {
      solid(`almacen_${c.name}`, c.w, WALL_HEIGHT, c.d, c.cx, 0, c.cz);
    }
    for (const c of GROUND_COLLIDERS) {
      solid(`almacen_${c.name}`, c.w, GROUND_SOLID_HEIGHT, c.d, c.cx, 0, c.cz);
    }
    // La losa es real: el granjero se apoya en ella al subir por la escalera
    solid(
      'almacenLosaHit',
      LOFT.w,
      LOFT_THICKNESS,
      LOFT.d,
      LOFT.cx,
      LOFT_HEIGHT - LOFT_THICKNESS,
      LOFT.cz,
    );
    for (const c of LOFT_COLLIDERS) {
      solid(`almacen_${c.name}`, c.w, LOFT_SOLID_HEIGHT, c.d, c.cx, LOFT_HEIGHT, c.cz);
    }

    this._buildSigns(labels);
    const root = new TransformNode('almacenRoot', scene);
    root.position.set(x, 0, z);
    void this._load(root, this._buildFallback(root));
  }

  // Rótulo con el recurso de cada estantería y de cada box de pienso.
  private _buildSigns(labels: WarehouseLabels): void {
    const sign = (name: string, text: string, w: number, x: number, y: number, z: number) => {
      const h = 0.34;
      const tex = new DynamicTexture(
        'almacenRotuloTex',
        { width: 512, height: Math.round((512 * h) / w) },
        this.scene,
        true,
      );
      const size = tex.getSize();
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      ctx.fillStyle = '#3a2614';
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.fillStyle = '#f6e7c4';
      ctx.font = `bold ${Math.round(size.height * 0.62)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, size.width / 2, size.height / 2 + 2);
      tex.update();
      const mat = new StandardMaterial('almacenRotuloMat', this.scene);
      mat.diffuseTexture = tex;
      mat.emissiveColor = new Color3(0.45, 0.45, 0.45);
      mat.specularColor = Color3.Black();
      const plane = MeshBuilder.CreatePlane(name, { width: w, height: h }, this.scene);
      plane.position.set(x, y, z);
      plane.rotation.y = Math.PI; // mira a +z, hacia la cámara
      plane.material = mat;
      return plane;
    };
    for (const s of WAREHOUSE_SHELVES) {
      const c = s.collider;
      const base = s.level === 1 ? LOFT_HEIGHT : 0;
      const m = sign(
        `rotulo_${s.id}`,
        labels.shelf(s.kind, s.id),
        1.46,
        c.cx,
        base + 1.98,
        c.cz + c.d / 2 + 0.02,
      );
      if (s.level === 1) this.loftMeshes.push(m);
    }
    for (const b of WAREHOUSE_FEED_BAYS) {
      // En el poste que cierra el box por el norte
      sign(
        `rotulo_pienso_${b.animal}`,
        labels.feed(b.animal),
        1.2,
        b.cx - b.w / 2 - 0.1,
        1.42,
        b.cz - b.d / 2 + 0.1,
      );
    }
  }

  // Almacén de primitivas: suelo, muros, altillo y estanterías, por si falla el GLB.
  private _buildFallback(root: TransformNode): Mesh[] {
    const { x, z, width, depth } = WAREHOUSE;
    const mat = (r: number, g: number, b: number) => {
      const m = new StandardMaterial('almacenMat', this.scene);
      m.diffuseColor = new Color3(r, g, b);
      m.specularColor = Color3.Black();
      return m;
    };
    const box = (
      w: number,
      h: number,
      d: number,
      px: number,
      y0: number,
      pz: number,
      m: StandardMaterial,
    ) => {
      const b = MeshBuilder.CreateBox('almacenPrim', { width: w, height: h, depth: d }, this.scene);
      b.parent = root;
      b.position.set(px, y0 + h / 2, pz);
      b.material = m;
      return b;
    };
    const wall = mat(0.52, 0.3, 0.2);
    const wood = mat(0.6, 0.39, 0.22);
    const rel = (c: { cx: number; cz: number }) => [c.cx - x, c.cz - z] as const;
    const prims = [
      box(width, 0.02, depth, 0, 0, 0, mat(0.62, 0.5, 0.36)),
      box(width, WALL_HEIGHT, 0.2, 0, 0, -depth / 2 - 0.1, wall),
      box(0.2, WALL_HEIGHT, depth, width / 2 + 0.1, 0, 0, wall),
      box(0.2, WALL_HEIGHT, depth, -width / 2 - 0.1, 0, 0, wall),
    ];
    for (const c of GROUND_COLLIDERS) {
      const [px, pz] = rel(c);
      prims.push(box(c.w, GROUND_SOLID_HEIGHT, c.d, px, 0, pz, wood));
    }
    const [lx, lz] = rel(LOFT);
    const slab = box(
      LOFT.w,
      LOFT_THICKNESS,
      LOFT.d,
      lx,
      LOFT_HEIGHT - LOFT_THICKNESS,
      lz,
      mat(0.72, 0.54, 0.33),
    );
    prims.push(slab);
    this.loftMeshes.push(slab);
    for (const c of LOFT_COLLIDERS) {
      const [px, pz] = rel(c);
      const h = c.name === 'barandilla' ? 1 : GROUND_SOLID_HEIGHT;
      const prim = box(c.w, h, c.d, px, LOFT_HEIGHT, pz, wood);
      prims.push(prim);
      this.loftMeshes.push(prim);
    }
    return prims;
  }

  private async _load(root: TransformNode, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        'almacen_interior.glb',
        this.scene,
      );
      // Medidas métricas exactas: las colisiones se apoyan en ellas, no se reescala
      res.meshes[0].parent = root;
      for (const p of prims) {
        this.loftMeshes = this.loftMeshes.filter((m) => m !== p);
        p.dispose(false, true);
      }
      for (const m of res.meshes) {
        if (m.getTotalVertices() === 0) continue;
        // Materiales propios: los del GLB son opacos, ignoran `visibility`, y la
        // planta baja los comparte.
        if (m.name.startsWith('SM_AlmacenAltillo') && m.material instanceof PBRMaterial) {
          const propio = m.material.clone(`${m.material.name}_altillo`);
          m.material = propio;
          this.loftMaterials.push(propio);
        }
        if (m.material instanceof PBRMaterial && m.material.name === 'M_Cristal') {
          this.glass = m.material;
        }
      }
    } catch {
      // fallback: se queda el almacén de primitivas
    }
  }

  // El altillo se aparta con el granjero debajo; la ventana sigue la luz de fuera
  // (`daylight`: 0..1).
  update(dt: number, daylight: number, underLoft: boolean): void {
    const objetivo = underLoft ? LOFT_FADE_ALPHA : 1;
    if (this.loftAlpha !== objetivo) {
      this.loftAlpha += (objetivo - this.loftAlpha) * (1 - Math.exp(-LOFT_FADE_RATE * dt));
      if (Math.abs(objetivo - this.loftAlpha) < 0.005) this.loftAlpha = objetivo;
      for (const m of this.loftMeshes) m.visibility = this.loftAlpha;
      for (const m of this.loftMaterials) {
        m.alpha = this.loftAlpha;
        m.transparencyMode =
          this.loftAlpha < 1 ? PBRMaterial.PBRMATERIAL_ALPHABLEND : PBRMaterial.PBRMATERIAL_OPAQUE;
      }
    }
    if (this.glass) {
      const d = daylight;
      this.glass.emissiveColor.copyFromFloats(0.06 + 0.7 * d, 0.1 + 0.8 * d, 0.22 + 0.75 * d);
    }
  }
}
