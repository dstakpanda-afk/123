import Phaser from 'phaser';
import { MAX_SKILL, SKILLS, SKILL_IDS, SLOT_COUNT, STAT_LABEL, StatKey, fmtStat, fmtStats } from './data';
import { Item, RARITY_COLOR, RARITY_NAME, SLOTS, SLOT_NAME, sellValue } from './items';
import { BAG_SIZE, Run } from './run';
import { BRANCHES, NODES, NODE_LIST, TreeNode } from './tree';

const W = 360, H = 640;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function btn(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void, fill = 0x22304f, stroke = 0x4d6bb3, size = 14): Phaser.GameObjects.GameObject[] {
  const r = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, stroke).setInteractive();
  const t = scene.add.text(x, y, label, { fontSize: `${size}px`, color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5);
  r.on('pointerup', cb);
  return [r, t];
}
function close(scene: Phaser.Scene): void {
  scene.scene.stop();
  scene.scene.resume('game');
}

// ================= DRZEWKO =================
export class TreeScene extends Phaser.Scene {
  private run!: Run;
  private world!: Phaser.GameObjects.Container;
  private links!: Phaser.GameObjects.Graphics;
  private circles = new Map<string, Phaser.GameObjects.Arc>();
  private sel: string | null = null;
  private info!: Phaser.GameObjects.Container;
  private head!: Phaser.GameObjects.Text;
  private zoom = 0.5;
  private pinchD = 0;

  constructor() { super('tree'); }
  init(d: { run: Run }): void { this.run = d.run; this.sel = null; this.circles.clear(); this.zoom = 0.5; }

  create(): void {
    this.add.rectangle(0, 0, W, H, 0x0b0d18).setOrigin(0).setInteractive();
    this.world = this.add.container(W / 2, 288).setScale(this.zoom);
    this.links = this.add.graphics();
    this.world.add(this.links);
    BRANCHES.forEach((b) => {
      const a = (b.angle * Math.PI) / 180;
      this.world.add(this.add.text(Math.cos(a) * 490, Math.sin(a) * 490, b.name.toUpperCase(), { fontSize: '26px', color: hex(b.color), fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.6));
    });
    NODE_LIST.forEach((n) => {
      const r = n.kind === 'k' ? 20 : n.kind === 'n' ? 15 : n.kind === 'start' ? 16 : 10;
      const c = this.add.circle(n.x, n.y, r, 0x1b2036).setStrokeStyle(3, 0x40466a).setInteractive(new Phaser.Geom.Circle(r, r, r + 14), Phaser.Geom.Circle.Contains);
      c.on('pointerup', (p: Phaser.Input.Pointer) => { if (Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) < 10) this.select(n.id); });
      this.circles.set(n.id, c);
      this.world.add(c);
      if (n.kind === 'n' || n.kind === 'k') this.world.add(this.add.text(n.x, n.y + r + 8, n.name, { fontSize: '11px', color: '#c9d1ee', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5));
    });

    this.input.addPointer(1);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1, b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (this.pinchD > 0) {
          const old = this.zoom;
          this.setZoom(old * (d / this.pinchD));
          const k = this.zoom / old;
          this.world.x = mx - (mx - this.world.x) * k; this.world.y = my - (my - this.world.y) * k;
        }
        this.pinchD = d;
        return;
      }
      this.pinchD = 0;
      if (!p.isDown || p.y > 520 || p.y < 56) return;
      this.world.x += p.x - p.prevPosition.x; this.world.y += p.y - p.prevPosition.y;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1)));

    this.add.rectangle(0, 0, W, 56, 0x0b0d18).setOrigin(0).setInteractive();
    this.head = this.add.text(10, 18, '', { fontSize: '16px', color: '#ffd86b', fontStyle: 'bold' });
    btn(this, 215, 28, 56, 34, 'Reset', () => { this.run.respec(); this.sel = null; this.render(); }, 0x3a2226, 0x9b4d57, 12);
    btn(this, 275, 28, 30, 34, '+', () => this.setZoom(this.zoom * 1.2), 0x22304f, 0x4d6bb3, 18);
    btn(this, 308, 28, 30, 34, '−', () => this.setZoom(this.zoom / 1.2), 0x22304f, 0x4d6bb3, 18);
    btn(this, 342, 28, 30, 34, 'X', () => close(this), 0x4a2226, 0xc0392b, 14);
    this.info = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-T', () => close(this));
    this.render();
  }

  private setZoom(z: number): void { this.zoom = Phaser.Math.Clamp(z, 0.3, 1.5); this.world.setScale(this.zoom); }

  private select(id: string): void { this.sel = id; this.render(); }

  private color(n: TreeNode): number { return n.branch >= 0 ? BRANCHES[n.branch].color : 0xffd86b; }

  private render(): void {
    const run = this.run;
    this.head.setText(`Punkty: ${run.points}`);
    this.links.clear();
    NODE_LIST.forEach((n) => n.links.forEach((l) => {
      if (l < n.id) return;
      const o = NODES[l], on = run.alloc.has(n.id) && run.alloc.has(l);
      this.links.lineStyle(on ? 5 : 2, on ? this.color(n.branch >= 0 ? n : o) : 0x2a3050, on ? 0.95 : 1).lineBetween(n.x, n.y, o.x, o.y);
    }));
    this.circles.forEach((c, id) => {
      const n = NODES[id], on = run.alloc.has(id), can = run.canAlloc(id);
      c.setFillStyle(on ? this.color(n) : can ? 0x2d3556 : 0x1b2036);
      c.setStrokeStyle(id === this.sel ? 4 : 3, id === this.sel ? 0xffffff : on ? 0xffffff : can ? this.color(n) : 0x40466a);
    });
    this.info.removeAll(true);
    this.info.add(this.add.rectangle(0, 520, W, 120, 0x141a30).setOrigin(0).setStrokeStyle(2, 0x3a4270).setInteractive());
    if (!this.sel) {
      this.info.add(this.add.text(W / 2, 600, 'Przeciągnij, aby przesuwać. Dotknij węzła po opis.\nWykupuj węzły połączone z już wykupionymi.', { fontSize: '12px', color: '#8892b0', align: 'center' }).setOrigin(0.5));
      return;
    }
    const n = NODES[this.sel];
    const lines = fmtStats(n.stats);
    const sk = SKILL_IDS.filter((s) => SKILLS[s].catalyst === n.id).map((s) => `Umożliwia ewolucję: ${SKILLS[s].name} → ${SKILLS[s].evolvedName}`);
    this.info.add(this.add.text(12, 528, `${n.name}${n.kind === 'k' ? '  (kamień węgielny)' : n.kind === 'n' ? '  (znaczący)' : ''}`, { fontSize: '15px', color: hex(this.color(n)), fontStyle: 'bold' }));
    this.info.add(this.add.text(12, 550, [...lines, ...sk].join('\n') || 'Punkt startowy', { fontSize: '12px', color: '#dfe5ff', wordWrap: { width: 250 } }));
    if (n.id !== 'start') {
      const on = run.alloc.has(n.id), can = run.canAlloc(n.id);
      const label = on ? 'WYKUPIONY' : can ? `WYKUP (${n.cost})` : run.points < n.cost && n.links.some((l) => run.alloc.has(l)) ? `Brak punktów (${n.cost})` : 'Zablokowany';
      this.info.add(btn(this, 302, 600, 100, 44, label, () => { if (run.allocate(n.id)) this.render(); }, can ? 0x2b5a3a : 0x22242f, can ? 0x4ade80 : 0x40466a, 12));
    }
  }
}

