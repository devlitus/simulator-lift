// main.ts: punto de entrada. Crea el motor, el bus de eventos y el estado
// central, y cablea dominio + vistas + UI + guardado. No contiene reglas de
// juego propias: solo wiring e input.
import { CONFIG } from './core/constants';
import { EVENTS, EventBus } from './core/events';
import { createInitialState } from './core/store';
import { buildSave, applySave, SaveRepository } from './core/save';
import type { Interaction } from './core/types';

import { BALANCE } from '../data/balance';
import { CROPS } from '../data/crops';
import { FARM_CONFIG } from '../data/farm';
import { ANIMALS, ANIMAL_FEED, PEN } from '../data/animals';
import { GIFTS } from '../data/gifts';
import { NPC_DEFS } from '../data/npcs';
import { QUEST_DEFS } from '../data/quests';

import { WorldView } from './world/worldView';
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
const engine = new BABYLON.Engine(canvas, true, { powerPreference: 'high-performance' });
const scene = new BABYLON.Scene(engine);

// Sin GPU real (render por software) el relleno de píxeles es el cuello de
// botella: bajamos resolución interna y desactivamos sombras para ser jugables.
const glRenderer = (engine.getGlInfo().renderer || '').toLowerCase();
const lowSpec = /swiftshader|software|llvmpipe/.test(glRenderer);
if (lowSpec) engine.setHardwareScalingLevel(2);

// Física: Cannon.js (ligero, JS puro, suficiente para colisiones caja/estático)
scene.enablePhysics(
  new BABYLON.Vector3(0, -9.81, 0),
  new BABYLON.CannonJSPlugin(true, 10, window.CANNON),
);

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

// ---------- Cámara de seguimiento estilo Stardew ----------
// Vista aérea con orientación fija (pitch 45°, mirando hacia -z): la cámara
// sigue al personaje centrada, con suavizado exponencial, y nunca gira.
// La rueda del ratón ajusta el zoom (acercar/alejar manteniendo el ángulo).
const camera = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, 12, 24), scene);
const camTarget = new BABYLON.Vector3(0, 0, 12); // punto de mira, arranca en el jugador
const camLookAt = new BABYLON.Vector3(0, 1, 12); // scratch para setTarget
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
  return applySave(data, state, farmLogic, quests, animalLogic);
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

  candidates.sort((a, b) => a.dist - b.dist);
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
    if (!ui.modalOpen && currentInteraction && currentInteraction.action) {
      currentInteraction.action();
    }
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

  const canMove = !ui.modalOpen;
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
