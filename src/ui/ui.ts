// GameUI (vista Babylon-adyacente, DOM puro): HUD, diálogos, tienda, ayuda y
// notificaciones. No decide reglas de juego: solo refleja el estado del
// dominio y traduce clics en llamadas a Economy/QuestSystem/etc.
// A diferencia de la v1 (que comparaba un snapshot del estado en cada frame),
// esta versión se suscribe al EventBus: cada sistema de dominio emite el
// evento concreto que cambió y la UI solo reconstruye lo que corresponde.
import { EVENTS, EventBus } from '../core/events';
import type { GameState } from '../core/store';
import type { WorldView } from '../world/worldView';
import type { QuestSystem, Quest } from '../quests/questSystem';
import type { Economy } from '../economy/economy';
import type { AnimalLogic } from '../animals/animalLogic';
import type { AnimalDef, CropDef, FeedDef, GiftDef } from '../../data/schemas';
import type { DialogButton } from '../core/types';

// Los elementos del HUD existen siempre en index.html: el ! es seguro aquí
const $ = (id: string): HTMLElement => document.getElementById(id)!;

export class GameUI {
  bus: EventBus;
  state: GameState;
  world: WorldView;
  quests: QuestSystem;
  economy: Economy;
  animalLogic: AnimalLogic;
  crops: Record<string, CropDef>;
  gifts: Record<string, GiftDef>;
  animals: Record<string, AnimalDef>;
  feedDef: FeedDef;
  el: Record<string, HTMLElement>;

  constructor(
    bus: EventBus,
    state: GameState,
    world: WorldView,
    quests: QuestSystem,
    economy: Economy,
    animalLogic: AnimalLogic,
    cropsData: Record<string, CropDef>,
    giftsData: Record<string, GiftDef>,
    animalsData: Record<string, AnimalDef>,
    feedDef: FeedDef,
  ) {
    this.bus = bus;
    this.state = state;
    this.world = world;
    this.quests = quests;
    this.economy = economy;
    this.animalLogic = animalLogic;
    this.crops = cropsData;
    this.gifts = giftsData;
    this.animals = animalsData;
    this.feedDef = feedDef;

    this.el = {
      money: $('hud-money'),
      day: $('hud-day'),
      time: $('hud-time'),
      questList: $('quest-list'),
      inventory: $('inventory'),
      hint: $('hint'),
      notifications: $('notifications'),
      dialog: $('dialog'),
      dialogName: $('dialog-name'),
      dialogText: $('dialog-text'),
      dialogButtons: $('dialog-buttons'),
      shop: $('shop'),
      shopMoney: $('shop-money'),
      shopItems: $('shop-items'),
      shopClose: $('shop-close'),
      help: $('help'),
      helpClose: $('help-close'),
    };

    this.el.shopClose.addEventListener('click', (ev) => {
      (ev.currentTarget as HTMLElement).blur();
      this.closeShop();
    });
    this.el.helpClose.addEventListener('click', (ev) => {
      (ev.currentTarget as HTMLElement).blur();
      this.toggleHelp(false);
    });

    const refreshShopIfOpen = () => {
      if (!this.el.shop.classList.contains('hidden')) this.renderShop();
    };
    bus.on(EVENTS.NOTIFY, (msg) => this.notify(msg));
    bus.on(EVENTS.INVENTORY_CHANGED, () => {
      this.renderInventory();
      refreshShopIfOpen();
    });
    bus.on(EVENTS.MONEY_CHANGED, refreshShopIfOpen);
    bus.on(EVENTS.ANIMALS_CHANGED, refreshShopIfOpen);
    bus.on(EVENTS.QUEST_CHANGED, () => this.renderQuests());

    this.renderInventory();
    this.renderQuests();
  }

  get modalOpen(): boolean {
    return (
      !this.el.dialog.classList.contains('hidden') ||
      !this.el.shop.classList.contains('hidden') ||
      !this.el.help.classList.contains('hidden')
    );
  }