// ================= EKWIPUNEK =================
export class InvScene extends Phaser.Scene {
  private run!: Run;
  private tab = 0;
  private sel: Item | null = null;
  private layer!: Phaser.GameObjects.Container;

  constructor() { super('inv'); }
  init(d: { run: Run }): void { this.run = d.run; this.sel = null; }

  create(): void {
    this.add.rectangle(0, 0, W, H, 0x0b0d18).setOrigin(0).setInteractive();
    this.layer = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-I', () => close(this));
    this.render();
  }

  private add_(...o: (Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[])[]): void { o.flat().forEach((x) => this.layer.add(x)); }

  private render(): void {
    this.layer.removeAll(true);
    this.add_(this.add.text(10, 14, 'EKWIPUNEK', { fontSize: '18px', color: '#ffd86b', fontStyle: 'bold' }));
    this.add_(this.add.text(130, 17, `Złoto z runu: ${this.run.gold}`, { fontSize: '12px', color: '#c9d1ee' }));
    this.add_(btn(this, 330, 24, 50, 32, 'X', () => close(this), 0x4a2226, 0xc0392b));
    ['PRZEDMIOTY', 'UMIEJĘTNOŚCI', 'STATYSTYKI'].forEach((t, i) =>
      this.add_(btn(this, 62 + i * 118, 66, 112, 30, t, () => { this.tab = i; this.sel = null; this.render(); }, this.tab === i ? 0x2b3a66 : 0x151a2c, this.tab === i ? 0xffd86b : 0x333a5c, 11)));
    if (this.tab === 0) this.items(); else if (this.tab === 1) this.skills(); else this.stats();
  }

  private itemBox(x: number, y: number, it: Item | undefined, label: string): void {
    const sel = it && it === this.sel;
    const r = this.add.rectangle(x, y, 56, 56, 0x141a30).setStrokeStyle(sel ? 4 : 3, it ? RARITY_COLOR[it.rarity] : 0x2a3050);
    this.add_(r);
    this.add_(this.add.text(x, y, it ? it.name : label, { fontSize: '9px', color: it ? hex(RARITY_COLOR[it.rarity]) : '#4a5170', align: 'center', wordWrap: { width: 52 }, maxLines: 4 }).setOrigin(0.5));
    if (it) { r.setInteractive(); r.on('pointerup', () => { this.sel = it; this.render(); }); }
  }

