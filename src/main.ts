// main.ts: punto de entrada. Crea el motor, el bus de eventos y el estado
// central, y cablea dominio + vistas + UI + guardado. No contiene reglas de
// juego propias: solo wiring e input.
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CannonJSPlugin } from '@babylonjs/core/Physics/v1/Plugins/cannonJSPlugin';
import { Scene } from '@babylonjs/core/scene';
// Babylon se importa por rutas para que Vite descarte lo que no se usa. Las
// piezas que la escena necesita y que solo se registran como efecto lateral
// van aquí, en un único sitio:
import '@babylonjs/loaders/glTF'; // cargador de .glb para SceneLoader
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent'; // scene.enablePhysics
import '@babylonjs/core/Physics/v1/physicsEngineComponent'; // impostores (física V1)
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'; // sombras
import '@babylonjs/core/Particles/particleSystemComponent'; // partículas (riego)
import '@babylonjs/core/Animations/animatable'; // AnimationGroup.start
import '@babylonjs/core/Meshes/thinInstanceMesh'; // thin instances (decorado)
import '@babylonjs/core/Culling/ray'; // scene.createPickingRay (arrastrar el mapa)
import * as CANNON from 'cannon';

import { CONFIG } from './core/constants';
import { EVENTS, EventBus } from './core/events';
import { createInitialState } from './core/store';
import { buildSave, applySave, SaveRepository } from './core/save';
import type { Interaction } from './core/types';

import { BALANCE } from '../data/balance';
import { CROPS } from '../data/crops';
import { FARM_CONFIG, WATERING_CAN_CAPACITY } from '../data/farm';
import { ANIMALS, ANIMAL_FEED, PENS } from '../data/animals';
import { GIFTS } from '../data/gifts';
import { NPC_DEFS } from '../data/npcs';
import { QUEST_DEFS } from '../data/quests';

import { WorldView } from './world/worldView';
import { TREE_SPOTS } from './world/treeSpots';
import {
  SHOPS,
  shopAtDoor,
  shopDoorSpot,
  shopEntry,
  shopExit,
  shopExitAt,
  shopInside,
} from './world/marketLayout';
import { ShopInteriorView } from './world/shopInteriorView';
import { canSleep } from './world/sleep';
import { canEnterDoor, DOOR_SPOT } from './world/farmerPorch';
import { HomeInteriorView } from './world/homeInteriorView';
import {
  BED_WAKE,
  canReachBed,
  canReachExit,
  FARMER_BED,
  HOME_INTERIOR,
  INTERIOR_ENTRY,
  INTERIOR_EXIT,
  isIndoors,
} from './world/homeInterior';
import {
  canClimbDown,
  canClimbUp,
  canEnterStorage,
  canLeaveWarehouse,
  isInWarehouse,
  isUnderLoft,
  LADDER_FOOT,
  LADDER_PATH,
  LADDER_TOP,
  STORAGE_DOOR_SPOT,
  WAREHOUSE,
  WAREHOUSE_ENTRY,
  WAREHOUSE_EXIT,
  warehouseSpotAt,
} from './world/warehouse';
import { WarehouseView } from './world/warehouseView';
import { SceneryView } from './world/sceneryView';
import { PlayerView } from './player/playerView';
import { FarmLogic } from './crops/farmLogic';
import { FarmView } from './crops/farmView';
import { AnimalLogic } from './animals/animalLogic';
import { AnimalView } from './animals/animalView';
import { Economy } from './economy/economy';
import { Friendship } from './npcs/friendship';
import { NPCSystemView } from './npcs/npcView';
import { QuestSystem } from './quests/questSystem';
import { GameUI } from './ui/ui';

// ---------- Motor y escena ----------
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { powerPreference: 'high-performance' });
const scene = new Scene(engine);

// Sin GPU real (render por software) el relleno de píxeles es el cuello de
// botella: bajamos resolución interna y desactivamos sombras para ser jugables.
const glRenderer = (engine.getGlInfo().renderer || '').toLowerCase();
const lowSpec = /swiftshader|software|llvmpipe/.test(glRenderer);
if (lowSpec) engine.setHardwareScalingLevel(2);

// Mismo tope que el bucle principal: con pocos FPS, un paso de física de hasta
// 1 s (el valor por defecto) haría atravesar muros y barreras al granjero.
Scene.MaxDeltaTime = 100;

