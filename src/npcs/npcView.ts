// NPCSystemView (vista Babylon): crea los vecinos a partir de data/npcs.ts,
// los mueve por waypoints y gestiona el diálogo (botones → dominio).
// Las reglas de amistad viven en npcs/friendship.ts; esta clase solo
// traduce interacciones del jugador a llamadas del dominio.
import { CONFIG } from '../core/constants';
import { GIFTS, CROP_GIFT_POINTS } from '../../data/gifts';
import type { NpcDef, CropDef } from '../../data/schemas';
import type { GameState } from '../core/store';
import type { WorldView } from '../world/worldView';
import type { GameUI } from '../ui/ui';
import type { QuestSystem } from '../quests/questSystem';
import type { Friendship } from './friendship';
import type { Interaction, DialogButton } from '../core/types';

interface NpcInstance {
  def: NpcDef;
  id: string;
  name: string;
  root: any;
  waypoints: NpcDef['waypoints'];
  wpIndex: number;
  wpDir: number;
  speed: number;
}

export class NPCSystemView {
  scene: any;
  state: GameState;
  ui: GameUI;
  quests: QuestSystem;
  friendship: Friendship;
  crops: Record<string, CropDef>;
  npcs: NpcInstance[];

  constructor(
    scene: any,
    world: WorldView,
    state: GameState,
    ui: GameUI,
    quests: QuestSystem,
    friendship: Friendship,
    npcDefs: NpcDef[],
    cropsData: Record<string, CropDef>,
  ) {
    this.scene = scene;
    this.state = state;
    this.ui = ui;
    this.quests = quests;
    this.friendship = friendship;
    this.crops = cropsData;
    this.npcs = npcDefs.map((def) => this.buildNPC(scene, world, def));
  }

  buildNPC(scene: any, world: WorldView, def: NpcDef): NpcInstance {
    const root = new BABYLON.TransformNode(`npc_${def.id}`, scene);
    root.position.set(def.home.x, 0, def.home.z);

    const mat = (r: number, g: number, b: number) => {
      const m = new BABYLON.StandardMaterial('npcmat', scene);
      m.diffuseColor = new BABYLON.Color3(r, g, b);
      m.specularColor = BABYLON.Color3.Black();
      return m;
    };

    const body = BABYLON.MeshBuilder.CreateCylinder(
      'npcBody',
      { height: 1.0, diameter: 0.55 },
      scene,
    );
    body.parent = root;
    body.position.y = 0.5;
    body.material = mat(...def.color);
    world.addShadow(body);

    const head = BABYLON.MeshBuilder.CreateSphere('npcHead', { diameter: 0.5 }, scene);
    head.parent = root;
    head.position.y = 1.25;
    head.material = mat(0.95, 0.8, 0.65);
    world.addShadow(head);

    // Accesorio distintivo (sombrero / casco / flor)
    let acc;
    if (def.id === 'lila') {
      acc = BABYLON.MeshBuilder.CreateSphere('npcAcc', { diameter: 0.2 }, scene);
      acc.position.set(0.22, 1.5, 0);
      acc.material = mat(0.95, 0.4, 0.4);
    } else {
      acc = BABYLON.MeshBuilder.CreateBox(
        'npcAcc',
        { width: 0.55, height: 0.16, depth: 0.55 },
        scene,
      );
      acc.position.set(0, 1.52, 0);
      acc.material = def.id === 'marta' ? mat(0.7, 0.25, 0.45) : mat(0.25, 0.26, 0.3);
    }
    acc.parent = root;

    return {
      def,
      id: def.id,
      name: def.name,
      root,
      waypoints: def.waypoints,
      wpIndex: 0,
      wpDir: 1,
      speed: 1.2,
    };
  }

