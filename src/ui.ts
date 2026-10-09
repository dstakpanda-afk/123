import Phaser from 'phaser';
import { BIOMES } from './map';
import { ACHIEVEMENTS, ATTACK_IDS, BOSSES, BOSS_POINTS, CLASSES, KIND_NAME, MAX_SKILL, SKILLS, SKILL_IDS, UTILITY_IDS, STAT_LABEL, StatKey, SUPPORTS, SUPPORT_IDS, fmtStat, fmtStats } from './data';
import { BAG_SIZE, Character, getChar } from './char';
import { Item, RARITY_COLOR, RARITY_NAME, SLOTS, SLOT_NAME, makeItem, sellValue } from './items';
import { CLASS_START, KR, NODES, NODE_LIST, R, SECTORS, TreeNode, sectorColor } from './tree';
import { H, S, W, hex, setupCam, spr } from './gfx';
import { describeSkill, pickGem } from './skills';
import { LOGIN_REWARDS, QUESTS } from './daily';

function btn(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void, fill = 0x22304f, stroke = 0x4d6bb3, size = 14): Phaser.GameObjects.GameObject[] {
  const r = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, stroke).setInteractive();
  const t = scene.add.text(x, y, label, { fontSize: `${size}px`, color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5);
  r.on('pointerup', cb);
  return [r, t];
}
const home = (s: Phaser.Scene) => s.scene.start('menu');
function char(): Character { return getChar() as Character; }
function base(s: Phaser.Scene): void { setupCam(s); s.add.rectangle(0, 0, W, H, 0x0a0814).setOrigin(0).setInteractive(); }

const rad = (d: number) => (d * Math.PI) / 180;

// ================= DRZEWKO =================
const FILTERS = Object.keys(STAT_LABEL) as StatKey[];

export class TreeScene extends Phaser.Scene {
  private c!: Character;
  private world!: Phaser.GameObjects.Container;
  private links!: Phaser.GameObjects.Graphics;
  private circles = new Map<string, Phaser.GameObjects.Arc>();
  private labels: Phaser.GameObjects.Text[] = [];
  private sel: string | null = null;
  private path: string[] | null = null;
  private info!: Phaser.GameObjects.Container;
  private head!: Phaser.GameObjects.Text;
  private filterBtn!: Phaser.GameObjects.Text;
  private resetBtn!: Phaser.GameObjects.Text;
  private zoom = 0.7;
  private pinchD = 0;
  private filter = -1;
  private resetArmed = false;

  constructor() { super('tree'); }
  init(): void { this.c = char(); this.sel = null; this.path = null; this.circles.clear(); this.labels = []; this.zoom = 0.7; this.filter = -1; this.resetArmed = false; this.pinchD = 0; }