// Física: Cannon.js (ligero, JS puro, suficiente para colisiones caja/estático)
scene.enablePhysics(new Vector3(0, -9.81, 0), new CannonJSPlugin(true, 10, CANNON));

// ---------- Bus de eventos + estado central ----------
const bus = new EventBus();
const state = createInitialState(BALANCE, CROPS, GIFTS, NPC_DEFS, ANIMALS);

// ---------- Sistemas de dominio (sin Babylon) ----------
const farmLogic = new FarmLogic(state, bus, CROPS, FARM_CONFIG.cols * FARM_CONFIG.rows);
const animalLogic = new AnimalLogic(state, bus, ANIMALS, BALANCE.startAnimals);
const economy = new Economy(state, bus, CROPS, GIFTS, ANIMALS, ANIMAL_FEED);
const friendship = new Friendship(state, bus, NPC_DEFS);
const quests = new QuestSystem(state, bus, QUEST_DEFS);

// ---------- Vistas Babylon + UI ----------
const world = new WorldView(scene, bus, { shadows: !lowSpec, pens: PENS });
new SceneryView(scene, world, TREE_SPOTS);
const homeInterior = new HomeInteriorView(scene);
for (const shop of SHOPS) new ShopInteriorView(scene, shop);
const warehouse = new WarehouseView(
  scene,
  {
    shelf: (kind, id) => {
      if (kind === 'seed') return `🌱 ${CROPS[id].name}`;
      return kind === 'crop'
        ? `${CROPS[id].icon} ${CROPS[id].name}`
        : `${ANIMALS[id].productIcon} ${ANIMALS[id].productName}`;
    },
    feed: (animal) => `${ANIMALS[animal].icon} ${ANIMALS[animal].name}`,
  },
  (kind, id) => {
    if (kind === 'seed') return state.seeds[id];
    return kind === 'crop' ? state.produce[id] : state.animalProducts[id];
  },
);
const player = new PlayerView(scene, world);
const farmView = new FarmView(scene, state, bus, farmLogic, FARM_CONFIG, CROPS);
const animalView = new AnimalView(scene, world, state, bus, animalLogic, ANIMALS, PENS);
const ui = new GameUI(
  bus,
  state,
  world,
  quests,
  economy,
  animalLogic,
  CROPS,
  GIFTS,
  ANIMALS,
  ANIMAL_FEED,
);
const npcs = new NPCSystemView(scene, world, state, ui, quests, friendship, NPC_DEFS, CROPS);
const saveRepo = new SaveRepository(window.localStorage);

// Distancia al punto de la manivela para poder girarla (el pozo, con su
// colisión, impide acercarse más desde ese lado).
const CRANK_RADIUS = 0.9;
// Cruzar la puerta es más breve que dormir: basta un instante a oscuras.
const DOOR_HOLD_MS = 150;
// En un interior la cámara no dibuja más allá de la estancia: el pueblo no se
// ve y no cuesta nada.
const INDOORS_MAX_Z = 60;
// Encuadre fijo, algo al sur del centro para que la pista no tape el frente
const HOME_VIEW = { x: HOME_INTERIOR.x, z: HOME_INTERIOR.z + 1.2, zoom: 13 };
const WAREHOUSE_VIEW = { x: WAREHOUSE.x, z: WAREHOUSE.z + 0.6, zoom: 15 };
const SHOP_ZOOM = 11;

// ---------- Cámara de seguimiento estilo Stardew ----------
// Vista aérea con orientación fija (pitch 45°, mirando hacia -z): la cámara
// sigue al personaje centrada, con suavizado exponencial, y nunca gira.
// La rueda del ratón ajusta el zoom (acercar/alejar manteniendo el ángulo).
// Arrastrar con el botón izquierdo mueve el mapa y suelta al personaje; la
// cámara vuelve a seguirlo cuando camina y se sale del encuadre.
const camera = new FreeCamera('cam', new Vector3(0, 12, 24), scene);
const OUTDOORS_MAX_Z = camera.maxZ;
const camTarget = new Vector3(0, 0, 12); // punto de mira, arranca en el jugador
const camLookAt = new Vector3(0, 1, 12); // scratch para setTarget
let camZoom: number = CONFIG.camZoomStart;
let camFree = false; // el jugador ha movido el mapa: la cámara no sigue al granjero
let dragging = false;
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const VIEW_MARGIN = 0.1; // borde de pantalla que ya cuenta como fuera (lo tapa el HUD)
const playerScreen = new Vector3(); // scratch para proyectar al granjero
const dragAnchor = new Vector3(); // punto del suelo agarrado al pulsar
const dragPoint = new Vector3(); // punto del suelo bajo el cursor
const IDENTITY = Matrix.Identity();

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camZoom = Math.min(
    CONFIG.camZoomMax,
    Math.max(CONFIG.camZoomMin, camZoom + Math.sign(e.deltaY) * 1.5),
  );
});

