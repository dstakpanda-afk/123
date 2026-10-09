import Phaser from 'phaser';
import { BOSS_POINTS, BossDef, bossFor, MODES, Mods, ModeDef, ModeId, NO_MODS, SKILLS, SKILL_IDS, SUPPORTS, SUPPORT_IDS, SkillId, SkillKind, StatKey, Stats, SupportId, combineMods, xpNeed } from './data';
import { countOf, skillBase } from './skills';
import { Character, getChar } from './char';
import { RARITY_COLOR, Item, makeItem } from './items';
import { H, S, W, setupCam, spr } from './gfx';
import { GameMap, MapView, TILE, bfs, generateMap } from './map';
import { ARCHS, Arch, PALETTE, ROSTER } from './enemies';

type Kind = Arch | 'elite' | 'boss';
interface Enemy {
  obj: Phaser.GameObjects.Image; hp: number; maxHp: number; speed: number; dmg: number; r: number; xp: number;
  hitT: number; slowT: number; frozenT: number; burnT: number; burnDps: number; elite: boolean; boss: boolean; dead: boolean;
  kind: Kind; awake: boolean; pack: number; ph: number; hy: number;
  st: 'move' | 'wind' | 'dash' | 'rest' | 'channel'; stT: number; cd: number; ax: number; ay: number; act: string; stuck: number;
  los: boolean; losT: number; aff: 'ring' | 'quake'; moveI: number; sum: boolean; emitT: number;
}
interface EShot { obj: Phaser.GameObjects.Image; vx: number; vy: number; life: number; dmg: number }
interface Tele { x: number; y: number; R: number; t: number; t0: number; dmg: number; color: number }
interface Shot {
  obj: Phaser.GameObjects.Image; vx: number; vy: number; life: number; pierce: number; dmg: number; hit: Set<Enemy>; m: Mods;
  kind: 'normal' | 'boom' | 'home'; travelled: number; maxDist: number; back: boolean; spd: number;
}
interface Zone { obj: Phaser.GameObjects.Arc; x: number; y: number; R: number; life: number; tick: number; tickEvery: number; dmg: number; m: Mods }
interface Minion { obj: Phaser.GameObjects.Image; cd: number; hitCd: number }
interface Drop { obj: Phaser.GameObjects.Image; beam?: Phaser.GameObjects.Image; item?: Item; skill?: SkillId; support?: SupportId }
interface SkillState {
  id: SkillId; kind: SkillKind; lv: number; m: Mods; cd: number; cdMax: number;
  orbs: Phaser.GameObjects.Image[]; angle: number; minions: Minion[];
}

const WAKE_STEPS = 8;

export class GameScene extends Phaser.Scene {
  private char!: Character;
  private mode!: ModeDef;
  private st!: Stats;
  private player!: Phaser.GameObjects.Image;
  private hp = 100;
  private invuln = 0;
  time_ = 0; private kills = 0; private floorKills = 0; private floor = 1; private target = 0; private total = 0;
  private portal: { x: number; y: number } | null = null; private portalOpen = false; private busy = false; private mmImg: Phaser.GameObjects.Image | null = null; private regenAcc = 0;
  private xpGained = 0; private startLevel = 1;
  private bossDef: BossDef | null = null; private unlocked: string[] = [];
  private enemies: Enemy[] = []; private shots: Shot[] = []; private zones: Zone[] = []; private drops: Drop[] = [];
  private states: SkillState[] = [];
  private fx = { frenzyT: 0, frenzyDmg: 0, frenzySpd: 0, hasteT: 0, hasteCdr: 0, shield: 0, shieldT: 0 };
  private over = false; private popCount = 0; private fxCount = 0; private found = 0;
  private map!: GameMap;
  private mapView: MapView | null = null;
  private flow = new Int16Array(0); private flowKey = -1; private flowT = 0;
  private packs: Enemy[][] = [];
  private eshots: EShot[] = []; private teles: Tele[] = [];
  private tgfx!: Phaser.GameObjects.Graphics;
  private seen = new Uint8Array(0); private mmDirty = false; private mmT = 0;
  private mmCanvas: Phaser.Textures.CanvasTexture | null = null;
  private stick!: Phaser.GameObjects.Graphics;
  private stickOrigin: Phaser.Math.Vector2 | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hudTxt!: Phaser.GameObjects.Text;
  private hpTxt!: Phaser.GameObjects.Text;
  private bossTxt!: Phaser.GameObjects.Text;
  private killTxt!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private ebars!: Phaser.GameObjects.Graphics;
  private warn!: Phaser.GameObjects.Rectangle;
  private quitTxt!: Phaser.GameObjects.Text;
  private quitArmed = false;
  private icons: Phaser.GameObjects.Image[] = [];

  constructor() { super('game'); }

  init(data: { mode?: ModeId }): void {
    this.char = getChar() as Character;
    this.char.recalc();
    this.mode = MODES[data?.mode ?? 'quick'];
    this.hp = this.char.maxHp;
    this.invuln = 0; this.time_ = 0; this.kills = 0; this.floorKills = 0; this.floor = 1; this.total = 0; this.regenAcc = 0; this.portal = null; this.portalOpen = false; this.busy = false; this.mmImg = null;
    this.xpGained = 0; this.startLevel = this.char.level; this.bossDef = null; this.unlocked = [];
    this.enemies = []; this.shots = []; this.zones = []; this.drops = []; this.states = []; this.icons = [];
    this.packs = []; this.eshots = []; this.teles = []; this.flowKey = -1; this.flowT = 0; this.mmDirty = false; this.mmT = 0;
    this.fx = { frenzyT: 0, frenzyDmg: 0, frenzySpd: 0, hasteT: 0, hasteCdr: 0, shield: 0, shieldT: 0 };
    this.over = false; this.popCount = 0; this.fxCount = 0; this.found = 0; this.stickOrigin = null; this.quitArmed = false;
  }

