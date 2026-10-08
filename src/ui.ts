import Phaser from 'phaser';
import { MAX_SKILL, SKILLS, SKILL_IDS, STAT_LABEL, StatKey, SUPPORTS, SUPPORT_IDS, SkillId, fmtStat, fmtStats } from './data';
import { BAG_SIZE, Character, getChar } from './char';
import { Item, RARITY_COLOR, RARITY_NAME, SLOTS, SLOT_NAME, makeItem, sellValue } from './items';
import { NODES, NODE_LIST, SECTORS, TreeNode, sectorColor } from './tree';
import { CLASSES } from './data';

const W = 360, H = 640;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function btn(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void, fill = 0x22304f, stroke = 0x4d6bb3, size = 14): Phaser.GameObjects.GameObject[] {
  const r = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, stroke).setInteractive();
  const t = scene.add.text(x, y, label, { fontSize: `${size}px`, color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5);
  r.on('pointerup', cb);
  return [r, t];
}
const home = (s: Phaser.Scene) => s.scene.start('menu');
function char(): Character { return getChar() as Character; }

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
  private zoom = 0.6;
  private pinchD = 0;
  private filter = -1;
  private resetArmed = false;

  constructor() { super('tree'); }
  init(): void { this.c = char(); this.sel = null; this.path = null; this.circles.clear(); this.labels = []; this.zoom = 0.6; this.filter = -1; this.resetArmed = false; }

  create(): void {
    this.add.rectangle(0, 0, W, H, 0x0a0814).setOrigin(0).setInteractive();
    this.world = this.add.container(0, 0).setScale(this.zoom);
    this.links = this.add.graphics();
    this.world.add(this.links);
    SECTORS.forEach((cid, s) => {
      const a = ((-90 + 60 * s) * Math.PI) / 180;
      this.world.add(this.add.text(Math.cos(a) * 880, Math.sin(a) * 880, CLASSES[cid].region.toUpperCase(), { fontSize: '30px', color: hex(sectorColor(s)), fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.55));
    });
    NODE_LIST.forEach((n) => {
      const r = n.kind === 'k' ? 18 : n.kind === 'n' ? 13 : n.kind === 'start' ? 17 : 8;
      const circ = this.add.circle(n.x, n.y, r, 0x1b2036).setStrokeStyle(3, 0x40466a).setInteractive(new Phaser.Geom.Circle(r, r, r + 12), Phaser.Geom.Circle.Contains);
      circ.on('pointerup', (p: Phaser.Input.Pointer) => { if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) < 10) this.select(n.id); });
      this.circles.set(n.id, circ);
      this.world.add(circ);
      if (n.kind === 'n' || n.kind === 'k') {
        const t = this.add.text(n.x, n.y + r + 7, n.name, { fontSize: '11px', color: '#c9d1ee', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
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
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (this.pinchD > 0) this.setZoom(this.zoom * (d / this.pinchD), (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinchD = d;
        return;
      }
      this.pinchD = 0;
      if (!p.isDown || p.y > 520 || p.y < 56) return;
      this.world.x += p.x - p.prevPosition.x; this.world.y += p.y - p.prevPosition.y;
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));

    this.add.rectangle(0, 0, W, 56, 0x0a0814).setOrigin(0).setInteractive();
    this.head = this.add.text(8, 6, '', { fontSize: '13px', color: '#ffd86b', fontStyle: 'bold' });
    btn(this, 342, 16, 30, 24, 'X', () => home(this), 0x4a2226, 0xc0392b, 13);
    this.filterBtn = btn(this, 62, 40, 112, 24, '', () => { this.filter = this.filter + 1 >= FILTERS.length ? -1 : this.filter + 1; this.render(); }, 0x22304f, 0x4d6bb3, 10)[1] as Phaser.GameObjects.Text;
    this.resetBtn = btn(this, 164, 40, 88, 24, 'Reset', () => this.onReset(), 0x3a2226, 0x9b4d57, 10)[1] as Phaser.GameObjects.Text;
    btn(this, 252, 40, 30, 24, '+', () => this.setZoom(this.zoom * 1.25), 0x22304f, 0x4d6bb3, 14);
    btn(this, 286, 40, 30, 24, '−', () => this.setZoom(this.zoom / 1.25), 0x22304f, 0x4d6bb3, 14);
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
    this.head.setText(`Punkty: ${c.points}    Złoto: ${c.gold}`);
    this.filterBtn.setText(this.filter < 0 ? 'Filtr: brak' : STAT_LABEL[FILTERS[this.filter]]);
    const inPath = new Set(this.path ?? []);
    this.links.clear();
    NODE_LIST.forEach((n) => n.links.forEach((l) => {
      if (l < n.id) return;
      const o = NODES[l], both = c.alloc.has(n.id) && c.alloc.has(l);
      const pth = (inPath.has(n.id) || c.alloc.has(n.id)) && (inPath.has(l) || c.alloc.has(l)) && (inPath.has(n.id) || inPath.has(l));
      const col = pth ? 0xffffff : both ? sectorColor(n.sector >= 0 ? n.sector : o.sector) : 0x2a3050;
      this.links.lineStyle(pth || both ? 5 : 2, col, pth || both ? 0.95 : 1).lineBetween(n.x, n.y, o.x, o.y);
    }));
    const fk = this.filter >= 0 ? FILTERS[this.filter] : null;
    this.circles.forEach((circ, id) => {
      const n = NODES[id], on = c.alloc.has(id), can = !on && n.links.some((l) => c.alloc.has(l));
      const col = n.sector >= 0 ? sectorColor(n.sector) : 0xffd86b;
      circ.setFillStyle(on ? col : can ? 0x2d3556 : 0x1b2036);
      circ.setStrokeStyle(id === this.sel ? 4 : 3, id === this.sel || inPath.has(id) ? 0xffffff : on ? 0xffffff : can ? col : 0x40466a);
      circ.setAlpha(fk && !(n.stats[fk]) ? 0.18 : 1);
    });
    this.info.removeAll(true);
    this.info.add(this.add.rectangle(0, 520, W, 120, 0x141a30).setOrigin(0).setStrokeStyle(2, 0x3a4270).setInteractive());
    if (!this.sel) {
      this.info.add(this.add.text(W / 2, 580, 'Przeciągaj, szczypij dwoma palcami, by przybliżyć.\nDotknij węzła: zobaczysz ścieżkę i koszt dojścia.', { fontSize: '12px', color: '#8892b0', align: 'center' }).setOrigin(0.5));
      return;
    }
    const n: TreeNode = NODES[this.sel];
    const on = c.alloc.has(n.id);
    const col = n.sector >= 0 ? sectorColor(n.sector) : 0xffd86b;
    const kindTxt = n.kind === 'k' ? '  (kamień węgielny)' : n.kind === 'n' ? '  (znaczący)' : n.kind === 'start' ? '  (start)' : '';
    this.info.add(this.add.text(12, 526, n.name + kindTxt, { fontSize: '15px', color: hex(col), fontStyle: 'bold' }));
    let body = fmtStats(n.stats).join('\n') || (n.kind === 'start' ? 'Punkt startowy klasy' : '');
    if (!on && this.path) body += `\n\nŚcieżka: ${this.path.length} węzł(ów), koszt ${c.pathCost(this.path)}`;
    if (!on && !this.path) body += '\n\nBrak ścieżki';
    this.info.add(this.add.text(12, 548, body, { fontSize: '12px', color: '#dfe5ff', wordWrap: { width: 230 } }));
    if (on) {
      if (n.id === c.startId) return;
      const ok = c.canRefund(n.id) && c.gold >= c.refundCost(n.id);
      this.info.add(btn(this, 302, 600, 100, 44, c.canRefund(n.id) ? `ZWOLNIJ\n-${c.refundCost(n.id)} zł` : 'Zablokowany\n(trzyma inne)', () => { if (c.refund(n.id)) { c.save(); this.select(n.id); } }, ok ? 0x5a4a22 : 0x22242f, ok ? 0xffd86b : 0x40466a, 11));
    } else if (this.path) {
      const cost = c.pathCost(this.path), ok = cost <= c.points;
      this.info.add(btn(this, 302, 600, 100, 44, ok ? `WYKUP\n(${cost})` : `Brak pkt\n(${cost})`, () => { if (c.allocatePath(this.path as string[])) { c.save(); this.path = null; this.render(); } }, ok ? 0x2b5a3a : 0x22242f, ok ? 0x4ade80 : 0x40466a, 12));
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
    this.add.rectangle(0, 0, W, H, 0x0a0814).setOrigin(0).setInteractive();
    this.layer = this.add.container(0, 0);
    this.render();
  }
  private put(...o: (Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[])[]): void { o.flat().forEach((x) => this.layer.add(x)); }

  private render(): void {
    this.layer.removeAll(true);
    this.put(this.add.text(10, 14, 'EKWIPUNEK', { fontSize: '18px', color: '#c9a4ff', fontStyle: 'bold' }));
    this.put(this.add.text(150, 18, `Złoto: ${this.c.gold}`, { fontSize: '13px', color: '#ffd86b' }));
    this.put(btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b));
    ['PRZEDMIOTY', 'STATYSTYKI'].forEach((t, i) =>
      this.put(btn(this, 95 + i * 170, 66, 160, 30, t, () => { this.tab = i; this.sel = null; this.render(); }, this.tab === i ? 0x2b3a66 : 0x151a2c, this.tab === i ? 0xffd86b : 0x333a5c, 11)));
    if (this.tab === 0) this.items(); else this.stats();
  }

  private itemBox(x: number, y: number, it: Item | undefined, label: string, size = 52): void {
    const sel = it && it === this.sel;
    const r = this.add.rectangle(x, y, size, size, 0x141a30).setStrokeStyle(sel ? 4 : 3, it ? RARITY_COLOR[it.rarity] : 0x2a3050);
    this.put(r, this.add.text(x, y, it ? it.name : label, { fontSize: '9px', color: it ? hex(RARITY_COLOR[it.rarity]) : '#4a5170', align: 'center', wordWrap: { width: size - 4 }, maxLines: 4 }).setOrigin(0.5));
    if (it) { r.setInteractive(); r.on('pointerup', () => { this.sel = it; this.render(); }); }
  }

  private items(): void {
    const c = this.c;
    SLOTS.forEach((s, i) => {
      this.itemBox(40 + i * 70, 130, c.equipped[s], SLOT_NAME[s], 56);
      this.put(this.add.text(40 + i * 70, 166, SLOT_NAME[s], { fontSize: '10px', color: '#8892b0' }).setOrigin(0.5));
    });
    this.put(this.add.text(12, 190, `Plecak (${c.bag.length}/${BAG_SIZE})`, { fontSize: '12px', color: '#8892b0' }));
    for (let i = 0; i < BAG_SIZE; i++) this.itemBox(40 + (i % 6) * 56, 232 + Math.floor(i / 6) * 58, c.bag[i], '', 52);
    this.put(btn(this, 180, 478, 330, 28, 'Sprzedaj zwykłe i magiczne', () => { c.sellBelow(2); c.save(); this.sel = null; this.render(); }, 0x3a3320, 0x9b8a4d, 11));
    const it = this.sel;
    if (!it) { this.put(this.add.text(W / 2, 570, 'Dotknij przedmiotu, aby zobaczyć szczegóły.\nLepsze przedmioty zakładają się same podczas wypraw.', { fontSize: '12px', color: '#8892b0', align: 'center' }).setOrigin(0.5)); return; }
    const worn = c.equipped[it.slot] === it;
    this.put(this.add.rectangle(0, 505, W, 135, 0x141a30).setOrigin(0).setStrokeStyle(2, RARITY_COLOR[it.rarity]));
    this.put(this.add.text(10, 510, it.name, { fontSize: '15px', color: hex(RARITY_COLOR[it.rarity]), fontStyle: 'bold' }));
    this.put(this.add.text(10, 530, `${RARITY_NAME[it.rarity]} · ${SLOT_NAME[it.slot].toLowerCase()} · poz. ${it.ilvl}\n${fmtStats(it.stats).join('\n')}`, { fontSize: '12px', color: '#dfe5ff', lineSpacing: 2 }));
    this.put(btn(this, 300, 545, 100, 36, worn ? 'ZDEJMIJ' : 'ZAŁÓŻ', () => { if (worn) c.unequip(it.slot); else c.equip(it); c.save(); this.sel = null; this.render(); }, 0x2b5a3a, 0x4ade80, 13));
    this.put(btn(this, 300, 593, 100, 36, `SPRZEDAJ +${sellValue(it)}`, () => { c.sell(it); c.save(); this.sel = null; this.render(); }, 0x5a4a22, 0xffd86b, 11));
  }

  private stats(): void {
    const st = this.c.stats, keys = Object.keys(STAT_LABEL) as StatKey[];
    this.put(this.add.text(16, 100, [`Maks. życie: ${this.c.maxHp}`, ...keys.map((k) => fmtStat(k, st[k]).replace(/^\+/, ''))].join('\n'), { fontSize: '14px', color: '#dfe5ff', lineSpacing: 6 }));
  }
}

// ================= UMIEJĘTNOŚCI =================
type Sel = { slot: number; idx: number | null } | null; // idx null = slot umiejętności

export class SkillsScene extends Phaser.Scene {
  private c!: Character;
  private sel: Sel = null;
  private note = '';
  private layer!: Phaser.GameObjects.Container;

  constructor() { super('skills'); }
  init(): void { this.c = char(); this.sel = null; this.note = ''; }

  create(): void {
    this.add.rectangle(0, 0, W, H, 0x0a0814).setOrigin(0).setInteractive();
    this.layer = this.add.container(0, 0);
    this.render();
  }
  private put(...o: (Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[])[]): void { o.flat().forEach((x) => this.layer.add(x)); }

  private box(x: number, y: number, w: number, h: number, stroke: number, label: string, color: string, cb: () => void, selected: boolean, size = 9): void {
    const r = this.add.rectangle(x, y, w, h, 0x141a30).setStrokeStyle(selected ? 4 : 2, selected ? 0xffffff : stroke).setInteractive();
    r.on('pointerup', cb);
    this.put(r, this.add.text(x, y, label, { fontSize: `${size}px`, color, align: 'center', wordWrap: { width: w - 4 }, maxLines: 3 }).setOrigin(0.5));
  }

  private render(): void {
    const c = this.c, sel = this.sel;
    this.layer.removeAll(true);
    this.put(this.add.text(10, 14, 'UMIEJĘTNOŚCI', { fontSize: '18px', color: '#c9a4ff', fontStyle: 'bold' }));
    this.put(btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b));
    this.put(this.add.text(12, 50, 'Główne (po 5 supportów)', { fontSize: '10px', color: '#8892b0' }));
    c.loadout.forEach((lo, i) => {
      const y = 78 + i * 40 + (i >= 3 ? 24 : 0);
      if (i === 3) this.put(this.add.text(12, y - 31, 'Poboczne (po 2 supporty)', { fontSize: '10px', color: '#8892b0' }));
      const sd = lo.skill ? SKILLS[lo.skill] : null;
      this.box(60, y, 100, 36, sd ? sd.color : 0x2a3050, sd ? `${sd.name}\npoz. ${c.skills[lo.skill as SkillId]}` : 'pusty slot', sd ? hex(sd.color) : '#4a5170', () => { this.sel = { slot: i, idx: null }; this.note = ''; this.render(); }, !!sel && sel.slot === i && sel.idx === null);
      lo.sup.forEach((sid, j) => {
        const sdef = sid ? SUPPORTS[sid] : null;
        this.box(132 + j * 38, y, 34, 34, sdef ? sdef.color : 0x2a3050, sdef ? sdef.short : '+', sdef ? hex(sdef.color) : '#4a5170', () => { this.sel = { slot: i, idx: j }; this.note = ''; this.render(); }, !!sel && sel.slot === i && sel.idx === j, 11);
      });
    });

    // pasek szczegółów
    this.put(this.add.rectangle(0, 324, W, 62, 0x141a30).setOrigin(0).setStrokeStyle(2, 0x3a4270));
    let detail = this.note || 'Wybierz slot, a potem gem z listy poniżej.';
    let canRemove = false;
    if (sel) {
      const lo = c.loadout[sel.slot];
      if (sel.idx === null) {
        if (lo.skill) { detail = `${SKILLS[lo.skill].name} (poz. ${c.skills[lo.skill]}/${MAX_SKILL})\n${SKILLS[lo.skill].desc}`; canRemove = true; }
        else detail = this.note || 'Pusty slot — wybierz umiejętność z listy.';
      } else {
        const sid = lo.sup[sel.idx];
        if (sid) { detail = `${SUPPORTS[sid].name}\n${SUPPORTS[sid].desc}`; canRemove = true; }
        else detail = this.note || 'Pusty slot — wybierz support z listy.';
      }
    }
    this.put(this.add.text(10, 330, detail, { fontSize: '11px', color: '#dfe5ff', wordWrap: { width: canRemove ? 245 : 340 } }));
    if (canRemove && sel) this.put(btn(this, 312, 355, 80, 30, 'ZDEJMIJ', () => {
      if (sel.idx === null) c.setSkill(sel.slot, null); else c.setSupport(sel.slot, sel.idx, null);
      c.save(); this.render();
    }, 0x3a2226, 0x9b4d57, 11));

    // lista gemów
    const showSupports = !!sel && sel.idx !== null;
    this.put(this.add.text(12, 394, showSupports ? 'Twoje supporty (dotknij, aby włożyć)' : 'Twoje umiejętności (dotknij, aby włożyć)', { fontSize: '11px', color: '#8892b0' }));
    if (showSupports) {
      const owned = SUPPORT_IDS.map((id) => ({ id, n: c.supportBag.filter((s) => s === id).length })).filter((o) => o.n > 0);
      if (!owned.length) this.put(this.add.text(W / 2, 470, 'Nie masz supportów.\nZnajdziesz je w łupie lub kupisz u handlarza.', { fontSize: '12px', color: '#6b6490', align: 'center' }).setOrigin(0.5));
      owned.forEach((o, i) => this.box(40 + (i % 5) * 70, 438 + Math.floor(i / 5) * 56, 66, 50, SUPPORTS[o.id].color, `${SUPPORTS[o.id].name}\n×${o.n}`, hex(SUPPORTS[o.id].color), () => {
        if (sel && sel.idx !== null) { c.setSupport(sel.slot, sel.idx, o.id); c.save(); this.note = `Włożono: ${SUPPORTS[o.id].name}`; }
        this.render();
      }, false, 8));
    } else {
      const owned = SKILL_IDS.filter((id) => c.skills[id] > 0);
      owned.forEach((id, i) => this.box(40 + (i % 5) * 70, 438 + Math.floor(i / 5) * 56, 66, 50, SKILLS[id].color, `${SKILLS[id].name}\npoz. ${c.skills[id]}`, hex(SKILLS[id].color), () => {
        if (sel && sel.idx === null) { c.setSkill(sel.slot, id); c.save(); this.note = ''; }
        else this.note = `${SKILLS[id].name}: ${SKILLS[id].desc}`;
        this.render();
      }, false, 9));
    }
  }
}

// ================= HANDLARZ =================
export class ShopScene extends Phaser.Scene {
  private c!: Character;
  private layer!: Phaser.GameObjects.Container;
  private msg = '';

  constructor() { super('shop'); }
  init(): void { this.c = char(); this.msg = ''; }

  create(): void {
    this.add.rectangle(0, 0, W, H, 0x0a0814).setOrigin(0).setInteractive();
    this.layer = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    const c = this.c, put = (...o: Phaser.GameObjects.GameObject[]) => o.forEach((x) => this.layer.add(x));
    this.layer.removeAll(true);
    put(this.add.text(10, 14, 'HANDLARZ', { fontSize: '18px', color: '#c9a4ff', fontStyle: 'bold' }));
    put(this.add.text(130, 18, `Złoto: ${c.gold}`, { fontSize: '13px', color: '#ffd86b' }));
    put(...btn(this, 330, 24, 50, 32, 'X', () => home(this), 0x4a2226, 0xc0392b));
    put(this.add.text(W / 2, 74, 'Cień w kapturze szepcze, że ma towar...\nza odpowiednią cenę.', { fontSize: '12px', color: '#8f86b3', align: 'center', fontStyle: 'italic' }).setOrigin(0.5));
    const ilvl = 2 + Math.floor(c.alloc.size / 25);
    const offers: { name: string; desc: string; cost: number; buy: () => string }[] = [
      { name: 'Losowy gem umiejętności', desc: 'Nowa umiejętność albo wyższy poziom znanej', cost: 150, buy: () => {
        const pool = SKILL_IDS.filter((id) => c.skills[id] < MAX_SKILL), id = Phaser.Utils.Array.GetRandom(pool.length ? pool : SKILL_IDS);
        const r = c.addSkillGem(id);
        return `${SKILLS[id].name}: ${r === 'new' ? 'nowy gem!' : r === 'up' ? 'wyższy poziom!' : 'maks.'}`;
      } },
      { name: 'Losowy support', desc: 'Jeden z 12 kamieni wspierających', cost: 100, buy: () => {
        const id = Phaser.Utils.Array.GetRandom(SUPPORT_IDS); c.addSupportGem(id); return `Support: ${SUPPORTS[id].name}`;
      } },
      { name: 'Przedmiot rzadki lub lepszy', desc: 'Losowy slot, co najmniej rzadki', cost: 120, buy: () => {
        const it = makeItem(ilvl + 1, 2), r = c.addItemAuto(it);
        return `${it.name} (${RARITY_NAME[it.rarity]}) — ${r === 'equipped' ? 'założony' : r === 'bag' ? 'w plecaku' : 'sprzedany, plecak pełny'}`;
      } },
    ];
    offers.forEach((o, i) => {
      const y = 150 + i * 96, ok = c.gold >= o.cost;
      put(this.add.rectangle(W / 2, y, 336, 82, 0x14102a).setStrokeStyle(2, ok ? 0x6b5aa0 : 0x2a3050));
      put(this.add.text(24, y - 30, o.name, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }));
      put(this.add.text(24, y - 8, o.desc, { fontSize: '11px', color: '#aaa3cc', wordWrap: { width: 200 } }));
      put(...btn(this, 290, y + 8, 90, 40, `${o.cost} zł`, () => {
        if (c.gold < o.cost) { this.msg = 'Za mało złota.'; this.render(); return; }
        c.gold -= o.cost; this.msg = o.buy(); c.save(); this.render();
      }, ok ? 0x2b5a3a : 0x22242f, ok ? 0x4ade80 : 0x40466a, 14));
    });
    put(this.add.text(W / 2, 470, this.msg, { fontSize: '14px', color: '#ffd86b', align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5));
  }
}