function placeCamera(zoom: number): void {
  // Altura = distancia → pitch de 45°. Mirar al objetivo suavizado (no al
  // jugador directo) mantiene la orientación exactamente fija.
  camera.position.set(camTarget.x, zoom, camTarget.z + zoom);
  camLookAt.set(camTarget.x, 1, camTarget.z);
  camera.setTarget(camLookAt);
}

// Punto del suelo (y = 0) bajo el píxel (x, y) del canvas.
function groundAt(x: number, y: number, out: Vector3): boolean {
  const ray = scene.createPickingRay(x, y, IDENTITY, camera);
  if (ray.direction.y > -1e-3) return false;
  const t = -ray.origin.y / ray.direction.y;
  out.set(ray.origin.x + ray.direction.x * t, 0, ray.origin.z + ray.direction.z * t);
  return true;
}

// Arrastre: el punto del suelo agarrado se queda bajo el cursor.
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || world.indoors || !groundAt(e.offsetX, e.offsetY, dragAnchor)) return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || !groundAt(e.offsetX, e.offsetY, dragPoint)) return;
  camFree = true;
  const half = CONFIG.groundSize / 2;
  camTarget.x = Math.min(half, Math.max(-half, camTarget.x + dragAnchor.x - dragPoint.x));
  camTarget.z = Math.min(half, Math.max(-half, camTarget.z + dragAnchor.z - dragPoint.z));
  placeCamera(camZoom); // al momento: el siguiente movimiento se mide con la cámara nueva
});
const endDrag = (e: PointerEvent) => {
  if (!dragging) return;
  dragging = false;
  canvas.releasePointerCapture(e.pointerId);
  canvas.classList.remove('dragging');
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ¿Se ve el granjero? Se proyecta a pantalla con la cámara actual.
function playerOnScreen(): boolean {
  const w = engine.getRenderWidth();
  const h = engine.getRenderHeight();
  Vector3.ProjectToRef(
    player.position,
    Matrix.IdentityReadOnly,
    scene.getTransformMatrix(),
    camera.viewport.toGlobal(w, h),
    playerScreen,
  );
  const mx = w * VIEW_MARGIN;
  const my = h * VIEW_MARGIN;
  return (
    playerScreen.z >= 0 &&
    playerScreen.z <= 1 &&
    playerScreen.x > mx &&
    playerScreen.x < w - mx &&
    playerScreen.y > my &&
    playerScreen.y < h - my
  );
}

function interiorViewAt(x: number, z: number): typeof HOME_VIEW | null {
  if (isIndoors(x, z)) return HOME_VIEW;
  if (isInWarehouse(x, z)) return WAREHOUSE_VIEW;
  const tienda = shopInside(x, z);
  // Algo al sur del centro, como en casa, para ver el mostrador sin la pista encima
  return tienda ? { x: tienda.inside.x, z: tienda.inside.z + 0.8, zoom: SHOP_ZOOM } : null;
}

function updateCamera(dt: number): void {
  // En un interior, la cámara queda fija con toda la estancia en el encuadre
  const vista = interiorViewAt(player.position.x, player.position.z);
  const p = vista ?? player.position;
  const zoom = vista ? vista.zoom : camZoom;
  if (vista) camFree = false; // los interiores tienen encuadre fijo
  // Mapa movido a mano: solo vuelve al granjero si camina fuera del encuadre
  if (camFree && !dragging && MOVE_KEYS.some((k) => keys[k]) && !playerOnScreen()) {
    camFree = false;
  }
  if (!camFree) {
    // Suavizado de posición independiente del framerate (≈5/s)
    const alpha = 1 - Math.exp(-5 * dt);
    camTarget.x += (p.x - camTarget.x) * alpha;
    camTarget.z += (p.z - camTarget.z) * alpha;
  }
  placeCamera(zoom);
}

// ---------- Guardado / carga ----------
function saveGame(silent = false): void {
  const data = buildSave(state, farmLogic, quests, animalLogic);
  if (saveRepo.save(data) && !silent) bus.emit(EVENTS.NOTIFY, '💾 Partida guardada');
}

function loadGame(): boolean {
  const data = saveRepo.load();
  const ok = applySave(data, state, farmLogic, quests, animalLogic);
  if (ok) bus.emit(EVENTS.INVENTORY_CHANGED); // el HUD se pintó antes de cargar
  return ok;
}

// ---------- Riego: el granjero anima la regadera sobre el surco ----------
bus.on(EVENTS.FARM_WATERED, ({ index }) => player.playWater(farmView.tiles[index]));
// Pozo: con P junto a la manivela el cubo baja y sube; al llegar arriba se
// llena la regadera. Sin el GLB no hay cubo que animar y se llena al momento.
function nearCrank(): boolean {
  const c = world.wellCrank;
  const p = player.position;
  return Math.hypot(p.x - c.x, p.z - c.z) < CRANK_RADIUS;
}

function drawWater(): void {
  if (!farmLogic.canRefill() || player.busy || ui.modalOpen || !nearCrank()) return;
  if (!world.wellView) {
    farmLogic.refillWater();
    return;
  }
  const segundos = world.wellView.play(() => farmLogic.refillWater());
  player.playRefill(world.well, segundos);
}

// ---------- Casa y almacén: entrar, salir y dormir ----------
// La puerta cambia de escenario: con la pantalla a oscuras el granjero pasa a
// la estancia (homeInterior, warehouse) o vuelve afuera, y la cámara va con él.
function moveThroughDoor(x: number, z: number, heading: number): void {
  ui.fadeToBlack(() => {
    player.teleport(x, z, heading);
    const foco = interiorViewAt(x, z) ?? { x, z };
    camFree = false;
    camTarget.x = foco.x;
    camTarget.z = foco.z;
  }, DOOR_HOLD_MS);
}

// Fundido a negro; con la pantalla a oscuras empieza el día siguiente y el
// granjero despierta junto a la cama.
function sleep(): void {
  ui.fadeToBlack(() => {
    world.sleep(state.day);
    player.teleport(BED_WAKE.x, BED_WAKE.z);
  });
}

// ---------- Ciclo de día nuevo ----------
bus.on(EVENTS.DAY_NEW, ({ day }) => {
  state.day = day;
  state.talkedToday = {};
  farmLogic.newDay();
  animalLogic.newDay();
  bus.emit(EVENTS.NOTIFY, `🌅 Comienza el día ${state.day}`);
  saveGame(true);
  bus.emit(EVENTS.NOTIFY, '💾 Autoguardado');
});

// ---------- Interacciones ----------
function findInteraction(): Interaction | null {
  const p = player.position;
  const candidates: Interaction[] = [];

  const f = farmView.getInteraction(p);
  if (f) candidates.push(f);

  const a = animalView.getInteraction(p);
  if (a) candidates.push(a);

  const n = npcs.getInteraction(p);
  if (n) candidates.push(n);

  // Tiendas del mercado: se entra por su puerta; dentro se compra al tendero
  const tienda = shopAtDoor(p.x, p.z);
  if (tienda) {
    const e = shopEntry(tienda);
    candidates.push({
      dist: 0, // justo delante de la puerta no hay nada más que hacer
      label: `Intro ↵: Entrar en ${tienda.name} 🛒`,
      action: () => moveThroughDoor(e.x, e.z, Math.PI),
      key: 'enter',
    });
  }
  const salida = shopExitAt(p.x, p.z);
  if (salida) {
    const fuera = shopDoorSpot(salida);
    const puerta = shopExit(salida);
    candidates.push({
      dist: Math.hypot(p.x - puerta.x, p.z - puerta.z),
      label: `Intro ↵: Salir ${salida.name.startsWith('el ') ? `del ${salida.name.slice(3)}` : `de ${salida.name}`} 🚪`,
      action: () => moveThroughDoor(fuera.x, fuera.z, 0),
      key: 'enter',
    });
  }

  const bin = world.sellBin;
  const dBin = Math.hypot(p.x - bin.x, p.z - bin.z);
  if (dBin < CONFIG.interactionRadius) {
    candidates.push({
      dist: dBin,
      label: 'E: Vender cosecha y productos de granja',
      action: () => {
        const total = economy.sellAllProduce();
        bus.emit(
          EVENTS.NOTIFY,
          total > 0 ? `💰 Vendiste la cosecha por ${total} 🪙` : '🧺 No tienes nada para vender',
        );
      },
    });
  }

  if (canEnterDoor(p.x, p.z)) {
    candidates.push({
      dist: 0, // justo delante de la puerta no hay nada más que hacer
      label: 'Intro ↵: Entrar en casa 🏠',
      action: () => moveThroughDoor(INTERIOR_ENTRY.x, INTERIOR_ENTRY.z, Math.PI),
      key: 'enter',
    });
  }

  if (canReachExit(p.x, p.z)) {
    candidates.push({
      dist: Math.hypot(p.x - INTERIOR_EXIT.x, p.z - INTERIOR_EXIT.z),
      label: 'Intro ↵: Salir de casa 🚪',
      action: () => moveThroughDoor(DOOR_SPOT.x, DOOR_SPOT.z, -Math.PI / 2),
      key: 'enter',
    });
  }

  if (canEnterStorage(p.x, p.z)) {
    candidates.push({
      dist: 0, // justo delante de la puerta no hay nada más que hacer
      label: 'Intro ↵: Entrar en el almacén 📦',
      action: () => moveThroughDoor(WAREHOUSE_ENTRY.x, WAREHOUSE_ENTRY.z, Math.PI / 2),
      key: 'enter',
    });
  }

  if (canLeaveWarehouse(p.x, p.z, p.y)) {
    candidates.push({
      dist: Math.hypot(p.x - WAREHOUSE_EXIT.x, p.z - WAREHOUSE_EXIT.z),
      label: 'Intro ↵: Salir del almacén 🚪',
      action: () => moveThroughDoor(STORAGE_DOOR_SPOT.x, STORAGE_DOOR_SPOT.z, -Math.PI / 2),
      key: 'enter',
    });
  }

  if (canClimbUp(p.x, p.z, p.y)) {
    candidates.push({
      dist: Math.hypot(p.x - LADDER_FOOT.x, p.z - LADDER_FOOT.z),
      label: 'Intro ↵: Subir al altillo 🪜',
      action: () => player.climb(LADDER_PATH),
      key: 'enter',
    });
  }

  if (canClimbDown(p.x, p.z, p.y)) {
    candidates.push({
      dist: Math.hypot(p.x - LADDER_TOP.x, p.z - LADDER_TOP.z),
      label: 'Intro ↵: Bajar por la escalera 🪜',
      action: () => player.climb([...LADDER_PATH].reverse()),
      key: 'enter',
    });
  }

  const spot = warehouseSpotAt(p.x, p.z, p.y);
  if (spot?.type === 'shelf') {
    let label: string;
    if (spot.kind === 'seed') {
      label = `🌱 Semillas de ${CROPS[spot.id].name}: ${state.seeds[spot.id]}`;
    } else if (spot.kind === 'crop') {
      label = `${CROPS[spot.id].icon} Estantería de ${CROPS[spot.id].name}: ${state.produce[spot.id]}`;
    } else {
      label = `${ANIMALS[spot.id].productIcon} Estantería de ${ANIMALS[spot.id].productName}: ${state.animalProducts[spot.id]}`;
    }
    candidates.push({ dist: spot.dist, label, action: null });
  } else if (spot?.type === 'feed') {
    const a = ANIMALS[spot.animal];
    candidates.push({
      dist: spot.dist,
      label: `${a.icon} Pienso para ${a.name}: tienes ${state.feed} ${ANIMAL_FEED.icon}`,
      action: null,
    });
  }

  if (canReachBed(p.x, p.z)) {
    const puede = canSleep(world.getHour(), BALANCE.sleepFromHour);
    candidates.push({
      dist: Math.hypot(p.x - FARMER_BED.x, p.z - FARMER_BED.z),
      label: puede
        ? 'E: Dormir hasta mañana 🛏️'
        : `🛏️ Tu cama — podrás dormir a partir de las ${BALANCE.sleepFromHour}:00`,
      action: puede ? sleep : null,
    });
  }

  const well = world.well;
  const dWell = Math.hypot(p.x - well.x, p.z - well.z);
  if (dWell < CONFIG.interactionRadius || nearCrank()) {
    const agua = `💧 ${state.water}/${WATERING_CAN_CAPACITY}`;
    let label = `Regadera llena ${agua}`;
    if (farmLogic.canRefill()) {
      label = nearCrank()
        ? `P: Girar la manivela y llenar la regadera (${agua})`
        : `Ve al lado de la manivela para llenar la regadera (${agua})`;
    }
    candidates.push({
      dist: Math.min(dWell, Math.hypot(p.x - world.wellCrank.x, p.z - world.wellCrank.z)),
      label,
      action: farmLogic.canRefill() && nearCrank() ? drawWater : null,
      key: 'p',
    });
  }

  // Lo que se puede hacer gana a los avisos sin acción; después, lo más cercano.
  // Así, entre la parcela y el pozo, "Llenar la regadera" no queda tapado.
  candidates.sort((a, b) => Number(!a.action) - Number(!b.action) || a.dist - b.dist);
  return candidates[0] || null;
}

// ---------- Entrada por teclado ----------
const keys: Record<string, boolean> = {};
let currentInteraction: Interaction | null = null;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();

  if ((k === 'e' || k === 'enter') && !e.repeat) {
    const i = currentInteraction;
    if (!ui.modalOpen && i && i.action && (i.key ?? 'e') === k) i.action();
  } else if (k === 'p' && !e.repeat) {
    drawWater(); // el pozo responde a P aunque otra interacción ocupe la pista
  } else if (k === 'escape') {
    ui.closeModals();
  } else if (k === 'h' && !e.repeat) {
    ui.toggleHelp();
  } else if (['1', '2', '3'].includes(k)) {
    const types = Object.keys(CROPS);
    const type = types[Number(k) - 1];
    if (type) {
      state.selectedSeed = type;
      bus.emit(EVENTS.INVENTORY_CHANGED);
      bus.emit(EVENTS.NOTIFY, `🌱 Semilla seleccionada: ${CROPS[type].icon} ${CROPS[type].name}`);
    }
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ---------- Botones del HUD ----------
document.getElementById('btn-save')!.addEventListener('click', (ev) => {
  (ev.currentTarget as HTMLElement).blur();
  saveGame();
});
document.getElementById('btn-help')!.addEventListener('click', (ev) => {
  (ev.currentTarget as HTMLElement).blur();
  ui.toggleHelp();
});
document.getElementById('btn-new')!.addEventListener('click', (ev) => {
  (ev.currentTarget as HTMLElement).blur();
  if (window.confirm('¿Borrar la partida guardada y empezar de nuevo?')) {
    saveRepo.clear();
    window.location.reload();
  }
});

// ---------- Inicio ----------
const loaded = loadGame();
if (loaded) bus.emit(EVENTS.NOTIFY, '💾 Partida cargada. ¡Bienvenido de nuevo!');
else ui.toggleHelp(true); // primera vez: mostrar ayuda

// ---------- Bucle principal ----------
engine.runRenderLoop(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.1); // tope anti-saltos
  // Se deduce de la posición: el escenario no puede quedar desfasado del granjero
  const { x: px, y: py, z: pz } = player.position;
  world.indoors = interiorViewAt(px, pz) !== null;
  camera.maxZ = world.indoors ? INDOORS_MAX_Z : OUTDOORS_MAX_Z;
  document.body.classList.toggle('indoors', world.indoors); // el CSS oculta el HUD de fuera
  world.update(dt, state.day);
  homeInterior.update(dt, world.daylight);
  warehouse.update(dt, world.daylight, isUnderLoft(px, pz, py));

  const canMove = !ui.modalOpen && !player.busy;
  player.update(dt, keys, canMove);
  npcs.update(dt);
  animalView.update(dt);
  updateCamera(dt);

  currentInteraction = canMove ? findInteraction() : null;
  ui.showHint(currentInteraction ? currentInteraction.label : null);
  ui.tick();

  scene.render();
});

window.addEventListener('resize', () => engine.resize());