  create(): void {
    setupCam(this);
    this.player = spr(this, 0, 0, `pl_${this.char.cls}`).setDepth(10);
    this.tgfx = this.add.graphics().setDepth(3);
    this.events.once('shutdown', () => {
      this.mapView?.destroy(); this.mapView = null;
      if (this.textures.exists('mm')) this.textures.remove('mm');
    });

    this.ebars = this.add.graphics().setDepth(40);
    this.warn = this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0).setScrollFactor(0).setDepth(90);
    this.bars = this.add.graphics().setScrollFactor(0).setDepth(100);
    const ts = { fontSize: '13px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 };
    this.hpTxt = this.add.text(78, 21, '', { ...ts, fontSize: '12px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.killTxt = this.add.text(W / 2 + 10, 14, '', { ...ts, fontSize: '16px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.bossTxt = this.add.text(142, 69, '', { fontSize: '10px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);
    this.hudTxt = this.add.text(8, 44, '', { ...ts, fontSize: '12px' }).setScrollFactor(0).setDepth(101);
    this.stick = this.add.graphics().setScrollFactor(0).setDepth(100);
    const qb = this.add.rectangle(322, 30, 70, 28, 0x3a2226).setStrokeStyle(2, 0xc0626f).setScrollFactor(0).setDepth(100).setInteractive();
    this.quitTxt = this.add.text(322, 30, 'ZAKOŃCZ', { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    qb.on('pointerdown', () => {
      if (this.over) return;
      if (this.quitArmed) return this.end(this.mode.free && this.floor > 1);
      this.quitArmed = true; this.quitTxt.setText('NA PEWNO?');
      this.time.delayedCall(2000, () => { this.quitArmed = false; this.quitTxt.setText('ZAKOŃCZ'); });
    });

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => { if (!this.over && over.length === 0) this.stickOrigin = new Phaser.Math.Vector2(p.x / S, p.y / S); });
    this.input.on('pointerup', () => { this.stickOrigin = null; });
    this.buildStates();
    this.refreshStats();
    this.add.rectangle(284, 50, 68, 68, 0x000000, 0.45).setOrigin(0).setScrollFactor(0).setDepth(98).setStrokeStyle(1, 0xffffff, 0.35);
    this.loadLevel();
    this.icons = this.states.map((s, i) => spr(this, W / 2 + (i - (this.states.length - 1) / 2) * 50, H - 30, `ic_${s.id}`).setScale(40 / 44 / S).setScrollFactor(0).setDepth(100));
    Object.assign(window, { __game: this, __mk: makeItem }); // do testów
  }

  /** buduje (lub przebudowuje) piętro: mapa, wrogowie, minimapa */
  private loadLevel(): void {
    for (const e of this.enemies) e.obj.destroy();
    for (const sh of this.shots) sh.obj.destroy();
    for (const sh of this.eshots) sh.obj.destroy();
    for (const z of this.zones) z.obj.destroy();
    for (const d of this.drops) { d.obj.destroy(); d.beam?.destroy(); }
    this.enemies = []; this.shots = []; this.eshots = []; this.zones = []; this.drops = []; this.packs = []; this.teles = [];
    this.floorKills = 0; this.portal = null; this.portalOpen = false; this.flowKey = -1;
    this.mapView?.destroy();
    const seed = Math.floor(Math.random() * 1e9);
    this.map = generateMap(this.mode.size, seed);
    this.cameras.main.setBackgroundColor(this.map.biome.void);
    this.mapView = new MapView(this, this.map, seed);
    this.flow = new Int16Array(this.map.w * this.map.h);
    this.seen = new Uint8Array(this.map.w * this.map.h);
    this.player.setPosition((this.map.start[0] + 0.5) * TILE, (this.map.start[1] + 0.5) * TILE);
    this.cameras.main.setScroll(this.player.x - W / 2, this.player.y - H / 2);
    this.mapView.update(this.player.x - W / 2, this.player.y - H / 2, W, H, 999);
    this.target = this.mode.free ? Math.min(220, this.mode.target + 12 * (this.floor - 1)) : this.mode.target;
    this.populate();
    if (this.mode.free) this.portal = { x: (this.map.far[0] + 0.5) * TILE, y: (this.map.far[1] + 0.5) * TILE };
    this.mmImg?.destroy();
    if (this.textures.exists('mm')) this.textures.remove('mm');
    this.mmCanvas = this.textures.createCanvas('mm', this.map.w, this.map.h);
    this.mmCanvas?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.mmImg = this.add.image(284, 50, 'mm').setOrigin(0).setScale(68 / Math.max(this.map.w, this.map.h)).setScrollFactor(0).setDepth(99);
    this.mmDirty = false; this.mmT = 0;
    this.reveal(true);
    this.toast(this.mode.free ? `Piętro ${this.floor}: ${this.map.biome.name}` : this.map.biome.name, '#c9a4ff');
  }

  /** wejście do portalu: następne piętro */
  private nextFloor(): void {
    this.busy = true;
    this.floor++;
    this.char.totals.maxFloor = Math.max(this.char.totals.maxFloor, this.floor);
    this.checkAch(); this.char.save();
    const cam = this.cameras.main;
    cam.fadeOut(260, 10, 8, 20);
    cam.once('camerafadeoutcomplete', () => {
      this.loadLevel();
      this.heal(Math.round(this.char.maxHp * 0.4));
      cam.fadeIn(260, 10, 8, 20);
      this.busy = false;
    });
  }

  // ---------- statystyki biegu (postać + aury + chwilowe wzmocnienia) ----------
  private strength(m: Mods): number { return m.dmg * m.area; }

  private refreshStats(): void {
    const b: Stats = { ...this.char.stats };
    const add = (k: StatKey, v: number) => { b[k] += v; };
    for (const s of this.states) {
      if (s.kind !== 'aura') continue;
      const k = this.strength(s.m), sb = skillBase(s.id, s.lv);
      switch (s.id) {
        case 'a_fury': add('dmg', (sb.a / 100) * k); break;
        case 'a_haste': add('cdr', (sb.a / 100) * k); add('speed', (sb.b / 100) * k); break;
        case 'a_guard': add('armor', sb.a * k); add('regen', sb.b * k); break;
        case 'a_sight': add('crit', (sb.a / 100) * k); add('area', (sb.b / 100) * k); break;
        default: break;
      }
    }
    if (this.fx.frenzyT > 0) { b.dmg += this.fx.frenzyDmg; b.speed += this.fx.frenzySpd; }
    if (this.fx.hasteT > 0) b.cdr += this.fx.hasteCdr;
    b.cdr = Math.min(0.75, b.cdr); b.crit = Math.min(0.9, b.crit);
    this.st = b;
  }

  private buildStates(): void {
    this.states = this.char.loadout.filter((l) => l.skill).map((l) => {
      const id = l.skill as SkillId, m = combineMods(l.sup), kind = SKILLS[id].kind;
      const s: SkillState = { id, kind, lv: this.char.skills[id], m, cd: kind === 'buff' ? 1.5 : 0, cdMax: 1, orbs: [], angle: 0, minions: [] };
      if (kind === 'minion') {
        const n = countOf(id, skillBase(id, s.lv), Math.round(this.char.stats.proj) + m.proj, m);
        for (let i = 0; i < n; i++) s.minions.push({ obj: spr(this, 0, 0, id === 'm_eye' ? 'mn_eye' : 'mn_servant').setDepth(9), cd: 0.5 + i * 0.3, hitCd: 0 });
      }
      return s;
    });
  }

  // ---------- pętla ----------
  update(_t: number, dtMs: number): void {
    this.drawHud();
    if (this.over || this.busy) return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.time_ += dt; this.invuln -= dt;
    this.tickFx(dt);
    this.regenAcc += this.st.regen * dt;
    if (this.regenAcc >= 1) { this.heal(Math.floor(this.regenAcc)); this.regenAcc %= 1; }

    this.move(dt);
    this.updateFlow(dt);
    this.states.forEach((s) => (s.kind === 'attack' ? this.cast(s, dt) : s.kind === 'buff' ? this.castBuff(s, dt) : s.kind === 'minion' ? this.minions(s, dt) : undefined));
    this.updateShots(dt);
    this.updateZones(dt);
    this.updateEnemies(dt);
    this.updateEShots(dt);
    this.updateTeles(dt);
    this.updateDrops();
    this.reveal(false, dt);

    const cam = this.cameras.main, k = Math.min(1, 9 * dt);
    cam.scrollX += (this.player.x - W / 2 - cam.scrollX) * k;
    cam.scrollY += (this.player.y - H / 2 - cam.scrollY) * k;
    this.mapView?.update(cam.scrollX, cam.scrollY, W, H);

    if (this.hp <= 0) this.end(this.mode.free && this.floor > 1);
    else if (this.mode.free) this.portalTick();
    else if (this.enemies.every((e) => e.sum)) { for (const e of this.enemies) e.obj.destroy(); this.enemies = []; this.end(true); }
  }

  private portalTick(): void {
    if (!this.portal) return;
    const left = this.enemies.filter((e) => !e.sum).length, boss = this.enemies.some((e) => e.boss);
    if (!this.portalOpen && !boss && left <= Math.max(3, this.total * 0.12)) {
      this.portalOpen = true; this.toast('PORTAL OTWARTY: wejdź, aby zejść głębiej', '#b18cff');
    }
    if (this.portalOpen && this.dist(this.player, this.portal) < 30) this.nextFloor();
  }

  private tickFx(dt: number): void {
    const f = this.fx;
    let dirty = false;
    if (f.frenzyT > 0) { f.frenzyT -= dt; if (f.frenzyT <= 0) dirty = true; }
    if (f.hasteT > 0) { f.hasteT -= dt; if (f.hasteT <= 0) dirty = true; }
    if (f.shieldT > 0) { f.shieldT -= dt; if (f.shieldT <= 0) f.shield = 0; }
    if (dirty) this.refreshStats();
  }

  private heal(v: number): void { this.hp = Math.min(this.char.maxHp, this.hp + v); }

  private move(dt: number): void {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) dx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) dx += 1;
    if (k.W.isDown || k.UP.isDown) dy -= 1;
    if (k.S.isDown || k.DOWN.isDown) dy += 1;
    this.stick.clear();
    const p = this.input.activePointer;
    if (this.stickOrigin && p.isDown) {
      const v = new Phaser.Math.Vector2(p.x / S - this.stickOrigin.x, p.y / S - this.stickOrigin.y);
      const len = Math.min(v.length(), 50);
      if (len > 6) { v.setLength(len); dx = v.x / 50; dy = v.y / 50; }
      this.stick.lineStyle(3, 0xffffff, 0.35).strokeCircle(this.stickOrigin.x, this.stickOrigin.y, 50);
      this.stick.fillStyle(0xffffff, 0.12).fillCircle(this.stickOrigin.x, this.stickOrigin.y, 50);
      this.stick.fillStyle(0xffffff, 0.5).fillCircle(this.stickOrigin.x + v.x, this.stickOrigin.y + v.y, 20);
    }
    const v = new Phaser.Math.Vector2(dx, dy);
    if (v.length() > 1) v.normalize();
    const sp = 130 * (1 + this.st.speed);
    this.slide(this.player, v.x * sp * dt, v.y * sp * dt, 8);
  }

  /** ruch po osiach z kolizją ze ścianami; zwraca, czy się ruszył */
  slide(o: { x: number; y: number }, dx: number, dy: number, r: number): boolean {
    let moved = false;
    if (dx && this.canStand(o.x + dx, o.y, r)) { o.x += dx; moved = true; }
    if (dy && this.canStand(o.x, o.y + dy, r)) { o.y += dy; moved = true; }
    return moved;
  }

  /** public na potrzeby testów */
  moveBy(dx: number, dy: number): void { this.slide(this.player, dx, dy, 8); }

  private solidAt(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), m = this.map;
    return tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || m.solid[ty * m.w + tx] === 1;
  }
  private canStand(x: number, y: number, r: number): boolean {
    return !this.solidAt(x - r, y - r) && !this.solidAt(x + r, y - r) && !this.solidAt(x - r, y + r) && !this.solidAt(x + r, y + r);
  }
  /** czy linia między punktami nie przechodzi przez ścianę (opcjonalnie z grubością) */
  private clear(x0: number, y0: number, x1: number, y1: number, thick = 0): boolean {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    if (d < 1) return true;
    const n = Math.ceil(d / 10), nx = -dy / d * thick, ny = dx / d * thick;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = x0 + dx * t, y = y0 + dy * t;
      if (this.solidAt(x, y) || (thick && (this.solidAt(x + nx, y + ny) || this.solidAt(x - nx, y - ny)))) return false;
    }
    return true;
  }
  private tileOf(o: { x: number; y: number }): number { return Math.floor(o.y / TILE) * this.map.w + Math.floor(o.x / TILE); }

  /** pole odległości od gracza (BFS), odświeżane przy zmianie kafelka */
  private updateFlow(dt: number): void {
    this.flowT -= dt;
    const k = this.tileOf(this.player);
    if (k === this.flowKey && this.flowT > 0) return;
    this.flowKey = k; this.flowT = 0.3;
    bfs(this.map.solid, this.map.w, this.map.h, k % this.map.w, (k / this.map.w) | 0, this.flow);
  }

  /** kierunek (jednostkowy) kroku z (x,y) w stronę celu po ścieżce; do testów i botów */
  pathDir(x: number, y: number, tx: number, ty: number): [number, number] {
    const m = this.map, f = new Int16Array(m.w * m.h);
    bfs(m.solid, m.w, m.h, Math.floor(tx / TILE), Math.floor(ty / TILE), f);
    return this.descend(f, x, y);
  }
  private descend(f: Int16Array, x: number, y: number): [number, number] {
    const m = this.map, cx = Math.floor(x / TILE), cy = Math.floor(y / TILE), here = f[cy * m.w + cx];
    let best = here < 0 ? 1e9 : here, bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const v = f[ny * m.w + nx];
      if (v < 0 || v >= best) continue;
      if (dx && dy && (m.solid[cy * m.w + nx] || m.solid[ny * m.w + cx])) continue;
      best = v; bx = dx; by = dy;
    }
    if (!bx && !by) return [0, 0];
    const ax = (cx + bx + 0.5) * TILE - x, ay = (cy + by + 0.5) * TILE - y, l = Math.hypot(ax, ay) || 1;
    return [ax / l, ay / l];
  }