  // Movimiento por waypoints (ida y vuelta)
  update(dt: number): void {
    for (const npc of this.npcs) {
      if (!npc.waypoints) continue;
      const [tx, tz] = npc.waypoints[npc.wpIndex];
      const dx = tx - npc.root.position.x;
      const dz = tz - npc.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        npc.wpIndex += npc.wpDir;
        if (npc.wpIndex >= npc.waypoints.length || npc.wpIndex < 0) {
          npc.wpDir *= -1;
          npc.wpIndex += npc.wpDir * 2;
        }
        continue;
      }
      const step = Math.min(npc.speed * dt, dist);
      npc.root.position.x += (dx / dist) * step;
      npc.root.position.z += (dz / dist) * step;
      npc.root.rotation.y = Math.atan2(dx, dz);
    }
  }

  getInteraction(pos: { x: number; z: number }): Interaction | null {
    let best: Interaction | null = null;
    for (const npc of this.npcs) {
      const d = Math.hypot(pos.x - npc.root.position.x, pos.z - npc.root.position.z);
      if (d < CONFIG.interactionRadius && (!best || d < best.dist)) {
        best = { dist: d, label: `E: Hablar con ${npc.name}`, action: () => this.talk(npc, pos) };
      }
    }
    return best;
  }

  talk(npc: NpcInstance, playerPos?: { x: number; z: number }): void {
    // El NPC se gira hacia el jugador
    if (playerPos) {
      npc.root.rotation.y = Math.atan2(
        playerPos.x - npc.root.position.x,
        playerPos.z - npc.root.position.z,
      );
    }

    // Registra la conversación (amistad +1 y aviso a misiones si es la 1ª del día)
    this.friendship.talkTo(npc.id);

    const points = this.friendship.pointsOf(npc.id);
    const text = npc.def.dialogs[this.friendship.levelIndexOf(npc.id)];
    const title = `${npc.name} · ${npc.def.role} — ❤️ ${this.friendship.labelOf(npc.id)} (${points})`;

    const buttons: DialogButton[] = [];

    const avail = this.quests.availableFrom(npc.id);
    if (avail) {
      buttons.push({
        label: `📜 Aceptar misión: ${avail.title}`,
        handler: () => {
          this.quests.start(avail.id);
          this.ui.closeDialog();
        },
      });
    }
    const del = this.quests.deliverableAt(npc.id);
    if (del) {
      buttons.push({
        label: `📦 Entregar ${del.amount} ${this.crops[del.item!].icon} ${this.crops[del.item!].name}`,
        handler: () => {
          this.quests.deliver(npc.id);
          this.ui.closeDialog();
        },
      });
    }
    const ready = this.quests.readyAt(npc.id);
    if (ready) {
      buttons.push({
        label: `✅ Completar: ${ready.title}`,
        handler: () => {
          this.quests.complete(npc.id);
          this.ui.closeDialog();
        },
      });
    }

    buttons.push({ label: '🎁 Regalar', handler: () => this.openGiftMenu(npc) });
    if (npc.def.hasShop) {
      buttons.push({ label: '🛒 Comprar', handler: () => this.ui.openShop() });
    }
    buttons.push({ label: 'Cerrar', handler: () => this.ui.closeDialog() });

    this.ui.openDialog(title, text, buttons);
  }

  openGiftMenu(npc: NpcInstance): void {
    const s = this.state;
    const buttons: DialogButton[] = [];

    for (const gid of Object.keys(GIFTS)) {
      if (s.gifts[gid] > 0) {
        buttons.push({
          label: `${GIFTS[gid].icon} ${GIFTS[gid].name} (x${s.gifts[gid]}) · +${GIFTS[gid].points}❤️`,
          handler: () => this.giveGift(npc, 'gift', gid),
        });
      }
    }
    for (const cid of Object.keys(this.crops)) {
      if (s.produce[cid] > 0) {
        buttons.push({
          label: `${this.crops[cid].icon} ${this.crops[cid].name} (x${s.produce[cid]}) · +${CROP_GIFT_POINTS}❤️`,
          handler: () => this.giveGift(npc, 'crop', cid),
        });
      }
    }

    if (buttons.length === 0) {
      this.ui.openDialog(
        npc.name,
        'No tienes nada para regalar. Cosecha algo en tu granja o compra un regalo en la tienda.',
        [{ label: 'Volver', handler: () => this.talk(npc) }],
      );
      return;
    }

    buttons.push({ label: 'Volver', handler: () => this.talk(npc) });
    this.ui.openDialog(npc.name, `¿Qué quieres regalarle a ${npc.name}?`, buttons);
  }

  giveGift(npc: NpcInstance, kind: 'gift' | 'crop', id: string): void {
    const pts = kind === 'gift' ? GIFTS[id].points : CROP_GIFT_POINTS;
    if (kind === 'gift') this.state.gifts[id]--;
    else this.state.produce[id]--;
    this.friendship.add(npc.id, pts);
    this.ui.closeDialog();
    this.ui.notify(`🎁 A ${npc.name} le encantó tu regalo (+${pts} amistad)`);
  }
}