  private items(): void {
    const run = this.run;
    SLOTS.forEach((s, i) => {
      this.itemBox(40 + i * 70, 130, run.equipped[s], SLOT_NAME[s]);
      this.add_(this.add.text(40 + i * 70, 166, SLOT_NAME[s], { fontSize: '10px', color: '#8892b0' }).setOrigin(0.5));
    });
    this.add_(this.add.text(12, 190, `Plecak (${run.bag.length}/${BAG_SIZE})`, { fontSize: '12px', color: '#8892b0' }));
    for (let i = 0; i < BAG_SIZE; i++) this.itemBox(52 + (i % 4) * 86, 240 + Math.floor(i / 4) * 66, run.bag[i], '');
    const it = this.sel;
    if (!it) { this.add_(this.add.text(W / 2, 560, 'Dotknij przedmiotu, aby zobaczyć szczegóły.\nPrzedmioty wypadają z wrogów (elity dają rzadkie).', { fontSize: '12px', color: '#8892b0', align: 'center' }).setOrigin(0.5)); return; }
    const worn = run.equipped[it.slot] === it;
    this.add_(this.add.rectangle(0, 510, W, 130, 0x141a30).setOrigin(0).setStrokeStyle(2, RARITY_COLOR[it.rarity]));
    this.add_(this.add.text(10, 516, `${it.name}`, { fontSize: '15px', color: hex(RARITY_COLOR[it.rarity]), fontStyle: 'bold' }));
    this.add_(this.add.text(10, 536, `${RARITY_NAME[it.rarity]} ${SLOT_NAME[it.slot].toLowerCase()} · poz. ${it.ilvl}\n${fmtStats(it.stats).join('\n')}`, { fontSize: '12px', color: '#dfe5ff', lineSpacing: 2 }));
    this.add_(btn(this, 300, 548, 100, 36, worn ? 'ZDEJMIJ' : 'ZAŁÓŻ', () => { if (worn) run.unequip(it.slot); else run.equip(it); this.sel = null; this.render(); }, 0x2b5a3a, 0x4ade80, 13));
    this.add_(btn(this, 300, 596, 100, 36, `SPRZEDAJ +${sellValue(it)}`, () => { run.sell(it); this.sel = null; this.render(); }, 0x5a4a22, 0xffd86b, 11));
  }

  private skills(): void {
    const run = this.run;
    this.add_(this.add.text(12, 96, 'Sloty (dotknij umiejętność, by założyć/zdjąć)', { fontSize: '11px', color: '#8892b0' }));
    for (let i = 0; i < SLOT_COUNT; i++) {
      const id = run.slots[i];
      this.add_(this.add.rectangle(62 + i * 118, 130, 108, 40, 0x141a30).setStrokeStyle(2, id ? SKILLS[id].color : 0x2a3050));
      this.add_(this.add.text(62 + i * 118, 130, id ? `${run.skills[id].evolved ? '★ ' : ''}${SKILLS[id].name} ${run.skills[id].lvl}` : 'pusty', { fontSize: '12px', color: id ? hex(SKILLS[id].color) : '#4a5170' }).setOrigin(0.5));
    }
    SKILL_IDS.forEach((id, i) => {
      const y = 190 + i * 62, d = SKILLS[id], s = run.skills[id], on = run.slots.includes(id);
      const row = this.add.rectangle(W / 2, y, 340, 56, s.lvl ? 0x141a30 : 0x0f1220).setStrokeStyle(2, on ? d.color : 0x2a3050);
      this.add_(row);
      const status = s.lvl === 0 ? 'nie znaleziono' : s.evolved ? 'EWOLUOWANA' : s.lvl >= MAX_SKILL ? 'maks.' : `poz. ${s.lvl}/${MAX_SKILL}`;
      this.add_(this.add.text(18, y - 22, `${s.evolved ? '★ ' + d.evolvedName : d.name}   ${status}`, { fontSize: '12px', color: s.lvl ? hex(d.color) : '#4a5170', fontStyle: 'bold' }));
      this.add_(this.add.text(18, y - 4, s.evolved ? d.evolvedDesc : s.lvl >= MAX_SKILL && !run.evolveReady(id) ? `Ewolucja: wykup „${NODES[d.catalyst].name}” w drzewku` : d.desc, { fontSize: '11px', color: s.lvl ? '#c9d1ee' : '#3a4060', wordWrap: { width: 230 } }));
      if (s.lvl) { row.setInteractive(); row.on('pointerup', () => { run.toggleSkill(id); this.render(); }); }
      if (run.evolveReady(id)) this.add_(btn(this, 300, y, 80, 40, 'EWOLUCJA ★', () => { s.evolved = true; this.render(); }, 0x5a4a22, 0xffd86b, 11));
      else if (s.lvl) this.add_(this.add.text(318, y, on ? 'W UŻYCIU' : '', { fontSize: '10px', color: '#6ee79a' }).setOrigin(0.5));
    });
  }

  private stats(): void {
    const st = this.run.stats;
    const keys = Object.keys(STAT_LABEL) as StatKey[];
    this.add_(this.add.text(16, 100, [`Maks. życie: ${this.run.maxHp}`, ...keys.map((k) => fmtStat(k, st[k]).replace(/^\+/, ''))].join('\n'), { fontSize: '14px', color: '#dfe5ff', lineSpacing: 6 }));
  }
}
