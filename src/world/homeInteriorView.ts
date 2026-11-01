// HomeInteriorView (vista Babylon): la estancia de la casa del granjero, un
// escenario propio lejos del pueblo al que se llega por la puerta. Colisiones
// fijas independientes del GLB (assets/casa_interior/) y primitivas de respaldo
// si falla la carga. Sin reglas de juego.
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import type { Mesh, Scene } from '@babylonjs/core';
import { FARMER_BED, HOME_INTERIOR, INTERIOR_COLLIDERS } from './homeInterior';

const WALL_HEIGHT = 2.7;

export class HomeInteriorView {
  scene: Scene;
  private fire: PointLight | null = null; // luz del hogar, solo afecta a la estancia
  private glass: PBRMaterial | null = null; // la ventana deja ver el día o la noche
  private time = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    const { x, z, width, depth } = HOME_INTERIOR;

    const solid = (name: string, w: number, h: number, d: number, cx: number, cz: number) => {
      const box = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      box.position.set(cx, h / 2, cz);
      box.isVisible = false;
      box.physicsImpostor = new PhysicsImpostor(
        box,
        PhysicsImpostor.BoxImpostor,
        { mass: 0 },
        scene,
      );
    };
    // Suelo propio: el terreno del pueblo no llega hasta aquí
    const floor = MeshBuilder.CreateBox(
      'interiorFloorHit',
      { width: width + 2, height: 1, depth: depth + 2 },
      scene,
    );
    floor.position.set(x, -0.5, z);
    floor.isVisible = false;
    floor.physicsImpostor = new PhysicsImpostor(
      floor,
      PhysicsImpostor.BoxImpostor,
      { mass: 0 },
      scene,
    );
    for (const c of INTERIOR_COLLIDERS) solid(`interior_${c.name}`, c.w, 3, c.d, c.cx, c.cz);

    const root = new TransformNode('interiorRoot', scene);
    root.position.set(x, 0, z);
    void this._load(root, this._buildFallback(root));
  }

  // Estancia de primitivas: suelo, tres muros y la cama, para poder dormir.
  private _buildFallback(root: TransformNode): Mesh[] {
    const { x, z, width, depth } = HOME_INTERIOR;
    const mat = (r: number, g: number, b: number) => {
      const m = new StandardMaterial('interiorMat', this.scene);
      m.diffuseColor = new Color3(r, g, b);
      m.specularColor = Color3.Black();
      return m;
    };
    const box = (w: number, h: number, d: number, px: number, pz: number, m: StandardMaterial) => {
      const b = MeshBuilder.CreateBox(
        'interiorPrim',
        { width: w, height: h, depth: d },
        this.scene,
      );
      b.parent = root;
      b.position.set(px, h / 2, pz);
      b.material = m;
      return b;
    };
    const wall = mat(0.9, 0.81, 0.65);
    return [
      box(width, 0.02, depth, 0, 0, mat(0.55, 0.39, 0.24)),
      box(width, WALL_HEIGHT, 0.2, 0, -depth / 2 - 0.1, wall),
      box(0.2, WALL_HEIGHT, depth, width / 2 + 0.1, 0, wall),
      box(0.2, WALL_HEIGHT, depth, -width / 2 - 0.1, 0, wall),
      box(1.7, 0.6, 2.15, FARMER_BED.x - x, FARMER_BED.z - z, mat(0.7, 0.24, 0.2)),
    ];
  }

  private async _load(root: TransformNode, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        'casa_interior.glb',
        this.scene,
      );
      // Medidas métricas exactas: las colisiones se apoyan en ellas, no se reescala
      res.meshes[0].parent = root;
      const meshes = res.meshes.filter((m) => m.getTotalVertices() > 0);
      for (const m of meshes) {
        if (m.material instanceof PBRMaterial && m.material.name === 'M_Cristal') {
          this.glass = m.material;
        }
      }
      for (const p of prims) p.dispose(false, true);

      const { x, z } = HOME_INTERIOR;
      this.fire = new PointLight('hogarLuz', new Vector3(x - 6.9, 0.7, z + 2.2), this.scene);
      this.fire.diffuse = new Color3(1, 0.62, 0.3);
      this.fire.specular = Color3.Black();
      this.fire.range = 12;
      this.fire.includedOnlyMeshes = meshes;
    } catch {
      // fallback: se queda la estancia de primitivas
    }
  }

  // El fuego parpadea y la ventana sigue la luz de fuera (`daylight`: 0..1).
  update(dt: number, daylight: number): void {
    this.time += dt;
    if (this.fire) {
      const t = this.time;
      this.fire.intensity = 9 + 1.6 * Math.sin(t * 7.3) + 1.1 * Math.sin(t * 13.1);
    }
    if (this.glass) {
      const d = daylight;
      this.glass.emissiveColor.copyFromFloats(0.06 + 0.7 * d, 0.1 + 0.8 * d, 0.22 + 0.75 * d);
    }
  }
}