  create(): void {
    base(this);
    this.world = this.add.container(0, 0).setScale(this.zoom);
    // tło: kolorowe klinki sektorów i prowadnice pierścieni
    const deco = this.add.graphics();
    SECTORS.forEach((_cid, i) => {
      const a0 = rad(-120 + 60 * i), a1 = rad(-60 + 60 * i);
      deco.fillStyle(sectorColor(i), 0.05).slice(0, 0, KR + 90, a0, a1).fillPath();
      deco.lineStyle(2, sectorColor(i), 0.18).lineBetween(0, 0, Math.cos(a0) * (KR + 90), Math.sin(a0) * (KR + 90));
    });
    for (let k = 1; k <= 7; k++) deco.lineStyle(2, 0x2a2f55, 0.55).strokeCircle(0, 0, R(k));
    deco.lineStyle(3, 0x3a3f70, 0.7).strokeCircle(0, 0, KR + 40);
    this.world.add(deco);
    this.links = this.add.graphics();
    this.world.add(this.links);
    SECTORS.forEach((cid, s) => {
      const a = ((-90 + 60 * s) * Math.PI) / 180;
      this.world.add(this.add.text(Math.cos(a) * (KR + 120), Math.sin(a) * (KR + 120), CLASSES[cid].region.toUpperCase(), { fontSize: '40px', color: hex(sectorColor(s)), fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.7));
    });
    const startClass = Object.fromEntries(Object.entries(CLASS_START).map(([cid, id]) => [id, cid])) as Record<string, keyof typeof CLASSES>;
    NODE_LIST.forEach((n) => {
      const r = n.kind === 'k' ? 20 : n.kind === 'n' ? 14 : n.kind === 'start' ? 20 : n.id === 'c' ? 22 : 9;
      if (n.kind === 'k') this.world.add(this.add.star(n.x, n.y, 4, 22, 34, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.35));
      const circ = this.add.circle(n.x, n.y, r, 0x232a4a).setStrokeStyle(3, 0x5a6392).setInteractive(new Phaser.Geom.Circle(r, r, r + 14), Phaser.Geom.Circle.Contains);
      circ.on('pointerup', (p: Phaser.Input.Pointer) => { if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) < 10 * S) this.select(n.id); });
      this.circles.set(n.id, circ);
      this.world.add(circ);
      if (n.kind === 'start') this.world.add(spr(this, n.x, n.y, `pl_${startClass[n.id]}`).setScale(0.95 / S));
      if (n.kind === 'n' || n.kind === 'k') {
        const t = this.add.text(n.x, n.y + r + 9, n.name, { fontSize: '13px', color: '#e4e9ff', stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5);
        this.labels.push(t); this.world.add(t);
      }
    });
    const st = NODES[this.c.startId];
    this.world.setPosition(W / 2 - st.x * this.zoom, 290 - st.y * this.zoom);
    this.applyZoomUi();

    this.input.addPointer(1);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1, b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / S;
        if (this.pinchD > 0) this.setZoom(this.zoom * (d / this.pinchD), (a.x + b.x) / 2 / S, (a.y + b.y) / 2 / S);
        this.pinchD = d;
        return;
      }
      this.pinchD = 0;
      if (!p.isDown || p.y / S > 520 || p.y / S < 56) return;
      this.world.x += (p.x - p.prevPosition.x) / S; this.world.y += (p.y - p.prevPosition.y) / S;
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1), p.x / S, p.y / S));

    this.add.rectangle(0, 0, W, 60, 0x0a0814).setOrigin(0).setInteractive();
    this.head = this.add.text(8, 6, '', { fontSize: '14px', color: '#ffd86b', fontStyle: 'bold' });
    btn(this, 340, 17, 36, 28, 'X', () => home(this), 0x4a2226, 0xc0392b, 15);
    this.filterBtn = btn(this, 66, 44, 120, 28, '', () => { this.filter = this.filter + 1 >= FILTERS.length ? -1 : this.filter + 1; this.render(); }, 0x22304f, 0x4d6bb3, 11)[1] as Phaser.GameObjects.Text;
    this.resetBtn = btn(this, 176, 44, 96, 28, 'Reset', () => this.onReset(), 0x3a2226, 0x9b4d57, 11)[1] as Phaser.GameObjects.Text;
    btn(this, 266, 44, 36, 28, '+', () => this.setZoom(this.zoom * 1.25), 0x22304f, 0x4d6bb3, 17);
    btn(this, 306, 44, 36, 28, '−', () => this.setZoom(this.zoom / 1.25), 0x22304f, 0x4d6bb3, 17);
    this.info = this.add.container(0, 0);
    this.render();
  }

  private setZoom(z: number, cx = W / 2, cy = 290): void {
    const old = this.zoom;
    this.zoom = Phaser.Math.Clamp(z, 0.25, 1.6);
    const k = this.zoom / old;
    this.world.x = cx - (cx - this.world.x) * k; this.world.y = cy - (cy - this.world.y) * k;
    this.world.setScale(this.zoom);
    this.applyZoomUi();
  }
  private applyZoomUi(): void { const v = this.zoom >= 0.8; this.labels.forEach((t) => t.setVisible(v)); }

  private onReset(): void {
    const cost = this.c.respecCost();
    if (!this.resetArmed) {
      this.resetArmed = true; this.resetBtn.setText(`Na pewno? ${cost} zł`);
      this.time.delayedCall(2500, () => { this.resetArmed = false; this.resetBtn.setText('Reset'); });
      return;
    }
    this.resetArmed = false; this.resetBtn.setText('Reset');
    if (this.c.respec()) { this.c.save(); this.sel = null; this.path = null; this.render(); }
  }

  private select(id: string): void {
    this.sel = id;
    this.path = this.c.alloc.has(id) ? null : this.c.pathTo(id);
    this.render();
  }

  private render(): void {
    const c = this.c;
    this.head.setText(`Punkty: ${c.points}     Złoto: ${c.gold}`);
    this.filterBtn.setText(this.filter < 0 ? 'Filtr: brak' : STAT_LABEL[FILTERS[this.filter]]);
    const inPath = new Set(this.path ?? []);
    this.links.clear();
    NODE_LIST.forEach((n) => n.links.forEach((l) => {
      if (l < n.id) return;
      const o = NODES[l], both = c.alloc.has(n.id) && c.alloc.has(l);
      const pth = (inPath.has(n.id) || c.alloc.has(n.id)) && (inPath.has(l) || c.alloc.has(l)) && (inPath.has(n.id) || inPath.has(l));
      const col = pth ? 0xffffff : both ? sectorColor(n.sector >= 0 ? n.sector : o.sector) : 0x3a4268;
      this.links.lineStyle(pth || both ? 6 : 2.5, col, 1).lineBetween(n.x, n.y, o.x, o.y);
    }));
    const fk = this.filter >= 0 ? FILTERS[this.filter] : null;
    this.circles.forEach((circ, id) => {
      const n = NODES[id], on = c.alloc.has(id), can = !on && n.links.some((l) => c.alloc.has(l));
      const col = n.sector >= 0 ? sectorColor(n.sector) : 0xffd86b;
      const hit = !!fk && !!n.stats[fk];
      circ.setFillStyle(on ? col : can ? 0x353f6e : n.kind === 'n' || n.kind === 'k' ? 0x2a3157 : 0x232a4a);
      circ.setStrokeStyle(id === this.sel || hit ? 5 : 3, id === this.sel || inPath.has(id) ? 0xffffff : hit ? 0xffd86b : on ? 0xffffff : can ? col : n.kind === 'n' || n.kind === 'k' ? col : 0x5a6392);
      circ.setAlpha(fk && !hit ? 0.2 : 1);
    });
    this.info.removeAll(true);
    this.info.add(this.add.rectangle(0, 520, W, 120, 0x141a30).setOrigin(0).setStrokeStyle(2, 0x3a4270).setInteractive());
    if (!this.sel) {
      this.info.add(this.add.text(W / 2, 580, 'Przeciągaj palcem i szczypij, aby przybliżyć.\nDotknij węzła: zobaczysz ścieżkę i koszt.', { fontSize: '13px', color: '#a8b0d0', align: 'center' }).setOrigin(0.5));
      return;
    }
    const n: TreeNode = NODES[this.sel];
    const on = c.alloc.has(n.id);
    const col = n.sector >= 0 ? sectorColor(n.sector) : 0xffd86b;
    const kindTxt = n.kind === 'k' ? '  (kamień węgielny)' : n.kind === 'n' ? '  (znaczący)' : n.kind === 'start' ? '  (start)' : '';
    this.info.add(this.add.text(12, 526, n.name + kindTxt, { fontSize: '16px', color: hex(col), fontStyle: 'bold' }));
    let body = fmtStats(n.stats).join('\n') || (n.kind === 'start' ? 'Punkt startowy klasy' : '');
    if (!on && this.path) body += `\nŚcieżka: ${this.path.length} węzł(ów), koszt ${c.pathCost(this.path)}`;
    if (!on && !this.path) body += '\nBrak ścieżki';
    this.info.add(this.add.text(12, 550, body, { fontSize: '13px', color: '#e4e9ff', wordWrap: { width: 232 }, lineSpacing: 2 }));
    if (on) {
      if (n.id === c.startId) return;
      const ok = c.canRefund(n.id) && c.gold >= c.refundCost(n.id);
      this.info.add(btn(this, 302, 600, 104, 46, c.canRefund(n.id) ? `ZWOLNIJ\n-${c.refundCost(n.id)} zł` : 'Zablokowany\n(trzyma inne)', () => { if (c.refund(n.id)) { c.save(); this.select(n.id); } }, ok ? 0x5a4a22 : 0x22242f, ok ? 0xffd86b : 0x40466a, 12));
    } else if (this.path) {
      const cost = c.pathCost(this.path), ok = cost <= c.points;
      this.info.add(btn(this, 302, 600, 104, 46, ok ? `WYKUP\n(${cost})` : `Brak pkt\n(${cost})`, () => { if (c.allocatePath(this.path as string[])) { c.save(); this.path = null; this.render(); } }, ok ? 0x2b5a3a : 0x22242f, ok ? 0x4ade80 : 0x40466a, 13));
    }
  }
}