  // ---------- HUD ----------

  // Llamado en cada frame: solo sincroniza texto (dinero/día/hora cambian
  // constantemente y esto es más barato que comparar snapshots).
  tick(): void {
    this.el.money.textContent = `🪙 ${this.state.money}`;
    this.el.day.textContent = `📅 Día ${this.state.day}`;
    this.el.time.textContent = `🕒 ${this.world.getTimeString()}`;
  }

  renderInventory(): void {
    const s = this.state;
    const parts: string[] = [];

    parts.push('<span class="inv-label">Semillas [1/2/3]</span>');
    parts.push('<span class="inv-section">');
    Object.keys(this.crops).forEach((key) => {
      const sel = s.selectedSeed === key ? ' selected' : '';
      const empty = s.seeds[key] === 0 ? ' empty' : '';
      parts.push(`<span class="item${sel}${empty}">${this.crops[key].icon}×${s.seeds[key]}</span>`);
    });
    parts.push('</span>');

    parts.push('<span class="inv-label">Cosecha</span>');
    parts.push('<span class="inv-section">');
    Object.keys(this.crops).forEach((key) => {
      const empty = s.produce[key] === 0 ? ' empty' : '';
      parts.push(`<span class="item${empty}">${this.crops[key].icon}×${s.produce[key]}</span>`);
    });
    parts.push('</span>');

    parts.push('<span class="inv-label">Granja</span>');
    parts.push('<span class="inv-section">');
    const noFeed = s.feed === 0 ? ' empty' : '';
    parts.push(`<span class="item${noFeed}">${this.feedDef.icon}×${s.feed}</span>`);
    Object.keys(this.animals).forEach((key) => {
      const empty = s.animalProducts[key] === 0 ? ' empty' : '';
      parts.push(
        `<span class="item${empty}">${this.animals[key].productIcon}×${s.animalProducts[key]}</span>`,
      );
    });
    parts.push('</span>');

    parts.push('<span class="inv-label">Regalos</span>');
    parts.push('<span class="inv-section">');
    Object.keys(this.gifts).forEach((key) => {
      const empty = s.gifts[key] === 0 ? ' empty' : '';
      parts.push(`<span class="item${empty}">${this.gifts[key].icon}×${s.gifts[key]}</span>`);
    });
    parts.push('</span>');

    this.el.inventory.innerHTML = parts.join('');
  }

  renderQuests(): void {
    const active = this.quests.active;
    if (active.length === 0) {
      this.el.questList.innerHTML =
        '<div class="empty">Sin misiones activas. Habla con los vecinos.</div>';
      return;
    }
    this.el.questList.innerHTML = active
      .map((q: Quest) => {
        const ready = q.state === 'ready';
        let progress;
        if (ready) {
          progress = `✅ Vuelve con ${q.npcName}`;
        } else {
          const { have, amount } = this.quests.progressOf(q);
          const icon = q.type === 'deliver' ? `${this.crops[q.item!].icon} ` : '';
          progress = `${icon}${have}/${amount}`;
        }
        return `<div class="quest${ready ? ' ready' : ''}">
        <div class="q-title">${q.title}</div>
        <div class="q-desc">${q.desc}</div>
        <div class="q-progress">${progress}</div>
      </div>`;
      })
      .join('');
  }

  // ---------- Pista de interacción ----------

  showHint(text: string | null): void {
    if (!text) {
      this.el.hint.classList.add('hidden');
      return;
    }
    this.el.hint.textContent = text;
    this.el.hint.classList.remove('hidden');
  }

  // ---------- Notificaciones ----------

  notify(msg: string): void {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    this.el.notifications.appendChild(div);
    setTimeout(() => div.remove(), 3600);
  }

  // ---------- Diálogo ----------

  openDialog(name: string, text: string, buttons: DialogButton[]): void {
    this.el.dialogName.textContent = name;
    this.el.dialogText.textContent = text;
    this.setButtons(this.el.dialogButtons, buttons);
    this.el.dialog.classList.remove('hidden');
  }