  /** odkrywanie mapy do minimapy */
  private reveal(force: boolean, dt = 0): void {
    const m = this.map, cv = this.mmCanvas;
    if (!cv) return;
    if (!force) {
      this.mmT -= dt;
      if (this.mmT > 0) return;
    }
    this.mmT = 0.25;
    const px = Math.floor(this.player.x / TILE), py = Math.floor(this.player.y / TILE), R = 7, ctx = cv.context;
    const pal = m.biome;
    for (let y = py - R; y <= py + R; y++) for (let x = px - R; x <= px + R; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h || (x - px) ** 2 + (y - py) ** 2 > R * R) continue;
      const i = y * m.w + x;
      if (this.seen[i]) continue;
      this.seen[i] = 1; this.mmDirty = true;
      ctx.fillStyle = m.solid[i] ? '#' + pal.void.toString(16).padStart(6, '0') : '#' + pal.rim.toString(16).padStart(6, '0');
      ctx.fillRect(x, y, 1, 1);
    }
    if (this.mmDirty) { cv.refresh(); this.mmDirty = false; }
  }


  // ---------- przeciwnicy: rozmieszczeni na mapie od początku ----------
  private populate(): void {
    const m = this.map, md = this.mode, rnd = Math.random;
    const cand = m.open.filter((i) => m.dist[i] >= 9);
    const centers: [number, number][] = [];
    const pick = (): number => {
      for (let t = 0; t < 40; t++) {
        const i = cand[Math.floor(rnd() * cand.length)], x = i % m.w, y = (i / m.w) | 0;
        if (centers.every(([cx, cy]) => (cx - x) ** 2 + (cy - y) ** 2 > 20)) return i;
      }
      return cand[Math.floor(rnd() * cand.length)];
    };
    const around = (i: number): [number, number] => {
      const cx = i % m.w, cy = (i / m.w) | 0;
      for (let t = 0; t < 12; t++) {
        const x = cx + Math.round((rnd() - 0.5) * 5), y = cy + Math.round((rnd() - 0.5) * 5);
        if (x > 0 && y > 0 && x < m.w && y < m.h && m.dist[y * m.w + x] >= 6) return [(x + 0.2 + rnd() * 0.6) * TILE, (y + 0.2 + rnd() * 0.6) * TILE];
      }
      return [(cx + 0.5) * TILE, (cy + 0.5) * TILE];
    };
    const roster = ROSTER[m.biome.id] ?? ROSTER.void;
    const pickArch = (d: number): Arch => {
      const ws = roster.map((a) => Phaser.Math.Linear(ARCHS[a].w0, ARCHS[a].w1, d));
      let r = rnd() * ws.reduce((a, b) => a + b, 0);
      for (let i = 0; i < roster.length; i++) { r -= ws[i]; if (r <= 0) return roster[i]; }
      return roster[0];
    };
    const nElite = md.eliteEvery > 0 ? Math.floor(this.target / md.eliteEvery) : 0;
    let left = this.target - nElite;
    let pack = 0;
    const depthOf = (i: number) => m.dist[i] / m.maxDist;
    const add = (kind: Kind, i: number, d: number, grp: Enemy[]) => { const [x, y] = around(i); grp.push(this.makeEnemy(kind, x, y, d, pack)); };
    for (let e = 0; e < nElite; e++) {
      const i = pick(); centers.push([i % m.w, (i / m.w) | 0]);
      const d = depthOf(i), grp: Enemy[] = [];
      add('elite', i, d, grp);
      for (let k = 0; k < 2 && left > 0; k++, left--) add('melee', i, d, grp);
      this.packs.push(grp); pack++;
    }
    while (left > 0) {
      const i = pick(); centers.push([i % m.w, (i / m.w) | 0]);
      const d = depthOf(i), grp: Enemy[] = [], lead = pickArch(d), def = ARCHS[lead];
      const escorted = lead === 'totem' || lead === 'caster' || lead === 'slam';
      let n = Math.min(left, def.pack[0] + Math.floor(rnd() * (def.pack[1] - def.pack[0] + 1)));
      if (escorted) { add(lead, i, d, grp); n = Math.min(left - 1, 2 + Math.floor(rnd() * 2)); for (let k = 0; k < n; k++) add('melee', i, d, grp); left -= 1 + n; }
      else { for (let k = 0; k < n; k++) add(k === 0 || rnd() < 0.75 || lead === 'swarm' ? lead : 'melee', i, d, grp); left -= n; }
      this.packs.push(grp); pack++;
    }
    if (md.boss || (md.free && this.floor % 3 === 0)) {
      this.bossDef = bossFor(m.biome.id);
      this.packs.push([this.makeEnemy('boss', (m.far[0] + 0.5) * TILE, (m.far[1] + 0.5) * TILE, 1, pack)]);
    }
    this.total = this.enemies.length;
  }

  /** najbliższe miejsce, w którym zmieści się okrąg o promieniu r (żeby wróg nie wrósł w ścianę) */
  private freeSpot(x: number, y: number, r: number): [number, number] {
    if (this.canStand(x, y, r)) return [x, y];
    for (let d = 5; d <= 56; d += 5) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 6.283, nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d;
      if (this.canStand(nx, ny, r)) return [nx, ny];
    }
    return [x, y];
  }

  private makeEnemy(kind: Kind, x: number, y: number, depth: number, pack: number, sum = false): Enemy {
    const L = this.char.level, bid = this.map.biome.id, fl = this.floor - 1;
    const hpScale = (1 + 0.15 * (L - 1)) * (1 + this.mode.ramp * (kind === 'boss' ? 0.5 : depth)) * this.mode.hpMul * (1 + 0.12 * fl) * (sum ? 0.5 : 1);
    const dmgScale = (1 + 0.07 * (L - 1)) * this.mode.dmgMul * (1 + 0.15 * depth) * (1 + 0.07 * fl);
    const xpScale = (1 + 0.2 * (L - 1)) * this.mode.xpMul * (1 + 0.1 * fl);
    let key = `e_elite_${bid}`, r = 22, hp = 150, speed = 50, dmg = 12, xp = 12, big = 1;
    if (kind === 'boss' && this.bossDef) { key = `boss_${bid}`; r = 28 * this.bossDef.scale; hp = 700 * this.bossDef.hpMul; speed = 42; dmg = 20 * this.bossDef.dmgMul; xp = 90 * this.bossDef.hpMul; big = this.bossDef.scale; }
    else if (kind !== 'elite' && kind !== 'boss') { const a = ARCHS[kind]; key = `e_${a.shape}_${bid}`; r = a.r; hp = a.hp; speed = a.speed; dmg = a.dmg; xp = a.xp; }
    [x, y] = this.freeSpot(x, y, Math.min(r, 11) + 2);
    const obj = spr(this, x, y, key).setDepth(kind === 'boss' ? 6 : 5);
    if (big !== 1) obj.setScale(big / S);
    const aff = Math.random() < 0.5 ? 'ring' : 'quake';
    if (kind === 'elite' && aff === 'quake') obj.setTint(0xc77dff);
    const e: Enemy = {
      obj, hp: hp * hpScale, maxHp: hp * hpScale, speed, dmg: dmg * dmgScale, r, xp: xp * xpScale, hitT: 0, slowT: 0, frozenT: 0, burnT: 0, burnDps: 0,
      elite: kind === 'elite', boss: kind === 'boss', dead: false, kind, awake: false, pack, ph: Math.random() * 6.28, hy: y,
      st: 'move', stT: 0, cd: 0.5 + Math.random() * 1.5, ax: 0, ay: 0, act: '', stuck: 0, los: false, losT: Math.random() * 0.15, aff, moveI: 0, sum, emitT: 0,
    };
    this.enemies.push(e);
    return e;
  }

  /** osiągnięcia: punkty i powiadomienia */
  private checkAch(): void {
    for (const a of this.char.checkAchievements()) { this.unlocked.push(`${a.name} +${a.pts}`); this.toast(`OSIĄGNIĘCIE: ${a.name}  +${a.pts} pkt`, '#7be8a8'); }
  }

  private nearestTo(x: number, y: number, maxD = 1e9, skip?: Set<Enemy>): Enemy | null {
    const blocked = new Set<Enemy>();
    for (let tries = 0; tries < 6; tries++) {
      let best: Enemy | null = null, bd = maxD * maxD;
      for (const e of this.enemies) {
        if (skip?.has(e) || e.dead || blocked.has(e)) continue;
        const d = (e.obj.x - x) ** 2 + (e.obj.y - y) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return null;
      if (this.clear(x, y, best.obj.x, best.obj.y)) return best;
      blocked.add(best);
    }
    return null;
  }
  private dist(a: { x: number; y: number }, b: { x: number; y: number }): number { return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y); }

  // ---------- ataki ----------
  private cast(s: SkillState, dt: number): void {
    if (s.id === 'orbs') return this.orbs(s, dt);
    s.cd -= dt;
    if (s.cd > 0) return;
    if (this.fire(s, 1, false) && s.m.echo > 0) this.time.delayedCall(450, () => { if (!this.over) this.fire(s, 0.7, true); });
  }

  private shot(x: number, y: number, key: string, ang: number, spd: number, life: number, pierce: number, dmg: number, m: Mods, kind: Shot['kind'] = 'normal', maxDist = 0): Shot {
    const obj = spr(this, x, y, key).setDepth(8).setRotation(ang);
    const sh: Shot = { obj, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life, pierce, dmg, hit: new Set(), m, kind, travelled: 0, maxDist, back: false, spd };
    this.shots.push(sh);
    return sh;
  }

  /** zwraca true, jeśli umiejętność wystrzeliła (jest cel) */
  private fire(s: SkillState, dmgS: number, echo: boolean): boolean {
    const { lv, m } = s, st = this.st, P = this.player, b = skillBase(s.id, lv);
    const area = (1 + st.area) * m.area, extra = Math.round(st.proj) + m.proj, cdm = (1 - st.cdr) * m.cd;
    const setCd = () => { if (!echo) { s.cd = Math.max(0.2, b.cd * cdm); s.cdMax = s.cd; } };
    const aimAt = (e: Enemy) => Math.atan2(e.obj.y - P.y, e.obj.x - P.x);
    const n = countOf(s.id, b, extra, m), dmg = b.dmg * dmgS;

    switch (s.id) {
      case 'blade': {
        const target = this.nearestTo(P.x, P.y, 170 * area);
        if (!target) return false;
        setCd();
        const ang = aimAt(target), range = b.range * area, half = Math.PI / 2;
        for (let i = 0; i < n; i++) {
          const a = ang + (i - (n - 1) / 2) * 1.0;
          for (const e of this.enemies.slice()) {
            if (e.dead || this.dist(P, e.obj) > range + e.r) continue;
            if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.obj.y - P.y, e.obj.x - P.x) - a)) > half) continue;
            this.hurt(e, dmg, m);
          }
          const arc = this.add.graphics().setDepth(9);
          arc.fillStyle(SKILLS.blade.color, 0.4).slice(P.x, P.y, range, a - half, a + half).fillPath();
          this.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
        }
        return true;
      }
      case 'bolt': {
        const target = this.nearestTo(P.x, P.y, 420);
        if (!target) return false;
        setCd();
        const ang = aimAt(target);
        for (let i = 0; i < n; i++) this.shot(P.x, P.y, 'bolt', ang + (i - (n - 1) / 2) * 0.14, 320, 1.4, b.pierce + m.pierce, dmg, m);
        return true;
      }
      case 'lance': {
        const target = this.nearestTo(P.x, P.y, 460);
        if (!target) return false;
        setCd();
        const ang = aimAt(target);
        for (let i = 0; i < n; i++) this.shot(P.x, P.y, 'lance', ang + (i - (n - 1) / 2) * 0.12, 540, 0.95, b.pierce + m.pierce, dmg, m);
        return true;
      }
      case 'scythe': {
        const target = this.nearestTo(P.x, P.y, 320);
        if (!target) return false;
        setCd();
        const ang = aimAt(target);
        for (let i = 0; i < n; i++) this.shot(P.x, P.y, 'scythe', ang + (i - (n - 1) / 2) * 0.6, 300, 6, 999, dmg, m, 'boom', b.range * area);
        return true;
      }
      case 'swarm': {
        if (!this.nearestTo(P.x, P.y, 420)) return false;
        setCd();
        for (let i = 0; i < n; i++) this.shot(P.x, P.y, 'wisp', Math.random() * Math.PI * 2, 240, 2.6, b.pierce + m.pierce, dmg, m, 'home');
        return true;
      }
      case 'rift': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < 340);
        if (!pool.length) return false;
        setCd();
        const R = b.range * area;
        for (let i = 0; i < n; i++) {
          const e = Phaser.Utils.Array.GetRandom(pool);
          const obj = this.add.circle(e.obj.x, e.obj.y, R, SKILLS.rift.color, 0.2).setStrokeStyle(3, SKILLS.rift.color, 0.9).setDepth(2);
          this.tweens.add({ targets: obj, scale: 1.08, yoyo: true, repeat: -1, duration: 400 });
          this.zones.push({ obj, x: e.obj.x, y: e.obj.y, R, life: b.dur, tick: 0.1, tickEvery: b.a, dmg, m });
        }
        return true;
      }
      case 'nova': {
        if (!this.nearestTo(P.x, P.y, 200 * area)) return false;
        setCd();
        const R = b.range * area;
        for (const e of this.enemies.slice()) {
          if (e.dead || this.dist(P, e.obj) > R + e.r) continue;
          this.hurt(e, dmg, m);
          e.slowT = Math.max(e.slowT, b.dur + m.slow);
        }
        const ring = this.add.circle(P.x, P.y, R, SKILLS.nova.color, 0.18).setStrokeStyle(3, SKILLS.nova.color).setDepth(9).setScale(0.1);
        this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
        return true;
      }
      case 'chain': {
        const first = this.nearestTo(P.x, P.y, 280);
        if (!first) return false;
        setCd();
        const hit = new Set<Enemy>(), g = this.add.graphics().setDepth(11);
        g.lineStyle(3, SKILLS.chain.color);
        let cur: Enemy | null = first, px = P.x, py = P.y;
        for (let i = 0; i < n && cur; i++) {
          g.lineBetween(px, py, cur.obj.x, cur.obj.y);
          hit.add(cur); px = cur.obj.x; py = cur.obj.y;
          this.hurt(cur, dmg, m);
          cur = this.nearestTo(px, py, 150, hit);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
        return true;
      }
      case 'meteor': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < 340);
        if (!pool.length) return false;
        setCd();
        const R = b.range * area;
        for (let i = 0; i < n; i++) {
          const e = Phaser.Utils.Array.GetRandom(pool), x = e.obj.x, y = e.obj.y;
          const mark = this.add.circle(x, y, R, SKILLS.meteor.color, 0.15).setStrokeStyle(2, SKILLS.meteor.color).setDepth(2);
          this.time.delayedCall(700, () => { mark.destroy(); this.blast(x, y, R, dmg, m, SKILLS.meteor.color); });
        }
        return true;
      }
      case 'spikes': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < 260);
        if (!pool.length) return false;
        setCd();
        const R = b.range * area;
        Phaser.Utils.Array.Shuffle(pool).slice(0, n).forEach((e) => {
          const x = e.obj.x, y = e.obj.y;
          const mark = this.add.circle(x, y, R, SKILLS.spikes.color, 0.12).setStrokeStyle(2, SKILLS.spikes.color).setDepth(2);
          this.time.delayedCall(450, () => { mark.destroy(); this.blast(x, y, R, dmg, m, SKILLS.spikes.color); });
        });
        return true;
      }
      case 'tentacles': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < b.range * area);
        if (!pool.length) return false;
        setCd();
        const g = this.add.graphics().setDepth(11);
        g.lineStyle(4, SKILLS.tentacles.color, 0.9);
        Phaser.Utils.Array.Shuffle(pool).slice(0, n).forEach((e) => {
          const ex = e.obj.x, ey = e.obj.y, mx = (P.x + ex) / 2 + (Math.random() - 0.5) * 60, my = (P.y + ey) / 2 + (Math.random() - 0.5) * 60;
          g.strokePoints(new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(P.x, P.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(ex, ey)).getPoints(14));
          this.hurt(e, dmg, m);
          if (!e.dead && !e.boss) {
            const a = Math.atan2(P.y - e.obj.y, P.x - e.obj.x);
            this.slide(e.obj, Math.cos(a) * 28, Math.sin(a) * 28, Math.min(e.r, 10));
          }
        });
        this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
        return true;
      }
      default: return false;
    }
  }

  private blast(x: number, y: number, R: number, base: number, m: Mods, color: number): void {
    for (const t of this.enemies.slice()) if (!t.dead && Phaser.Math.Distance.Between(x, y, t.obj.x, t.obj.y) < R + t.r) this.hurt(t, base, m);
    const boom = this.add.circle(x, y, R, color, 0.55).setDepth(9);
    this.tweens.add({ targets: boom, alpha: 0, scale: 1.3, duration: 300, onComplete: () => boom.destroy() });
  }

  private orbs(s: SkillState, dt: number): void {
  const { lv, m } = s, st = this.st, b = skillBase('orbs', lv);
    const area = (1 + st.area) * m.area, want = countOf('orbs', b, Math.round(st.proj) + m.proj, m);
    while (s.orbs.length < want) s.orbs.push(spr(this, 0, 0, 'orb').setDepth(9));
    s.angle += (dt * b.a) / Math.max(0.5, (1 - st.cdr) * m.cd);
    const R = b.range * area;
    s.orbs.forEach((o, i) => {
      const a = s.angle + (i / s.orbs.length) * Math.PI * 2;
      o.setPosition(this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R).setRotation(a);
      for (const e of this.enemies.slice()) {
        if (e.dead || e.hitT > 0) continue;
        if (this.dist(o, e.obj) < e.r + 10) this.hurt(e, b.dmg, m);
      }
    });
  }

  // ---------- wzmocnienia (sloty pomocnicze) ----------
  private castBuff(s: SkillState, dt: number): void {
    s.cd -= dt;
    if (s.cd > 0) return;
    const { lv, m } = s, k = this.strength(m), P = this.player, cdm = (1 - this.st.cdr) * m.cd, b = skillBase(s.id, lv);
    if (!this.nearestTo(P.x, P.y, 300)) return;
    const f = this.fx;
    const ring = (color: number, R: number) => {
      const r = this.add.circle(P.x, P.y, R, color, 0.2).setStrokeStyle(3, color).setDepth(9);
      this.tweens.add({ targets: r, alpha: 0, scale: 1.4, duration: 450, onComplete: () => r.destroy() });
    };
    s.cd = Math.max(0.5, b.cd * cdm);
    switch (s.id) {
      case 'heal': {
        this.heal(Math.round(this.char.maxHp * (b.a / 100) * k));
        const R = b.range * (1 + this.st.area) * m.area;
        for (const e of this.enemies.slice()) if (!e.dead && this.dist(P, e.obj) < R + e.r) this.hurt(e, b.dmg, m);
        ring(SKILLS.heal.color, R); break;
      }
      case 'frenzy': f.frenzyT = b.dur; f.frenzyDmg = (b.a / 100) * k; f.frenzySpd = (b.b / 100) * k; ring(SKILLS.frenzy.color, 50); this.refreshStats(); break;
      case 'haste': f.hasteT = b.dur; f.hasteCdr = (b.a / 100) * k; ring(SKILLS.haste.color, 50); this.refreshStats(); break;
      case 'ward': f.shield = this.char.maxHp * (b.a / 100) * k; f.shieldT = b.dur; ring(SKILLS.ward.color, 50); break;
      default: break;
    }
    s.cdMax = Math.max(1, s.cd);
  }

  // ---------- słudzy ----------
  private minions(s: SkillState, dt: number): void {
    const { lv, m } = s, P = this.player, cdm = (1 - this.st.cdr) * m.cd, n = s.minions.length, b = skillBase(s.id, lv);
    s.angle += dt * 1.4;
    s.minions.forEach((mn, i) => {
      const o = mn.obj;
      mn.hitCd -= dt;
      if (s.id === 'm_eye') {
        const a = s.angle + (i / n) * Math.PI * 2;
        const tx = P.x + Math.cos(a) * 46, ty = P.y + Math.sin(a) * 46 - 8;
        o.x += (tx - o.x) * Math.min(1, 7 * dt); o.y += (ty - o.y) * Math.min(1, 7 * dt);
        mn.cd -= dt;
        if (mn.cd <= 0) {
          const t = this.nearestTo(o.x, o.y, 300);
          if (t) { mn.cd = b.cd * cdm; this.shot(o.x, o.y, 'wisp', Math.atan2(t.obj.y - o.y, t.obj.x - o.x), 300, 1.2, 1 + m.pierce, b.dmg, m); }
          else mn.cd = 0.3;
        }
      } else {
        const t = this.nearestTo(o.x, o.y, 280);
        let tx = P.x + Math.cos(s.angle + (i / n) * Math.PI * 2) * 40, ty = P.y + Math.sin(s.angle + (i / n) * Math.PI * 2) * 40, sp = 140;
        if (t) { tx = t.obj.x; ty = t.obj.y; sp = 150 + 8 * lv; }
        const a = Math.atan2(ty - o.y, tx - o.x), d = Phaser.Math.Distance.Between(o.x, o.y, tx, ty);
        if (d > 6) { o.x += Math.cos(a) * sp * dt; o.y += Math.sin(a) * sp * dt; }
        if (t && mn.hitCd <= 0 && d < t.r + 14) { mn.hitCd = b.cd * cdm; this.hurt(t, b.dmg, m); }
      }
      o.setScale((1 + Math.sin(this.time_ * 6 + i) * 0.04) / S);
    });
  }

  private updateShots(dt: number): void {
    this.shots = this.shots.filter((s) => {
      const o = s.obj;
      if (s.kind === 'home') {
        const t = this.nearestTo(o.x, o.y, 420);
        if (t) {
          const a = Math.atan2(t.obj.y - o.y, t.obj.x - o.x);
          s.vx += (Math.cos(a) * s.spd - s.vx) * Math.min(1, 6 * dt); s.vy += (Math.sin(a) * s.spd - s.vy) * Math.min(1, 6 * dt);
        }
        o.setRotation(Math.atan2(s.vy, s.vx));
      } else if (s.kind === 'boom') {
        o.rotation += 14 * dt;
        if (!s.back && s.travelled >= s.maxDist) { s.back = true; s.hit.clear(); }
        if (s.back) {
          const a = Math.atan2(this.player.y - o.y, this.player.x - o.x);
          s.vx = Math.cos(a) * 340; s.vy = Math.sin(a) * 340;
          if (this.dist(o, this.player) < 16) { o.destroy(); return false; }
        }
      }
      const dx = s.vx * dt, dy = s.vy * dt;
      o.x += dx; o.y += dy; s.life -= dt; s.travelled += Math.hypot(dx, dy);
      let alive = s.life > 0 && !(s.kind !== 'boom' && this.solidAt(o.x, o.y));
      for (const e of this.enemies.slice()) {
        if (!alive) break;
        if (e.dead || s.hit.has(e)) continue;
        if (this.dist(o, e.obj) < e.r + 6) {
          s.hit.add(e); this.hurt(e, s.dmg, s.m);
          if (--s.pierce <= 0) alive = false;
        }
      }
      if (!alive) o.destroy();
      return alive;
    });
  }

  private updateZones(dt: number): void {
    this.zones = this.zones.filter((z) => {
      z.life -= dt; z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.tickEvery;
        for (const e of this.enemies.slice()) if (!e.dead && Phaser.Math.Distance.Between(z.x, z.y, e.obj.x, e.obj.y) < z.R + e.r) this.hurt(e, z.dmg, z.m);
      }
      if (z.life <= 0) { z.obj.destroy(); return false; }
      return true;
    });
  }

  // ---------- trafienia, zabicia, XP ----------
  private hurt(e: Enemy, base: number, m: Mods = NO_MODS): void {
    if (e.dead) return;
    if (!e.awake) this.wake(e.pack);
    const st = this.st;
    const crit = Math.random() < st.crit + m.crit;
    const v = Math.max(1, base * (1 + st.dmg) * m.dmg * (crit ? 1 + st.critDmg : 1));
    e.hp -= v; e.hitT = 0.35; e.obj.setTintFill(0xffffff);
    const steal = st.steal + m.steal;
    if (steal > 0) this.heal(Math.min(3, v * steal));
    if (m.slow > 0) e.slowT = Math.max(e.slowT, m.slow);
    if (m.burn > 0) { e.burnT = 3; e.burnDps = Math.max(e.burnDps, (v * m.burn) / 3); }
    this.pop(e.obj.x, e.obj.y - e.r, Math.round(v).toString(), crit ? '#ffd24d' : '#ffffff', crit);
    if (e.hp <= 0) return this.kill(e);
    if (m.knock > 0 && !e.boss) {
      const a = Math.atan2(e.obj.y - this.player.y, e.obj.x - this.player.x);
      this.slide(e.obj, Math.cos(a) * 18, Math.sin(a) * 18, Math.min(e.r, 10));
    }
  }

  private kill(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    if (e.sum) { e.obj.destroy(); this.enemies.splice(this.enemies.indexOf(e), 1); return; }
    this.kills++; this.floorKills++;
    this.xpFly(e.obj.x, e.obj.y);
    this.xpGained += e.xp;
    this.char.totals.kills++;
    const lv = this.char.gainXp(e.xp);
    if (lv > 0) { this.toast(`POZIOM ${this.char.level}!  +${lv} pkt drzewka`, '#ffd86b'); this.char.save(); this.checkAch(); }
    else if (this.kills % 25 === 0) this.checkAch();
    if (e.boss && this.bossDef) {
      if (this.char.markBoss(this.bossDef.id)) this.toast(`Pierwsze pokonanie: ${this.bossDef.name}!  +${BOSS_POINTS} pkt`, '#ffd86b');
      this.checkAch(); this.char.save();
    }
    this.rollDrop(e);
    e.obj.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  /** XP leci prosto do postaci */
  private xpFly(x: number, y: number): void {
    if (this.fxCount > 30) return;
    this.fxCount++;
    const img = spr(this, x, y, 'xp').setDepth(30);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 260,
      onUpdate: (t) => { const v = Phaser.Math.Easing.Quadratic.In(t.getValue() ?? 0); img.x = x + (this.player.x - x) * v; img.y = y + (this.player.y - y) * v; },
      onComplete: () => { img.destroy(); this.fxCount--; },
    });
  }

  private pop(x: number, y: number, text: string, color: string, big: boolean): void {
    if (this.popCount > 30) return;
    this.popCount++;
    const t = this.add.text(x, y, text, { fontSize: big ? '20px' : '13px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: big ? 4 : 3 }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 600, onComplete: () => { t.destroy(); this.popCount--; } });
  }

  // ---------- łup ----------
  private rollDrop(e: Enemy): void {
    const mult = 1 + this.st.drop, ilvl = 1 + Math.floor(this.char.level * 0.8) + (this.mode.boss ? 2 : 0);
    const gem = () => (Math.random() < 0.3
      ? this.spawnDrop(e, undefined, Phaser.Utils.Array.GetRandom(SKILL_IDS))
      : this.spawnDrop(e, undefined, undefined, Phaser.Utils.Array.GetRandom(SUPPORT_IDS)));
    if (e.boss) {
      this.spawnDrop(e, makeItem(ilvl + 4, 3)); gem(); gem();
    } else if (e.elite) {
      if (Math.random() < 0.55) gem(); else this.spawnDrop(e, makeItem(ilvl + 2, 2));
    } else if (Math.random() < 0.005 * mult) gem();
    else if (Math.random() < 0.014 * mult) this.spawnDrop(e, makeItem(ilvl));
  }
  private spawnDrop(e: Enemy, item?: Item, skill?: SkillId, support?: SupportId): void {
    let x = e.obj.x + Phaser.Math.Between(-12, 12), y = e.obj.y + Phaser.Math.Between(-12, 12);
    if (this.solidAt(x, y)) { x = e.obj.x; y = e.obj.y; }
    const color = item ? RARITY_COLOR[item.rarity] : skill ? 0xd18bff : SUPPORTS[support as SupportId].color;
    const obj = spr(this, x, y, item ? 'drop_item' : skill ? 'drop_star' : 'drop_hex').setTint(color).setDepth(4);
    let beam: Phaser.GameObjects.Image | undefined;
    if (!item || item.rarity >= 2) beam = spr(this, x, y - 30, 'beam').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    this.tweens.add({ targets: obj, scale: 1.3 / S, yoyo: true, repeat: -1, duration: 450 });
    this.drops.push({ obj, beam, item, skill, support });
  }
  private updateDrops(): void {
    this.drops = this.drops.filter((d) => {
      if (this.dist(this.player, d.obj) > 22) return true;
      this.found++;
      if (d.skill || d.support) this.char.totals.gems++;
      if (d.item && d.item.rarity === 3) this.char.totals.legendary++;
      if (d.skill) {
        const r = this.char.addSkillGem(d.skill);
        this.toast(r === 'new' ? `NOWY GEM: ${SKILLS[d.skill].name}!` : r === 'up' ? `${SKILLS[d.skill].name}: wyższy poziom!` : `${SKILLS[d.skill].name}: maks. (+20 zł)`, '#d18bff');
      } else if (d.support) {
        const r = this.char.addSupportGem(d.support);
        this.toast(`Support: ${SUPPORTS[d.support].name}${r === 'sold' ? ' (pełno, sprzedany)' : ''}`, '#' + SUPPORTS[d.support].color.toString(16).padStart(6, '0'));
      } else if (d.item) {
        const old = this.char.maxHp;
        const r = this.char.addItemAuto(d.item);
        this.hp = Math.min(this.char.maxHp, this.hp + Math.max(0, this.char.maxHp - old));
        this.refreshStats();
        this.toast(`${d.item.name}${r === 'equipped' ? ' (założony)' : r === 'bag' ? ' (w plecaku)' : ' (sprzedany)'}`, '#' + RARITY_COLOR[d.item.rarity].toString(16).padStart(6, '0'));
      }
      this.checkAch();
      d.obj.destroy(); d.beam?.destroy();
      return false;
    });
  }

  private toast(msg: string, color: string): void {
    const t = this.add.text(W / 2, 96, msg, { fontSize: '15px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3, align: 'center', wordWrap: { width: 330 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(150);
    this.tweens.add({ targets: t, y: 78, alpha: 0, delay: 1600, duration: 700, onComplete: () => t.destroy() });
  }

  private wake(pack: number): void {
    for (const e of this.packs[pack] ?? []) if (!e.dead && !e.awake) { e.awake = true; e.cd = Math.max(e.cd, 0.7 + Math.random() * 0.8); }
  }

  private hitPlayer(raw: number, inv = 0.5): void {
    if (this.invuln > 0 || this.over) return;
    const f = this.fx;
    let dmg = Math.max(raw * 0.3, raw - Math.min(this.st.armor, raw * 0.7));
    if (f.shield > 0) { const ab = Math.min(f.shield, dmg); f.shield -= ab; dmg -= ab; }
    this.hp -= dmg; this.invuln = inv;
    this.cameras.main.shake(90, 0.006);
  }

  private tele(x: number, y: number, R: number, t: number, dmg: number, color = 0xff3b3b): void {
    this.teles.push({ x, y, R, t, t0: t, dmg, color });
  }

  private enemyShot(e: Enemy, ang: number, spd: number, dmg: number): void {
    const obj = spr(this, e.obj.x, e.obj.y, 'eshot').setDepth(7);
    this.eshots.push({ obj, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 3.2, dmg });
  }

  private windup(e: Enemy, act: string, t: number, ax: number, ay: number): void {
    e.st = 'wind'; e.stT = t; e.act = act; e.ax = ax; e.ay = ay;
    if (act === 'slam') this.tele(e.obj.x, e.obj.y, e.boss ? 100 : 64, t, e.dmg * (e.boss ? 1.7 : 1.5));
  }

  private execute(e: Enemy): void {
    const P = this.player, b = e.boss;
    const toward = Math.atan2(P.y - e.obj.y, P.x - e.obj.x);
    e.st = 'rest'; e.stT = 0.35;
    switch (e.act) {
      case 'dash': case 'charge':
        e.st = 'dash'; e.stT = b ? 0.6 : 0.38; e.cd = b ? 2.4 : 3; break;
      case 'spit':
        this.enemyShot(e, toward, 165, e.dmg * 0.9); e.cd = 2.4 + Math.random() * 0.8; break;
      case 'volley':
        for (let i = -1; i <= 1; i++) this.enemyShot(e, toward + i * 0.26, 170, e.dmg * 0.8);
        e.cd = 2.8 + Math.random() * 0.8; break;
      case 'hex': {
        const col = PALETTE[this.map.biome.id].accent;
        for (let i = 0; i < 2; i++) {
          const x = P.x + (i ? (Math.random() - 0.5) * 120 : 0), y = P.y + (i ? (Math.random() - 0.5) * 120 : 0);
          if (!this.solidAt(x, y)) this.tele(x, y, 42, 1.0, e.dmg * 1.3, col);
        }
        e.cd = 4.2 + Math.random(); break;
      }
      case 'spiral':
        e.st = 'channel'; e.stT = 2.4; e.emitT = 0; e.ax = Math.random() * 6.28; e.cd = 3.4; break;
      case 'summon': {
        const alive = this.enemies.filter((x) => x.sum).length;
        for (let i = 0; i < 4 && alive + i < 10; i++) {
          const a = Math.random() * 6.28, x = e.obj.x + Math.cos(a) * 60, y = e.obj.y + Math.sin(a) * 60;
          if (this.solidAt(x, y)) continue;
          const m = this.makeEnemy('melee', x, y, 0.3, e.pack, true); m.awake = true;
        }
        e.cd = 5.5; break;
      }
      case 'boom':
        this.tele(e.obj.x, e.obj.y, 58, 0.22, e.dmg * 1.8, PALETTE[this.map.biome.id].body);
        this.kill(e); break;
      case 'slam':
        e.stT = 0.5; e.cd = b ? 2.4 : 3.4; break;
      case 'ring': {
        const n = b ? 16 : e.kind === 'totem' ? 8 : 10, off = Math.random() * 6.28;
        for (let i = 0; i < n; i++) this.enemyShot(e, off + (i / n) * 6.28, 120, e.dmg * 0.7);
        e.cd = b ? 3 : e.kind === 'totem' ? 3.6 : 4.4; break;
      }
      case 'quake': {
        const n = b ? 6 : 3;
        for (let i = 0; i < n; i++) {
          const x = P.x + (i ? (Math.random() - 0.5) * 190 : 0), y = P.y + (i ? (Math.random() - 0.5) * 190 : 0);
          if (!this.solidAt(x, y)) this.tele(x, y, 46, 1.05, e.dmg * 1.2, 0xc77dff);
        }
        e.cd = b ? 3.4 : 5; break;
      }
      default: break;
    }
  }

  private think(e: Enemy, d: number, ux: number, uy: number, chase: (sp: number) => void, dt: number): void {
    const rr = Math.min(e.r, 11), back = () => { if (!this.slide(e.obj, -ux * e.speed * dt, -uy * e.speed * dt, rr)) this.slide(e.obj, -uy * e.speed * dt, ux * e.speed * dt, rr); };
    switch (e.kind) {
      case 'dash':
        chase(e.speed);
        if (e.cd <= 0 && e.los && d < 170 && d > 50) this.windup(e, 'dash', 0.5, ux, uy);
        break;
      case 'spit': case 'volley':
        if (d < 115) back(); else if (d > 200 || !e.los) chase(e.speed);
        if (e.cd <= 0 && e.los && d < 270) this.windup(e, e.kind, 0.35, ux, uy);
        break;
      case 'caster':
        if (d < 150) back(); else if (d > 260 || !e.los) chase(e.speed);
        if (e.cd <= 0 && e.los && d < 300) this.windup(e, 'hex', 0.6, ux, uy);
        break;
      case 'totem':
        if (e.cd <= 0 && e.los && d < 290) this.windup(e, 'ring', 0.5, ux, uy);
        break;
      case 'boom':
        chase(e.speed);
        if (d < 46) this.windup(e, 'boom', 0.35, ux, uy);
        break;
      case 'slam':
        chase(e.speed);
        if (e.cd <= 0 && d < 85) this.windup(e, 'slam', 0.8, ux, uy);
        break;
      case 'elite':
        chase(e.speed);
        if (e.cd <= 0 && e.los && d < 300) this.windup(e, e.aff, e.aff === 'ring' ? 0.5 : 0.4, ux, uy);
        break;
      case 'boss': {
        chase(e.speed);
        const mv = this.bossDef?.moves ?? ['slam'];
        if (e.cd <= 0 && d < 400) { const act = mv[e.moveI++ % mv.length]; this.windup(e, act, act === 'slam' ? 0.9 : act === 'charge' ? 0.7 : act === 'summon' ? 0.9 : 0.55, ux, uy); }
        break;
      }
      default: chase(e.speed);
    }
  }

  private updateEnemies(dt: number): void {
    const P = this.player, g = this.ebars, f = this.fx, cam = this.cameras.main;
    g.clear();
    for (const e of this.enemies.slice()) {
      const ex = e.obj.x, ey = e.obj.y;
      if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
      if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burnDps * dt; if (e.hp <= 0) { this.kill(e); continue; } }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.frozenT > 0) e.frozenT -= dt;
      const winding = e.st === 'wind';
      if (e.hitT > 0.28) e.obj.setTintFill(0xffffff);
      else if (winding) e.obj.setTint(0xff7070);
      else if (e.frozenT > 0 || e.slowT > 0) e.obj.setTint(0x8fc4ff);
      else if (e.burnT > 0) e.obj.setTint(0xffa060);
      else if (e.elite && e.aff === 'quake') e.obj.setTint(0xc77dff);
      else e.obj.clearTint();

      if (!e.awake) {
        if ((ex - P.x) ** 2 + (ey - P.y) ** 2 < 420 * 420) {
          const fl = this.flow[this.tileOf(e.obj)];
          if (fl >= 0 && fl <= (e.boss ? 11 : WAKE_STEPS)) this.wake(e.pack);
        }
        if (!e.awake) { e.obj.y = e.hy + Math.sin(this.time_ * 2 + e.ph) * 1.2; this.enemyBar(e, cam); continue; }
      }

      e.cd -= dt; e.losT -= dt; if (e.stuck > 0) e.stuck -= dt;
      const dx = P.x - ex, dy = P.y - ey, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      if (e.losT <= 0) { e.losT = 0.15; e.los = this.clear(ex, ey, P.x, P.y, e.r > 14 ? 9 : 5); }
      const sf = e.frozenT > 0 ? 0 : e.slowT > 0 ? 0.5 : 1, rr = Math.min(e.r, 11);
      const chase = (sp: number) => {
        let mx = ux, my = uy;
        if (!e.los || e.stuck > 0) [mx, my] = this.descend(this.flow, e.obj.x, e.obj.y);
        if (!this.slide(e.obj, mx * sp * sf * dt, my * sp * sf * dt, rr) && sf > 0) e.stuck = 0.5;
      };
      if (sf > 0) {
        if (e.st === 'wind') { e.stT -= dt; if (e.stT <= 0) this.execute(e); }
        else if (e.st === 'dash') {
          e.stT -= dt;
          const ok = this.slide(e.obj, e.ax * (e.boss ? 330 : 310) * dt, e.ay * (e.boss ? 330 : 310) * dt, rr);
          if (!ok || e.stT <= 0) { e.st = 'rest'; e.stT = 0.5; }
        } else if (e.st === 'rest') { e.stT -= dt; if (e.stT <= 0) e.st = 'move'; }
        else this.think(e, d, ux, uy, chase, dt);
      }
      if (e.dead) continue;
      e.hy = e.obj.y;
      this.enemyBar(e, cam);
      if (this.dist(e.obj, P) < e.r + 12) this.hitPlayer(e.st === 'dash' ? e.dmg * 1.3 : e.dmg);
    }
    this.player.setAlpha(this.invuln > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(this.time_ * 30)) : 1);
    if (f.frenzyT > 0) this.player.setTint(0xff9a7a); else this.player.clearTint();
    // aury i tarcza wokół gracza
    let ri = 0;
    for (const s of this.states) if (s.kind === 'aura') { g.lineStyle(2, SKILLS[s.id].color, 0.35 + 0.15 * Math.sin(this.time_ * 3 + ri)).strokeCircle(P.x, P.y, 26 + ri * 4); ri++; }
    if (f.shield > 0) g.lineStyle(3, 0x8fd3ff, 0.9).strokeCircle(P.x, P.y, 24);
  }

  private enemyBar(e: Enemy, cam: Phaser.Cameras.Scene2D.Camera): void {
    if (!(e.elite || e.boss || (e.hp < e.maxHp * 0.999 && e.r >= 18))) return;
    if (e.obj.x < cam.scrollX - 40 || e.obj.x > cam.scrollX + W + 40 || e.obj.y < cam.scrollY - 40 || e.obj.y > cam.scrollY + H + 40) return;
    const g = this.ebars, w = e.r * 2.2, bx = e.obj.x - w / 2, by = e.obj.y - e.r - 14;
    g.fillStyle(0x000000, 0.8).fillRect(bx - 1, by - 1, w + 2, 7);
    g.fillStyle(e.boss ? 0xff3b3b : e.elite ? 0xff9f1a : 0xc77dff).fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), 5);
  }

  private updateEShots(dt: number): void {
    this.eshots = this.eshots.filter((s) => {
      const o = s.obj;
      o.x += s.vx * dt; o.y += s.vy * dt; s.life -= dt;
      let alive = s.life > 0 && !this.solidAt(o.x, o.y);
      if (alive && this.dist(o, this.player) < 12) { this.hitPlayer(s.dmg, 0.4); alive = false; }
      if (!alive) o.destroy();
      return alive;
    });
  }

  private updateTeles(dt: number): void {
    const g = this.tgfx, P = this.player;
    g.clear();
    for (const e of this.enemies) {
      if (e.st === 'wind' && (e.act === 'dash' || e.act === 'charge')) {
        const len = (e.boss ? 330 * 0.6 : 310 * 0.38) + e.r;
        g.lineStyle(e.r * 1.4, 0xff3b3b, 0.22).lineBetween(e.obj.x, e.obj.y, e.obj.x + e.ax * len, e.obj.y + e.ay * len);
      }
    }
    if (this.portal) {
      const o = this.portalOpen, t = this.time_, pr = this.portal;
      g.lineStyle(3, o ? 0xb18cff : 0x555577, o ? 0.9 : 0.5).strokeCircle(pr.x, pr.y, 22 + Math.sin(t * 3) * (o ? 2 : 0.5));
      g.fillStyle(o ? 0xb18cff : 0x555577, o ? 0.28 : 0.1).fillCircle(pr.x, pr.y, 22);
      if (o) { g.lineStyle(2, 0xe6d6ff, 0.8).strokeCircle(pr.x, pr.y, 13 + Math.sin(t * 5) * 2); g.fillStyle(0xffffff, 0.5).fillCircle(pr.x, pr.y, 5); }
    }
    this.teles = this.teles.filter((t) => {
      t.t -= dt;
      const k = 1 - Math.max(0, t.t) / t.t0;
      g.fillStyle(t.color, 0.1 + 0.08 * k).fillCircle(t.x, t.y, t.R);
      g.lineStyle(2, t.color, 0.85).strokeCircle(t.x, t.y, t.R);
      g.fillStyle(t.color, 0.22 + 0.2 * k).fillCircle(t.x, t.y, t.R * k);
      if (t.t > 0) return true;
      const boom = this.add.circle(t.x, t.y, t.R, t.color, 0.6).setDepth(9);
      this.tweens.add({ targets: boom, alpha: 0, scale: 1.25, duration: 260, onComplete: () => boom.destroy() });
      if (this.dist(P, t) < t.R + 8) this.hitPlayer(t.dmg, 0.4);
      return false;
    });
  }

  // ---------- koniec i HUD ----------
  private end(win: boolean): void {
    this.over = true; this.stick.clear();
    const c = this.char, md = this.mode;
    const gold = md.free
      ? Math.floor((this.kills * 0.8 + 25 * (this.floor - 1)) * (1 + this.st.gold) * md.goldMul)
      : Math.floor((this.kills * 0.8) * (1 + this.st.gold) * md.goldMul * (win ? 1 : 0.5)) + (win ? 40 * md.goldMul : 0);
    c.gold += gold; c.runs++; c.totals.runs++; if (win) { c.wins++; c.totals.wins++; if (md.boss) c.totals.longWins++; }
    this.checkAch();
    c.save();
    const w = W;
    const dim = this.add.rectangle(0, 0, w, H, 0x000000, 0.8).setOrigin(0).setScrollFactor(0).setDepth(200).setInteractive();
    const gained = c.level - this.startLevel;
    this.add.text(w / 2, 200, md.free ? 'KONIEC WYPRAWY' : win ? 'ZWYCIĘSTWO' : 'KONIEC WYPRAWY', { fontSize: '32px', color: win && !md.free ? '#4ade80' : '#c9a4ff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 232, md.name, { fontSize: '13px', color: '#a8b0d0' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 335, `${md.free ? `Piętro: ${this.floor}\nPokonani: ${this.kills}` : `Pokonani: ${this.kills} / ${this.total}`}\nZnalezione: ${this.found}\n\n+${Math.round(this.xpGained)} XP${gained > 0 ? `  (poziom ${c.level}, +${gained} pkt drzewka)` : ''}\n+${gold} złota${this.unlocked.length ? '\nOsiągnięcia: ' + this.unlocked.join(', ') : ''}`, { fontSize: '17px', color: '#fff', align: 'center', lineSpacing: 5, wordWrap: { width: 330 } }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 520, 'Dotknij, aby wrócić', { fontSize: '14px', color: '#8892b0' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    dim.on('pointerdown', () => this.scene.start('menu'));
  }

  private drawHud(): void {
    const b = this.bars, ch = this.char, md = this.mode;
    b.clear();
    // XP postaci
    const xr = Math.min(1, ch.xp / xpNeed(ch.level));
    b.fillStyle(0x000000, 0.6).fillRect(0, 0, W, 10);
    b.fillStyle(0x8fa9ff).fillRect(0, 0, W * xr, 10);
    b.fillStyle(0xffffff, 0.35).fillRect(0, 0, W * xr, 3);
    b.lineStyle(1, 0x000000, 0.9).strokeRect(0, 0, W, 10);
    // HP
    const hpR = Math.max(0, this.hp) / ch.maxHp;
    b.fillStyle(0x000000, 0.75).fillRect(8, 16, 140, 24);
    b.fillStyle(hpR < 0.3 ? 0xff3b3b : 0xd7263d).fillRect(10, 18, 136 * hpR, 20);
    b.fillStyle(0xffffff, 0.22).fillRect(10, 18, 136 * hpR, 6);
    b.lineStyle(2, 0xffffff, 0.8).strokeRect(8, 16, 140, 24);
    if (this.fx.shield > 0) { b.fillStyle(0x8fd3ff, 0.9).fillRect(10, 18, Math.min(136, 136 * this.fx.shield / ch.maxHp), 5); }
    this.hpTxt.setText(`${Math.max(0, Math.ceil(this.hp))} / ${ch.maxHp}`);
    // postęp: liczba wrogów
    const pr = Math.min(1, this.floorKills / Math.max(1, this.total)), bx = 160, bw = 100;
    b.fillStyle(0x000000, 0.75).fillRect(bx, 16, bw, 24);
    b.fillStyle(md.color).fillRect(bx + 2, 18, (bw - 4) * pr, 20);
    b.fillStyle(0xffffff, 0.22).fillRect(bx + 2, 18, (bw - 4) * pr, 6);
    b.lineStyle(2, 0xffffff, 0.8).strokeRect(bx, 16, bw, 24);
    this.killTxt.setPosition(bx + bw / 2, 20).setText(this.enemies.some((e) => e.boss) && this.enemies.filter((e) => !e.sum).length === 1 ? 'BOSS' : `${this.floorKills} / ${this.total}`);
    this.hudTxt.setText(md.free ? `Poziom ${ch.level}   Piętro ${this.floor}` : `Poziom ${ch.level}`);
    // minimapa: wrogowie tylko na odkrytym terenie, a gdy zostało ich mało — wszyscy
    {
      const mw = this.map.w, sc = 68 / Math.max(mw, this.map.h), showAll = this.enemies.filter((e) => !e.sum).length <= 15;
      for (const e of this.enemies) {
        if (e.sum) continue;
        const tx = Math.floor(e.obj.x / TILE), ty = Math.floor(e.obj.y / TILE);
        if (!showAll && !this.seen[ty * mw + tx]) continue;
        const sz = e.boss ? 5 : e.elite ? 3.5 : 2.2;
        b.fillStyle(e.boss ? 0xff3b3b : e.elite ? 0xffa500 : 0xff6b81).fillRect(284 + (e.obj.x / TILE) * sc - sz / 2, 50 + (e.obj.y / TILE) * sc - sz / 2, sz, sz);
      }
      if (this.portal) b.fillStyle(this.portalOpen ? 0xb18cff : 0x666688).fillRect(284 + (this.portal.x / TILE) * sc - 2.5, 50 + (this.portal.y / TILE) * sc - 2.5, 5, 5);
      b.fillStyle(0x8fffd0).fillRect(284 + (this.player.x / TILE) * sc - 2, 50 + (this.player.y / TILE) * sc - 2, 4, 4);
    }
    const boss = this.enemies.find((e) => e.boss && e.awake);
    if (boss && this.bossDef) {
      b.fillStyle(0x000000, 0.75).fillRect(8, 62, 268, 14).fillStyle(0xff3b3b).fillRect(10, 64, 264 * Math.max(0, boss.hp / boss.maxHp), 10).lineStyle(2, 0xffffff, 0.8).strokeRect(8, 62, 268, 14);
      this.bossTxt.setText(this.bossDef.name).setVisible(true);
    } else this.bossTxt.setVisible(false);
    // ikony umiejętności z odliczaniem
    this.states.forEach((st, i) => {
      const ic = this.icons[i];
      if (!ic) return;
      const r = st.kind === 'attack' && st.id !== 'orbs' || st.kind === 'buff' ? Math.max(0, Math.min(1, st.cd / st.cdMax)) : 0;
      if (r > 0 && st.cdMax > 0) b.fillStyle(0x000000, 0.62).fillRect(ic.x - 20, ic.y - 20, 40, 40 * r);
      b.lineStyle(2, SKILLS[st.id].color, r > 0 ? 0.5 : 1).strokeRect(ic.x - 20, ic.y - 20, 40, 40);
    });
    this.warn.setFillStyle(0xff0000, hpR < 0.3 ? 0.07 + 0.07 * Math.sin(this.time_ * 8) : 0);
  }
}