// ================= EKWIPUNEK =================
export class InvScene extends Phaser.Scene {
  private c!: Character;
  private tab = 0;
  private sel: Item | null = null;
  private layer!: Phaser.GameObjects.Container;

  constructor() { super('inv'); }
  init(): void { this.c = char(); this.sel = null; }

  create(): void {
    base(this);
    this.layer = this.add.container(0, 0);
    this.render();
  }
  private put(...o: (Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[])[]): void { o.flat().forEach((x) => this.layer.add(x)); }

  private render(): void {
    this.layer.removeAll(true);
    this.put(this.add.text(10, 14, 'EKWIPUNEK', { fontSize: '19px', color: '#c9a4ff', fontStyle: 'bold' }));
    this.put(this.add.text(160, 18, `Złoto: ${this.c.gold}`, { fontSize: '14px', color: '#ffd86b', fontStyle: 'bold' }));
    this.put(btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b, 15));
    ['PRZEDMIOTY', 'STATYSTYKI'].forEach((t, i) =>
      this.put(btn(this, 95 + i * 170, 68, 160, 32, t, () => { this.tab = i; this.sel = null; this.render(); }, this.tab === i ? 0x2b3a66 : 0x151a2c, this.tab === i ? 0xffd86b : 0x333a5c, 12)));
    if (this.tab === 0) this.items(); else this.stats();
  }

  private itemBox(x: number, y: number, it: Item | undefined, slot: string, size = 52): void {
    const sel = it && it === this.sel;
    const r = this.add.rectangle(x, y, size, size, it ? 0x1a2040 : 0x10142a).setStrokeStyle(sel ? 4 : 3, it ? RARITY_COLOR[it.rarity] : 0x2a3050);
    this.put(r);
    const ic = spr(this, x, y - 3, `sl_${it ? it.slot : slot}`).setScale((size * 0.62) / 36 / S);
    if (it) { ic.setTint(RARITY_COLOR[it.rarity]); this.put(ic, this.add.text(x + size / 2 - 4, y + size / 2 - 3, `${it.ilvl}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 1)); }
    else if (slot) { ic.setTint(0x3a4268).setAlpha(0.8); this.put(ic); } else ic.destroy();
    if (it) { r.setInteractive(); r.on('pointerup', () => { this.sel = it; this.render(); }); }
  }

  private items(): void {
    const c = this.c;
    SLOTS.forEach((s, i) => {
      this.itemBox(40 + i * 70, 138, c.equipped[s], s, 58);
      this.put(this.add.text(40 + i * 70, 176, SLOT_NAME[s], { fontSize: '11px', color: '#a8b0d0' }).setOrigin(0.5));
    });
    this.put(this.add.text(12, 198, `Plecak (${c.bag.length}/${BAG_SIZE})`, { fontSize: '13px', color: '#a8b0d0' }));
    for (let i = 0; i < BAG_SIZE; i++) this.itemBox(40 + (i % 6) * 56, 240 + Math.floor(i / 6) * 58, c.bag[i], '', 52);
    this.put(btn(this, 180, 482, 330, 30, 'Sprzedaj zwykłe i magiczne', () => { c.sellBelow(2); c.save(); this.sel = null; this.render(); }, 0x3a3320, 0x9b8a4d, 12));
    const it = this.sel;
    if (!it) { this.put(this.add.text(W / 2, 572, 'Dotknij przedmiotu, aby zobaczyć szczegóły.\nLepsze przedmioty zakładają się same podczas wypraw.', { fontSize: '13px', color: '#a8b0d0', align: 'center' }).setOrigin(0.5)); return; }
    const worn = c.equipped[it.slot] === it;
    this.put(this.add.rectangle(0, 508, W, 132, 0x141a30).setOrigin(0).setStrokeStyle(2, RARITY_COLOR[it.rarity]));
    this.put(this.add.text(10, 512, it.name, { fontSize: '16px', color: hex(RARITY_COLOR[it.rarity]), fontStyle: 'bold' }));
    this.put(this.add.text(10, 534, `${RARITY_NAME[it.rarity]} · ${SLOT_NAME[it.slot].toLowerCase()} · poz. ${it.ilvl}\n${fmtStats(it.stats).join('\n')}`, { fontSize: '13px', color: '#e4e9ff', lineSpacing: 2 }));
    this.put(btn(this, 298, 548, 108, 38, worn ? 'ZDEJMIJ' : 'ZAŁÓŻ', () => { if (worn) c.unequip(it.slot); else c.equip(it); c.save(); this.sel = null; this.render(); }, 0x2b5a3a, 0x4ade80, 14));
    this.put(btn(this, 298, 597, 108, 38, `SPRZEDAJ +${sellValue(it)}`, () => { c.sell(it); c.save(); this.sel = null; this.render(); }, 0x5a4a22, 0xffd86b, 12));
  }

  private stats(): void {
    const st = this.c.stats, keys = Object.keys(STAT_LABEL) as StatKey[];
    this.put(this.add.text(16, 104, [`Maks. życie: ${this.c.maxHp}`, ...keys.map((k) => fmtStat(k, st[k]).replace(/^\+/, ''))].join('\n'), { fontSize: '15px', color: '#e4e9ff', lineSpacing: 6 }));
  }
}

// ================= UMIEJĘTNOŚCI =================
type Sel = { slot: number; idx: number | null } | null; // idx null = slot umiejętności

export class SkillsScene extends Phaser.Scene {
  private c!: Character;
  private sel: Sel = null;
  private note = '';
  private view: 'list' | 'summary' = 'list';
  private page = 0; private pageKey = '';
  private layer!: Phaser.GameObjects.Container;

  constructor() { super('skills'); }
  init(): void { this.c = char(); this.sel = null; this.note = ''; this.view = 'list'; }

  create(): void {
    base(this);
    this.layer = this.add.container(0, 0);
    this.render();
  }
  private put(...o: (Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[])[]): void { o.flat().forEach((x) => this.layer.add(x)); }

  private tile(x: number, y: number, w: number, h: number, stroke: number, selected: boolean, cb: () => void): void {
    const r = this.add.rectangle(x, y, w, h, 0x141a30).setStrokeStyle(selected ? 4 : 2, selected ? 0xffffff : stroke).setInteractive();
    r.on('pointerup', cb);
    this.put(r);
  }

  private render(): void {
    const c = this.c, sel = this.sel;
    this.layer.removeAll(true);
    if (this.view === 'summary' && sel && sel.idx === null && c.loadout[sel.slot].skill) { this.summary(sel.slot); return; }
    this.put(this.add.text(10, 14, 'UMIEJĘTNOŚCI', { fontSize: '19px', color: '#c9a4ff', fontStyle: 'bold' }));
    this.put(btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b, 15));
    this.put(this.add.text(12, 50, 'Główne ataki (po 5 supportów)', { fontSize: '12px', color: '#a8b0d0' }));
    c.loadout.forEach((lo, i) => {
      const y = 80 + i * 40 + (i >= 3 ? 24 : 0);
      if (i === 3) this.put(this.add.text(12, y - 33, 'Pomocnicze (po 2 supporty)', { fontSize: '12px', color: '#a8b0d0' }));
      const sd = lo.skill ? SKILLS[lo.skill] : null;
      this.tile(62, y, 108, 38, sd ? sd.color : 0x2a3050, !!sel && sel.slot === i && sel.idx === null, () => { this.sel = { slot: i, idx: null }; this.note = ''; this.view = lo.skill ? 'summary' : 'list'; this.render(); });
      if (sd && lo.skill) {
        this.put(spr(this, 26, y, `ic_${lo.skill}`).setScale(32 / 44 / S));
        this.put(this.add.text(45, y, sd.name, { fontSize: '10px', color: hex(sd.color), fontStyle: 'bold', wordWrap: { width: 66 } }).setOrigin(0, 0.5));
        this.put(this.add.text(42, y + 18, `${c.skills[lo.skill]}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 1));
      } else this.put(this.add.text(62, y, 'pusty slot', { fontSize: '11px', color: '#5a6392' }).setOrigin(0.5));
      lo.sup.forEach((sid, j) => {
        const sdef = sid ? SUPPORTS[sid] : null;
        this.tile(134 + j * 40, y, 36, 36, sdef ? sdef.color : 0x2a3050, !!sel && sel.slot === i && sel.idx === j, () => { this.sel = { slot: i, idx: j }; this.note = ''; this.render(); });
        this.put(this.add.text(134 + j * 40, y, sdef ? sdef.short : '+', { fontSize: sdef ? '14px' : '16px', color: sdef ? hex(sdef.color) : '#5a6392', fontStyle: 'bold' }).setOrigin(0.5));
      });
    });

    // pasek szczegółów
    this.put(this.add.rectangle(0, 326, W, 64, 0x141a30).setOrigin(0).setStrokeStyle(2, 0x3a4270));
    let detail = this.note || 'Wybierz slot, a potem gem z listy poniżej.';
    let canRemove = false;
    if (sel) {
      const lo = c.loadout[sel.slot];
      if (sel.idx === null) {
        if (lo.skill) { detail = `${SKILLS[lo.skill].name} (${KIND_NAME[SKILLS[lo.skill].kind]}, poz. ${c.skills[lo.skill]}/${MAX_SKILL})\n${SKILLS[lo.skill].desc}`; canRemove = true; }
        else detail = this.note || (sel.slot < 3 ? 'Pusty slot. Wybierz atak z listy.' : 'Pusty slot. Wybierz aurę, wzmocnienie lub sługę.');
      } else {
        const sid = lo.sup[sel.idx];
        if (sid) { detail = `${SUPPORTS[sid].name}\n${SUPPORTS[sid].desc}`; canRemove = true; }
        else detail = this.note || 'Pusty slot. Wybierz support z listy.';
      }
    }
    this.put(this.add.text(10, 332, detail, { fontSize: '12px', color: '#e4e9ff', wordWrap: { width: canRemove ? 240 : 340 } }));
    if (canRemove && sel) this.put(btn(this, 310, 358, 88, 32, 'ZDEJMIJ', () => {
      if (sel.idx === null) c.setSkill(sel.slot, null); else c.setSupport(sel.slot, sel.idx, null);
      c.save(); this.render();
    }, 0x3a2226, 0x9b4d57, 12));

    // lista gemów
    const showSupports = !!sel && sel.idx !== null;
    this.put(this.add.text(12, 398, showSupports ? 'Twoje supporty (dotknij, aby włożyć)' : (sel ? (sel.slot < 3 ? 'Twoje ataki (dotknij, aby włożyć)' : 'Twoje gemy pomocnicze (dotknij, aby włożyć)') : 'Twoje gemy'), { fontSize: '12px', color: '#a8b0d0' }));
    const cell = (i: number) => ({ x: 48 + (i % 4) * 88, y: 450 + Math.floor(i / 4) * 70 });
    const PER = 12;
    const key = showSupports ? 's' : sel ? (sel.slot < 3 ? 'a' : 'u') : 'all';
    if (key !== this.pageKey) { this.pageKey = key; this.page = 0; }
    const nav = (total: number) => {
      const pages = Math.max(1, Math.ceil(total / PER));
      this.page = Math.min(this.page, pages - 1);
      if (pages > 1) {
        this.put(btn(this, 262, 404, 36, 24, '‹', () => { this.page = (this.page + pages - 1) % pages; this.render(); }, 0x22304f, 0x4d6bb3, 16));
        this.put(this.add.text(300, 404, `${this.page + 1}/${pages}`, { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
        this.put(btn(this, 338, 404, 36, 24, '›', () => { this.page = (this.page + 1) % pages; this.render(); }, 0x22304f, 0x4d6bb3, 16));
      }
    };
    if (showSupports) {
      const owned = SUPPORT_IDS.map((id) => ({ id, n: c.supportBag.filter((s) => s === id).length })).filter((o) => o.n > 0);
      if (!owned.length) this.put(this.add.text(W / 2, 480, 'Nie masz supportów.\nZnajdziesz je w łupie lub kupisz u handlarza.', { fontSize: '13px', color: '#8a82b4', align: 'center' }).setOrigin(0.5));
      nav(owned.length);
      owned.slice(this.page * PER, (this.page + 1) * PER).forEach((o, i) => {
        const { x, y } = cell(i), d = SUPPORTS[o.id];
        this.tile(x, y, 84, 64, d.color, false, () => {
          if (sel && sel.idx !== null) { c.setSupport(sel.slot, sel.idx, o.id); c.save(); this.note = `Włożono: ${d.name}`; } else this.note = `${d.name}: ${d.desc}`;
          this.render();
        });
        this.put(this.add.text(x - 36, y - 14, d.short, { fontSize: '18px', color: hex(d.color), fontStyle: 'bold' }).setOrigin(0, 0.5));
        this.put(this.add.text(x + 38, y - 24, `×${o.n}`, { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0));
        this.put(this.add.text(x, y + 15, d.name, { fontSize: '10px', color: '#e4e9ff', align: 'center', wordWrap: { width: 80 } }).setOrigin(0.5));
      });
    } else {
      const ids = (sel ? (sel.slot < 3 ? ATTACK_IDS : UTILITY_IDS) : SKILL_IDS).filter((id) => c.skills[id] > 0).sort((a, b) => c.skills[b] - c.skills[a]);
      nav(ids.length);
      ids.slice(this.page * PER, (this.page + 1) * PER).forEach((id, i) => {
        const { x, y } = cell(i), d = SKILLS[id];
        this.tile(x, y, 84, 64, d.color, false, () => {
          if (sel && sel.idx === null) { c.setSkill(sel.slot, id); c.save(); this.note = ''; this.view = 'summary'; } else this.note = `${d.name}: ${d.desc}`;
          this.render();
        });
        this.put(spr(this, x - 22, y - 14, `ic_${id}`).setScale(30 / 44 / S));
        this.put(this.add.text(x + 38, y - 26, KIND_NAME[d.kind], { fontSize: '10px', color: '#a8b0d0' }).setOrigin(1, 0));
        this.put(this.add.text(x + 38, y - 13, `poz. ${c.skills[id]}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0));
        this.put(this.add.text(x, y + 15, d.name, { fontSize: '10px', color: hex(d.color), align: 'center', wordWrap: { width: 80 } }).setOrigin(0.5));
      });
    }
  }

  /** pełnoekranowe podsumowanie gemu razem z supportami */
  private summary(slot: number): void {
    const c = this.c, lo = c.loadout[slot], id = lo.skill as NonNullable<typeof lo.skill>;
    const sm = describeSkill(id, c.skills[id], lo.sup, c.stats);
    this.put(this.add.text(10, 14, 'PODSUMOWANIE', { fontSize: '19px', color: '#c9a4ff', fontStyle: 'bold' }));
    this.put(btn(this, 330, 24, 50, 32, 'X', () => { this.view = 'list'; this.render(); }, 0x4a2226, 0xc0392b, 15));
    this.put(spr(this, 34, 84, `ic_${id}`).setScale(48 / 44 / S));
    this.put(this.add.text(68, 66, sm.title, { fontSize: '18px', color: hex(sm.color), fontStyle: 'bold' }));
    this.put(this.add.text(68, 90, `${sm.kind} · poziom ${sm.level}/${MAX_SKILL}`, { fontSize: '12px', color: '#a8b0d0' }));
    this.put(this.add.text(12, 116, sm.desc, { fontSize: '12px', color: '#d6d0ee', wordWrap: { width: 336 } }));
    this.put(this.add.text(12, 148, 'Efekt końcowy (z postacią i supportami)', { fontSize: '11px', color: '#8f86b3' }));
    let y = 168;
    sm.lines.forEach(([k, v]) => {
      this.put(this.add.rectangle(W / 2, y + 10, 340, 21, 0x141a30, 0.9));
      this.put(this.add.text(14, y + 10, k, { fontSize: '12px', color: '#a8b0d0' }).setOrigin(0, 0.5));
      this.put(this.add.text(346, y + 10, v, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(1, 0.5));
      y += 23;
    });
    y += 8;
    this.put(this.add.text(12, y, `Supporty (${sm.supports.length}/${lo.sup.length})`, { fontSize: '11px', color: '#8f86b3' }));
    y += 18;
    if (!sm.supports.length) this.put(this.add.text(14, y, 'Brak. Włóż supporty w sloty obok gemu.', { fontSize: '12px', color: '#6f6896' }));
    sm.supports.forEach((sp) => {
      const t = this.add.text(48, y, `${sp.works ? '✓' : '✗'} ${sp.name}: ${sp.text}`, { fontSize: '11px', color: sp.works ? '#e4e9ff' : '#ff8a8a', wordWrap: { width: 300 } });
      this.put(this.add.rectangle(27, y + 9, 30, 18, 0x141a30).setStrokeStyle(2, sp.color));
      const short = Object.values(SUPPORTS).find((x) => x.name === sp.name)?.short ?? '';
      this.put(this.add.text(27, y + 9, short, { fontSize: '11px', color: hex(sp.color), fontStyle: 'bold' }).setOrigin(0.5));
      this.put(t);
      y += Math.max(24, t.height + 6);
    });
    this.put(btn(this, 100, 612, 160, 36, 'ZMIEŃ GEM', () => { this.view = 'list'; this.render(); }, 0x22304f, 0x4d6bb3, 13));
    this.put(btn(this, 262, 612, 160, 36, 'ZDEJMIJ', () => { c.setSkill(slot, null); c.save(); this.view = 'list'; this.render(); }, 0x3a2226, 0x9b4d57, 13));
  }
}

// ================= HANDLARZ =================
export class ShopScene extends Phaser.Scene {
  private c!: Character;
  private layer!: Phaser.GameObjects.Container;
  private msg = '';

  constructor() { super('shop'); }
  init(): void { this.c = char(); this.msg = ''; this.c.checkDay(); }

  create(): void {
    base(this);
    this.layer = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    const c = this.c, put = (...o: Phaser.GameObjects.GameObject[]) => o.forEach((x) => this.layer.add(x));
    this.layer.removeAll(true);
    put(this.add.text(10, 14, 'HANDLARZ', { fontSize: '19px', color: '#c9a4ff', fontStyle: 'bold' }));
    put(this.add.text(140, 18, `Złoto: ${c.gold}`, { fontSize: '14px', color: '#ffd86b', fontStyle: 'bold' }));
    put(...btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b, 15));
    put(this.add.text(W / 2, 74, 'Cień w kapturze szepcze, że ma towar...', { fontSize: '12px', color: '#a89fcc', align: 'center', fontStyle: 'italic' }).setOrigin(0.5));
    const ilvl = 2 + Math.floor(c.alloc.size / 25);
    const offers: { name: string; desc: string; cost: number; buy: () => string }[] = [
      { name: 'Losowy gem umiejętności', desc: 'Nowa umiejętność albo wyższy poziom znanej', cost: 150, buy: () => {
        const id = pickGem(c.skills, c.level);
        const r = c.addSkillGem(id);
        return `${SKILLS[id].name}: ${r === 'new' ? 'nowy gem!' : r === 'up' ? 'wyższy poziom!' : 'maks.'}`;
      } },
      { name: 'Losowy support', desc: `Jeden z ${SUPPORT_IDS.length} kamieni wspierających`, cost: 100, buy: () => {
        const id = Phaser.Utils.Array.GetRandom(SUPPORT_IDS); c.addSupportGem(id); return `Support: ${SUPPORTS[id].name}`;
      } },
      { name: 'Przedmiot rzadki lub lepszy', desc: 'Losowy slot, co najmniej rzadki', cost: 120, buy: () => {
        const it = makeItem(ilvl + 1, 2), r = c.addItemAuto(it);
        return `${it.name} (${RARITY_NAME[it.rarity]}): ${r === 'equipped' ? 'założony' : r === 'bag' ? 'w plecaku' : 'sprzedany, plecak pełny'}`;
      } },
    ];
    if (!c.daily.shopBought) {
      let seed = (c.daily.day.split('-').join('') as unknown as number) * 7919;
      const ids = Object.keys(SKILLS).filter((id) => (SKILLS[id].lv ?? 1) <= c.level + 3).sort(), pickId = ids[Math.abs(Math.floor(Math.sin(seed++) * 10000)) % Math.max(1, ids.length)];
      offers.unshift({ name: `Gem dnia: ${SKILLS[pickId].name}`, desc: `${KIND_NAME[SKILLS[pickId].kind]}, tylko dziś i taniej (−40%)`, cost: 90, buy: () => {
        const r = c.addSkillGem(pickId); c.daily.shopBought = true;
        return `${SKILLS[pickId].name}: ${r === 'new' ? 'nowy gem!' : r === 'up' ? 'wyższy poziom!' : 'maks.'}`;
      } });
    }
    offers.forEach((o, i) => {
      const y = 140 + i * 92, ok = c.gold >= o.cost;
      put(this.add.rectangle(W / 2, y, 336, 82, 0x14102a).setStrokeStyle(2, ok ? 0x8a74c9 : 0x2a3050));
      put(this.add.text(24, y - 32, o.name, { fontSize: '15px', color: '#fff', fontStyle: 'bold' }));
      put(this.add.text(24, y - 8, o.desc, { fontSize: '12px', color: '#c2bae6', wordWrap: { width: 190 } }));
      put(...btn(this, 290, y + 8, 92, 44, `${o.cost} zł`, () => {
        if (c.gold < o.cost) { this.msg = 'Za mało złota.'; this.render(); return; }
        c.gold -= o.cost; this.msg = o.buy(); c.save(); this.render();
      }, ok ? 0x2b5a3a : 0x22242f, ok ? 0x4ade80 : 0x40466a, 15));
    });
    put(this.add.text(W / 2, 600, this.msg, { fontSize: '15px', color: '#ffd86b', align: 'center', wordWrap: { width: 320 }, fontStyle: 'bold' }).setOrigin(0.5));
  }
}

// ================= OSIĄGNIĘCIA I BOSSOWIE =================
export class AchScene extends Phaser.Scene {
  private c!: Character;
  private list!: Phaser.GameObjects.Container;
  private maxScroll = 0;

  constructor() { super('ach'); }
  init(): void { this.c = char(); }

  create(): void {
    base(this);
    const c = this.c;
    if (c.checkAchievements().length) c.save();
    this.list = this.add.container(0, 0);
    let y = 78;
    const section = (t: string) => { this.list.add(this.add.text(12, y, t, { fontSize: '13px', color: '#8f86b3', fontStyle: 'bold' })); y += 24; };
    const row = (name: string, desc: string, done: boolean, prog: number, right: string, rightColor: string) => {
      this.list.add(this.add.rectangle(W / 2, y + 22, 340, 46, done ? 0x16301f : 0x141a30).setStrokeStyle(2, done ? 0x4ade80 : 0x2a3050));
      this.list.add(this.add.text(20, y + 9, `${done ? '✓ ' : ''}${name}`, { fontSize: '14px', color: done ? '#7be8a8' : '#fff', fontStyle: 'bold' }));
      this.list.add(this.add.text(20, y + 28, desc, { fontSize: '11px', color: '#a8b0d0' }));
      if (!done && prog >= 0) {
        this.list.add(this.add.rectangle(270, y + 33, 80, 6, 0x000000).setOrigin(0, 0.5));
        this.list.add(this.add.rectangle(270, y + 33, 80 * Math.min(1, prog), 6, 0xffd86b).setOrigin(0, 0.5));
      }
      this.list.add(this.add.text(344, y + 10, right, { fontSize: '13px', color: rightColor, fontStyle: 'bold' }).setOrigin(1, 0));
      y += 52;
    };
    section(`BOSSOWIE: pierwsze pokonanie daje +${BOSS_POINTS} pkt`);
    BOSSES.forEach((b) => {
      const done = !!c.bosses[b.id], bn = BIOMES.find((x) => x.id === b.biome)?.name ?? '';
      row(b.name, done ? `Pokonany · ${bn}` : `${bn} · ${b.desc}`, done, -1, done ? `+${BOSS_POINTS}` : `+${BOSS_POINTS} pkt`, done ? '#7be8a8' : '#ffd86b');
    });
    y += 6;
    section('OSIĄGNIĘCIA');
    ACHIEVEMENTS.forEach((a) => {
      const done = !!c.done[a.id], v = a.value(c.totals, c.level);
      row(a.name, done ? a.desc : `${a.desc}  (${Math.min(v, a.goal)}/${a.goal})`, done, v / a.goal, `+${a.pts} pkt`, done ? '#7be8a8' : '#ffd86b');
    });
    this.maxScroll = Math.max(0, y - (H - 20));

    const earned = ACHIEVEMENTS.filter((a) => c.done[a.id]).reduce((n, a) => n + a.pts, 0) + BOSSES.filter((b) => c.bosses[b.id]).length * BOSS_POINTS;
    const total = ACHIEVEMENTS.reduce((n, a) => n + a.pts, 0) + BOSSES.length * BOSS_POINTS;
    this.add.rectangle(0, 0, W, 62, 0x0a0814).setOrigin(0).setInteractive();
    this.add.text(10, 12, 'OSIĄGNIĘCIA', { fontSize: '19px', color: '#c9a4ff', fontStyle: 'bold' });
    this.add.text(10, 38, `Zdobyte punkty drzewka: ${earned} / ${total}`, { fontSize: '12px', color: '#ffd86b' });
    btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b, 15);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      this.list.y = Phaser.Math.Clamp(this.list.y + (p.y - p.prevPosition.y) / S, -this.maxScroll, 0);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { this.list.y = Phaser.Math.Clamp(this.list.y - dy * 0.5, -this.maxScroll, 0); });
  }
}

// ================= ZADANIA DZIENNE =================
export class DailyScene extends Phaser.Scene {
  private c!: Character;
  private layer!: Phaser.GameObjects.Container;
  private msg = '';

  constructor() { super('daily'); }
  init(): void { this.c = char(); this.msg = ''; this.c.checkDay(); }
  create(): void { base(this); this.layer = this.add.container(0, 0); this.render(); }

  private render(): void {
    const c = this.c, d = c.daily, put = (...o: Phaser.GameObjects.GameObject[]) => o.forEach((x) => this.layer.add(x));
    this.layer.removeAll(true);
    put(this.add.text(10, 14, 'ZADANIA DZIENNE', { fontSize: '19px', color: '#c9a4ff', fontStyle: 'bold' }));
    put(...btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b, 15));
    // seria logowań
    put(this.add.text(12, 62, `Seria logowań: ${d.streak} ${d.streak === 1 ? 'dzień' : 'dni'}`, { fontSize: '12px', color: '#ffd86b', fontStyle: 'bold' }));
    const cur = (d.streak - 1) % 7;
    LOGIN_REWARDS.forEach((r, i) => {
      const x = 28 + i * 50, past = i < cur || (i === cur && d.loginClaimed), now = i === cur;
      put(this.add.rectangle(x, 106, 44, 56, past ? 0x16301f : now ? 0x3a2f12 : 0x141a30).setStrokeStyle(now ? 3 : 2, past ? 0x4ade80 : now ? 0xffd86b : 0x2a3050));
      put(this.add.text(x, 90, `${i + 1}`, { fontSize: '12px', color: '#a8b0d0', fontStyle: 'bold' }).setOrigin(0.5));
      put(this.add.text(x, 112, r.item ? 'item\n+zł' : r.gem ? 'gem\n+zł' : r.support ? 'supp.\n+zł' : `${r.gold}\nzł`, { fontSize: '10px', color: past ? '#7be8a8' : '#fff', align: 'center' }).setOrigin(0.5));
    });
    if (!d.loginClaimed) put(...btn(this, W / 2, 158, 300, 34, `ODBIERZ NAGRODĘ DNIA ${cur + 1}: ${LOGIN_REWARDS[cur].text}`, () => { this.msg = c.claimLogin() ?? ''; this.render(); }, 0x2b5a3a, 0x4ade80, 12));
    else put(this.add.text(W / 2, 158, 'Dzisiejsza nagroda odebrana. Wróć jutro po następną.', { fontSize: '12px', color: '#7be8a8' }).setOrigin(0.5));
    // zadania
    put(this.add.text(12, 196, 'DZISIEJSZE WYZWANIA (nowe o północy)', { fontSize: '13px', color: '#8f86b3', fontStyle: 'bold' }));
    d.quests.forEach((q, i) => {
      const def = QUESTS.find((x) => x.id === q.id);
      if (!def) return;
      const y = 250 + i * 86, done = q.prog >= def.goal;
      put(this.add.rectangle(W / 2, y, 340, 76, q.claimed ? 0x16301f : 0x141a30).setStrokeStyle(2, q.claimed ? 0x4ade80 : done ? 0xffd86b : 0x2a3050));
      put(this.add.text(20, y - 31, def.name, { fontSize: '12px', color: q.claimed ? '#7be8a8' : '#fff', fontStyle: 'bold', wordWrap: { width: 215 } }));
      put(this.add.text(20, y + 1, `Nagroda: ${def.gold} zł · ${Math.round(def.xp * 100)}% XP poziomu${def.gem ? ' · gem' : ''}`, { fontSize: '10px', color: '#c2bae6', wordWrap: { width: 215 } }));
      put(this.add.rectangle(20, y + 18, 190, 8, 0x000000).setOrigin(0, 0.5));
      put(this.add.rectangle(20, y + 18, 190 * Math.min(1, q.prog / def.goal), 8, done ? 0xffd86b : 0x8fa9ff).setOrigin(0, 0.5));
      put(this.add.text(216, y + 18, `${q.prog}/${def.goal}`, { fontSize: '11px', color: '#fff' }).setOrigin(0, 0.5));
      if (q.claimed) put(this.add.text(300, y, '✓', { fontSize: '26px', color: '#7be8a8', fontStyle: 'bold' }).setOrigin(0.5));
      else put(...btn(this, 300, y, 84, 40, done ? 'ODBIERZ' : 'w toku', () => { if (done) { this.msg = c.claimQuest(i) ?? ''; this.render(); } }, done ? 0x2b5a3a : 0x22242f, done ? 0x4ade80 : 0x40466a, 12));
    });
    put(this.add.text(W / 2, 540, this.msg, { fontSize: '13px', color: '#ffd86b', align: 'center', wordWrap: { width: 330 }, fontStyle: 'bold' }).setOrigin(0.5));
    put(this.add.text(W / 2, 600, `Złoto: ${c.gold}`, { fontSize: '13px', color: '#ffd86b' }).setOrigin(0.5));
  }
}
