// ShopInteriorView (vista Babylon): el interior de una tienda del mercado, un
// escenario propio lejos del pueblo al que se llega por su puerta. Colisiones
// fijas independientes del GLB (assets/tienda_interior/) y primitivas de
// respaldo si falla la carga. Sin reglas de juego.
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsImpostor } from '@babylonjs/core/Physics/v1/physicsImpostor';
import type { Mesh, Scene } from '@babylonjs/core';
import { SHOP_INTERIOR, shopInteriorColliders, type ShopDef } from './marketLayout';

const WALL_HEIGHT = 2.7;

export class ShopInteriorView {
  scene: Scene;

  constructor(scene: Scene, shop: ShopDef) {
    this.scene = scene;
    const { x, z } = shop.inside;
    const { width, depth } = SHOP_INTERIOR;

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
      'shopFloorHit',
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
    for (const c of shopInteriorColliders(shop)) {
      solid(`shop_${shop.kind}_${c.name}`, c.w, 3, c.d, c.cx, c.cz);
    }

    const root = new TransformNode(`shopInteriorRoot_${shop.kind}`, scene);
    root.position.set(x, 0, z);
    void this._load(root, shop.interior, this._buildFallback(root, shop));
  }

  // Estancia de primitivas: suelo, muros, mostrador y estantería.
  private _buildFallback(root: TransformNode, shop: ShopDef): Mesh[] {
    const mat = (r: number, g: number, b: number) => {
      const m = new StandardMaterial('shopInteriorMat', this.scene);
      m.diffuseColor = new Color3(r, g, b);
      m.specularColor = Color3.Black();
      return m;
    };
    const wall = mat(0.92, 0.85, 0.72);
    const wood = mat(0.6, 0.42, 0.26);
    const prims = [
      {
        w: SHOP_INTERIOR.width,
        h: 0.02,
        d: SHOP_INTERIOR.depth,
        cx: 0,
        cz: 0,
        m: mat(0.6, 0.45, 0.3),
      },
    ];
    for (const c of shopInteriorColliders(shop)) {
      const muro = c.name.startsWith('muro');
      if (muro && c.name.startsWith('muroSur')) continue; // deja ver dentro
      prims.push({
        w: c.w,
        h: muro ? WALL_HEIGHT : 1,
        d: c.d,
        cx: c.cx - shop.inside.x,
        cz: c.cz - shop.inside.z,
        m: muro ? wall : wood,
      });
    }
    return prims.map((p) => {
      const b = MeshBuilder.CreateBox(
        'shopInteriorPrim',
        { width: p.w, height: p.h, depth: p.d },
        this.scene,
      );
      b.parent = root;
      b.position.set(p.cx, p.h / 2, p.cz);
      b.material = p.m;
      return b;
    });
  }

  private async _load(root: TransformNode, file: string, prims: Mesh[]): Promise<void> {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/', file, this.scene);
      // Medidas métricas exactas: las colisiones se apoyan en ellas, no se reescala
      res.meshes[0].parent = root;
      for (const p of prims) p.dispose(false, true);

      // Las lámparas del mostrador alumbran la tienda (y solo la tienda): los
      // muros dejan el interior en sombra
      const luz = new PointLight('tiendaLuz', new Vector3(0, 2.2, -0.6), this.scene);
      luz.parent = root;
      luz.diffuse = new Color3(1, 0.8, 0.55);
      luz.specular = Color3.Black();
      luz.intensity = 7;
      luz.range = 14;
      luz.includedOnlyMeshes = res.meshes.filter((m) => m.getTotalVertices() > 0);
    } catch {
      // fallback: se queda la estancia de primitivas
    }
  }
}
