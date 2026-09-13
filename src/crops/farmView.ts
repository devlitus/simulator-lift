// FarmView (vista Babylon): dibuja la parcela y refleja el estado de FarmLogic.
// No decide reglas: traduce status() de cada surco a meshes (factory de
// primitivas por tipo/etapa) y convierte clics de interacción en llamadas al dominio.
import { EVENTS, EventBus } from '../core/events';
import { CONFIG } from '../core/constants';
import { TILE_STATUS, FarmLogic, type TileStatus } from './farmLogic';
import type { GameState } from '../core/store';
import type { CropDef, FarmConfig } from '../../data/schemas';
import type { Interaction } from '../core/types';

interface FarmTile {
  mesh: any;
  x: number;
  z: number;
  cropMeshes: any[];
  modelRoot: any | null;
  modelMaterials: any[];
}

export class FarmView {
  scene: any;
  state: GameState;
  logic: FarmLogic;
  cfg: FarmConfig;
  crops: Record<string, CropDef>;
  tiles: FarmTile[];
  soilMat: any;
  soilWetMat: any;
  stemMat: any;
  witherMat: any;
  cropMats: Record<string, any>;

  constructor(
    scene: any,
    state: GameState,
    bus: EventBus,
    logic: FarmLogic,
    farmConfig: FarmConfig,
    cropsData: Record<string, CropDef>,
  ) {
    this.scene = scene;
    this.state = state;
    this.logic = logic;
    this.cfg = farmConfig;
    this.crops = cropsData;
    this.tiles = [];

    this.soilMat = this.makeMat(0.3, 0.19, 0.11);
    this.soilWetMat = this.makeMat(0.16, 0.11, 0.07);
    this.stemMat = this.makeMat(0.25, 0.6, 0.25);
    this.witherMat = this.makeMat(0.42, 0.32, 0.16);
    this.cropMats = {};

    const { cols, rows, spacing, origin, tileSize } = farmConfig;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = origin.x + c * spacing;
        const z = origin.z + r * spacing;
        const mesh = BABYLON.MeshBuilder.CreateBox(
          `soil_${r}_${c}`,
          { width: tileSize, height: 0.12, depth: tileSize },
          scene,
        );
        mesh.position.set(x, 0.06, z);
        mesh.material = this.soilMat;
        mesh.receiveShadows = true;
        // Sin impostor físico: el jugador puede caminar sobre los surcos
        this.tiles.push({ mesh, x, z, cropMeshes: [], modelRoot: null, modelMaterials: [] });
      }
    }

    bus.on(EVENTS.FARM_CHANGED, () => this.sync());
    this.sync();
    void this.loadTileModel();
  }

  // Descarga el módulo de tierra una sola vez y crea un clon por surco. Las
  // cajas siguen siendo el respaldo si el GLB o el cargador no están disponibles.
  async loadTileModel(): Promise<void> {
    let imported: any = null;
    const roots: any[] = [];
    try {
      imported = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        '/models/',
        'parcela_plantacion.glb',
        this.scene,
      );
      const template = imported.meshes[0];
      if (!template || !imported.meshes.some((m: any) => m.getTotalVertices() > 0)) {
        throw new Error('Parcela sin malla');
      }

      // No se presupone la escala ni el origen del GLB: se ajusta desde su caja
      // real para que el módulo cubra exactamente tileSize en el plano XZ.
      const { min, max } = template.getHierarchyBoundingVectors(true);
      const span = Math.max(max.x - min.x, max.z - min.z);
      if (span <= 0) throw new Error('Parcela sin dimensiones horizontales');
      const scale = this.cfg.tileSize / span;

      for (let i = 0; i < this.tiles.length; i++) {
        const tile = this.tiles[i];
        const root = new BABYLON.TransformNode(`soil_model_${i}`, this.scene);
        root.scaling.set(scale, scale, scale);
        root.position.set(
          tile.x - ((min.x + max.x) / 2) * scale,
          -min.y * scale,
          tile.z - ((min.z + max.z) / 2) * scale,
        );
        template.instantiateHierarchy(
          root,
          { doNotInstantiate: true },
          (source: any, clone: any) => {
            clone.setEnabled(true);
            clone.receiveShadows = true;
            if (source.material) {
              const material = source.material.clone(
                `soil_model_mat_${i}_${tile.modelMaterials.length}`,
              );
              clone.material = material;
              tile.modelMaterials.push(material);
            }
          },
        );
        tile.modelRoot = root;
        roots.push(root);
      }

      for (const mesh of imported.meshes) mesh.setEnabled(false);
      for (const tile of this.tiles) {
        tile.mesh.dispose();
        tile.mesh = null;
      }
      this.sync();
    } catch {
      for (const root of roots) root.dispose(false, true);
      if (imported) {
        for (const mesh of imported.meshes) mesh.dispose(false, true);
      }
      // fallback: se quedan las cajas de tierra
    }
  }

  makeMat(r: number, g: number, b: number): any {
    const m = new BABYLON.StandardMaterial('cmat', this.scene);
    m.diffuseColor = new BABYLON.Color3(r, g, b);
    m.specularColor = BABYLON.Color3.Black();
    return m;
  }

  cropMat(type: string): any {
    if (!this.cropMats[type]) {
      const m = new BABYLON.StandardMaterial(`crop_${type}`, this.scene);
      m.diffuseColor = BABYLON.Color3.FromHexString(this.crops[type].color);
      m.specularColor = BABYLON.Color3.Black();
      this.cropMats[type] = m;
    }
    return this.cropMats[type];
  }

  // Reconstruye los meshes de todos los surcos según el estado del dominio
  sync(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      this.syncTile(i, this.logic.status(i));
    }
  }

  syncTile(i: number, status: TileStatus): void {
    const t = this.tiles[i];
    for (const m of t.cropMeshes) m.dispose();
    t.cropMeshes = [];
    const crop = status.crop;
    if (t.mesh) t.mesh.material = crop && crop.watered ? this.soilWetMat : this.soilMat;
    this.setTileWetness(t, Boolean(crop?.watered));
    if (!crop) return;

    const add = (mesh: any) => {
      t.cropMeshes.push(mesh);
      return mesh;
    };

    if (status.kind === TILE_STATUS.WITHERED) {
      const stem = add(
        BABYLON.MeshBuilder.CreateCylinder('wstem', { height: 0.35, diameter: 0.08 }, this.scene),
      );
      stem.position.set(t.x, 0.3, t.z);
      stem.rotation.z = 0.7;
      stem.material = this.witherMat;
      return;
    }

    const def = this.crops[crop.type];
    const ratio = Math.min(crop.stage / def.daysToGrow, 1);
    const h = 0.18 + 0.55 * ratio; // altura según etapa de crecimiento

    const stem = add(
      BABYLON.MeshBuilder.CreateCylinder('cstem', { height: h, diameter: 0.09 }, this.scene),
    );
    stem.position.set(t.x, 0.12 + h / 2, t.z);
    stem.material = this.stemMat;

    const leaves = add(
      BABYLON.MeshBuilder.CreateSphere('cleaf', { diameter: 0.25 + 0.25 * ratio }, this.scene),
    );
    leaves.position.set(t.x, 0.12 + h, t.z);
    leaves.material = this.stemMat;

    // Frutos visibles solo en la etapa final
    if (status.kind === TILE_STATUS.MATURE) {
      const mat = this.cropMat(crop.type);
      const offsets = [
        [0.18, 0.75, 0],
        [-0.18, 0.75, 0],
        [0, 1.05, 0],
      ];
      for (const [ox, oy, oz] of offsets) {
        const fruit = add(
          BABYLON.MeshBuilder.CreateSphere('cfruit', { diameter: 0.26 }, this.scene),
        );
        fruit.position.set(t.x + ox, 0.12 + h * oy, t.z + oz);
        fruit.material = mat;
      }
    }
  }

  // Cada instancia recibe su propio material al clonar. Así solo se oscurece
  // la parcela regada, sin alterar las demás ni perder el atlas PBR del GLB.
  setTileWetness(tile: FarmTile, watered: boolean): void {
    const tone = watered ? new BABYLON.Color3(0.58, 0.58, 0.64) : BABYLON.Color3.White();
    for (const material of tile.modelMaterials) {
      if (material.albedoColor) material.albedoColor = tone;
      else if (material.diffuseColor) material.diffuseColor = tone;
    }
  }

  // Interacción contextual del surco más cercano (etiqueta + acción sobre el dominio)
  getInteraction(pos: { x: number; z: number }): Interaction | null {
    let best: Interaction | null = null;
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const d = Math.hypot(pos.x - t.x, pos.z - t.z);
      if (d < CONFIG.tileRadius && (!best || d < best.dist)) {
        best = { dist: d, ...this.describe(i) };
      }
    }
    return best;
  }

  describe(i: number): { label: string; action: (() => void) | null } {
    const s = this.state;
    const status = this.logic.status(i);
    switch (status.kind) {
      case TILE_STATUS.EMPTY: {
        const seed = s.selectedSeed;
        const n = s.seeds[seed];
        if (n > 0) {
          return {
            label: `E: Plantar ${this.crops[seed].icon} ${this.crops[seed].name} (${n} semillas)`,
            action: () => this.logic.plant(i, seed),
          };
        }
        return {
          label: `Sin semillas de ${this.crops[seed].name} (cómpralas en la tienda)`,
          action: null,
        };
      }
      case TILE_STATUS.WITHERED: {
        const def = this.crops[status.crop!.type];
        return { label: `E: Limpiar ${def.name} marchita`, action: () => this.logic.clear(i) };
      }
      case TILE_STATUS.MATURE: {
        const def = this.crops[status.crop!.type];
        return {
          label: `E: Cosechar ${def.icon} ${def.name}`,
          action: () => this.logic.harvest(i),
        };
      }
      default: {
        const c = status.crop!;
        const def = this.crops[c.type];
        if (!c.watered) {
          return {
            label: `E: Regar ${def.name} (${c.stage}/${def.daysToGrow})`,
            action: () => this.logic.water(i),
          };
        }
        return {
          label: `${def.name} regada ✓ — crece mañana (${c.stage}/${def.daysToGrow})`,
          action: null,
        };
      }
    }
  }
}