  closeDialog(): void {
    this.el.dialog.classList.add('hidden');
  }

  setButtons(container: HTMLElement, buttons: DialogButton[]): void {
    container.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.disabled) btn.disabled = true;
      btn.addEventListener('click', (ev) => {
        (ev.currentTarget as HTMLElement).blur();
        b.handler();
      });
      container.appendChild(btn);
    }
  }

  // ---------- Tienda ----------

  openShop(): void {
    this.el.dialog.classList.add('hidden');
    this.renderShop();
    this.el.shop.classList.remove('hidden');
  }

  closeShop(): void {
    this.el.shop.classList.add('hidden');
  }

  renderShop(): void {
    const s = this.state;
    this.el.shopMoney.textContent = `Tus monedas: 🪙 ${s.money}`;
    const rows: HTMLElement[] = [];

    for (const key of Object.keys(this.crops)) {
      const c = this.crops[key];
      rows.push(
        this.shopRow(
          `${c.icon} Semilla de ${c.name} — crece en ${c.daysToGrow} días, se vende a ${c.sellPrice}🪙`,
          `${c.seedPrice} 🪙`,
          `tienes ${s.seeds[key]}`,
          s.money >= c.seedPrice,
          () => this.economy.buySeed(key),
        ),
      );
    }
    for (const key of Object.keys(this.gifts)) {
      const g = this.gifts[key];
      rows.push(
        this.shopRow(
          `${g.icon} ${g.name} — regalo (+${g.points}❤️ de amistad)`,
          `${g.price} 🪙`,
          `tienes ${s.gifts[key]}`,
          s.money >= g.price,
          () => this.economy.buyGift(key),
        ),
      );
    }
    rows.push(
      this.shopRow(
        `${this.feedDef.icon} ${this.feedDef.name} — alimenta a 1 animal durante 1 día`,
        `${this.feedDef.price} 🪙`,
        `tienes ${s.feed}`,
        s.money >= this.feedDef.price,
        () => this.economy.buyFeed(),
      ),
    );
    for (const key of Object.keys(this.animals)) {
      const a = this.animals[key];
      rows.push(
        this.shopRow(
          `${a.icon} ${a.name} — si la alimentas, deja ${a.productName} (${a.productPrice}🪙) cada día`,
          `${a.price} 🪙`,
          `tienes ${this.animalLogic.countOf(key)}`,
          s.money >= a.price,
          () => this.animalLogic.buyAnimal(key),
        ),
      );
    }

    this.el.shopItems.innerHTML = '';
    for (const r of rows) this.el.shopItems.appendChild(r);
  }

  shopRow(
    desc: string,
    price: string,
    owned: string,
    canBuy: boolean,
    onBuy: () => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'shop-row';
    const descEl = document.createElement('span');
    descEl.textContent = desc;
    const ownedEl = document.createElement('span');
    ownedEl.className = 'owned';
    ownedEl.textContent = owned;
    const btn = document.createElement('button');
    btn.textContent = `Comprar (${price})`;
    btn.disabled = !canBuy;
    btn.addEventListener('click', (ev) => {
      (ev.currentTarget as HTMLElement).blur();
      onBuy(); // INVENTORY_CHANGED/MONEY_CHANGED disparan el re-render de la tienda
    });
    row.appendChild(descEl);
    row.appendChild(ownedEl);
    row.appendChild(btn);
    return row;
  }

  // ---------- Ayuda ----------

  toggleHelp(force?: boolean): void {
    const show = force !== undefined ? force : this.el.help.classList.contains('hidden');
    this.el.help.classList.toggle('hidden', !show);
  }

  closeModals(): void {
    this.el.dialog.classList.add('hidden');
    this.el.shop.classList.add('hidden');
    this.el.help.classList.add('hidden');
  }
}
