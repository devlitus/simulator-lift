// main.ts: punto de entrada. Crea el motor, el bus de eventos y el estado
// central, y cablea dominio + vistas + UI + guardado. No contiene reglas de
// juego propias: solo wiring e input.
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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
import * as CANNON from 'cannon';

import { CONFIG } from './core/constants';
import { EVENTS, EventBus } from './core/events';
import { createInitialState } from './core/store';
import { buildSave, applySave, SaveRepository } from './core/save';
import type { Interaction } from './core/types';

import { BALANCE } from '../data/balance';
import { CROPS } from '../data/crops';
import { FARM_CONFIG, WATERING_CAN_CAPACITY } from '../data/farm';
import { ANIMALS, ANIMAL_FEED, PEN } from '../data/animals';
import { GIFTS } from '../data/gifts';
import { NPC_DEFS } from '../data/npcs';
import { QUEST_DEFS } from '../data/quests';

import { TREE_SPOTS, WorldView } from './world/worldView';
import { canSleep } from './world/sleep';
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
const world = new WorldView(scene, bus, { shadows: !lowSpec, pen: PEN });
new SceneryView(scene, world, PEN, TREE_SPOTS);
const player = new PlayerView(scene, world);
const farmView = new FarmView(scene, state, bus, farmLogic, FARM_CONFIG, CROPS);
const animalView = new AnimalView(scene, world, state, bus, animalLogic, ANIMALS, PEN);
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

// ---------- Cámara de seguimiento estilo Stardew ----------
// Vista aérea con orientación fija (pitch 45°, mirando hacia -z): la cámara
// sigue al personaje centrada, con suavizado exponencial, y nunca gira.
// La rueda del ratón ajusta el zoom (acercar/alejar manteniendo el ángulo).
const camera = new FreeCamera('cam', new Vector3(0, 12, 24), scene);
const camTarget = new Vector3(0, 0, 12); // punto de mira, arranca en el jugador
const camLookAt = new Vector3(0, 1, 12); // scratch para setTarget
let camZoom: number = CONFIG.camZoomStart;

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camZoom = Math.min(
    CONFIG.camZoomMax,
    Math.max(CONFIG.camZoomMin, camZoom + Math.sign(e.deltaY) * 1.5),
  );
});

function updateCamera(dt: number): void {
  const p = player.position;
  // Suavizado de posición independiente del framerate (≈5/s)
  const alpha = 1 - Math.exp(-5 * dt);
  camTarget.x += (p.x - camTarget.x) * alpha;
  camTarget.z += (p.z - camTarget.z) * alpha;

  // Altura = distancia → pitch de 45°. Mirar al objetivo suavizado (no al
  // jugador directo) mantiene la orientación exactamente fija.
  camera.position.set(camTarget.x, camZoom, camTarget.z + camZoom);
  camLookAt.set(camTarget.x, 1, camTarget.z);
  camera.setTarget(camLookAt);
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

// ---------- Dormir en casa ----------
// Fundido a negro; con la pantalla a oscuras empieza el día siguiente y el
// granjero despierta delante de su puerta.
function sleep(): void {
  ui.fadeSleep(() => {
    world.sleep(state.day);
    player.teleport(world.homeWake.x, world.homeWake.z);
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

  const door = world.homeDoor;
  const dDoor = Math.hypot(p.x - door.x, p.z - door.z);
  if (dDoor < CONFIG.interactionRadius) {
    const puede = canSleep(world.getHour(), BALANCE.sleepFromHour);
    candidates.push({
      dist: dDoor,
      label: puede
        ? 'E: Dormir hasta mañana 🛏️'
        : `🏠 Tu casa — podrás dormir a partir de las ${BALANCE.sleepFromHour}:00`,
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

  if (k === 'e' && !e.repeat) {
    const i = currentInteraction;
    if (!ui.modalOpen && i && i.action && (i.key ?? 'e') === 'e') i.action();
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
  world.update(dt, state.day);

  const canMove = !ui.modalOpen && !player.busy;
  player.update(dt, keys, canMove);
  world.updateStorageCutaway(player.position.x, player.position.z);
  npcs.update(dt);
  animalView.update(dt);
  updateCamera(dt);

  currentInteraction = canMove ? findInteraction() : null;
  ui.showHint(currentInteraction ? currentInteraction.label : null);
  ui.tick();

  scene.render();
});

window.addEventListener('resize', () => engine.resize());
