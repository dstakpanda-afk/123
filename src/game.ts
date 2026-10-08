import Phaser from 'phaser';
import { MODES, Mods, ModeDef, ModeId, NO_MODS, SKILLS, SKILL_IDS, SUPPORTS, SUPPORT_IDS, SkillId, SkillKind, StatKey, Stats, SupportId, combineMods, xpNeed } from './data';
import { Character, getChar } from './char';
import { RARITY_COLOR, Item, makeItem } from './items';
import { H, S, W, setupCam, spr } from './gfx';

interface Enemy {
  obj: Phaser.GameObjects.Image; hp: number; maxHp: number; speed: number; dmg: number; r: number; xp: number;
  hitT: number; slowT: number; frozenT: number; burnT: number; burnDps: number; elite: boolean; boss: boolean; dead: boolean;
}
interface Shot {
  obj: Phaser.GameObjects.Image; vx: number; vy: number; life: number; pierce: number; dmg: number; hit: Set<Enemy>; m: Mods;
  kind: 'normal' | 'boom' | 'home'; travelled: number; maxDist: number; back: boolean; spd: number;
}
interface Zone { obj: Phaser.GameObjects.Arc; x: number; y: number; R: number; life: number; tick: number; dmg: number; m: Mods }
interface Minion { obj: Phaser.GameObjects.Image; cd: number; hitCd: number }
interface Drop { obj: Phaser.GameObjects.Image; beam?: Phaser.GameObjects.Image; item?: Item; skill?: SkillId; support?: SupportId }
interface SkillState {
  id: SkillId; kind: SkillKind; lv: number; m: Mods; cd: number; cdMax: number;
  orbs: Phaser.GameObjects.Image[]; angle: number; minions: Minion[];
}

const ENEMY_CAP = 160;

export class GameScene extends Phaser.Scene {
  private char!: Character;
  private mode!: ModeDef;
  private st!: Stats;
  private player!: Phaser.GameObjects.Image;
  private hp = 100;
  private invuln = 0;
  time_ = 0; private kills = 0; private spawned = 0; private spawnT = 0; private nextElite = 0; private regenAcc = 0;
  private bossSpawned = false; private bossDead = false; private xpGained = 0; private startLevel = 1;
  private enemies: Enemy[] = []; private shots: Shot[] = []; private zones: Zone[] = []; private drops: Drop[] = [];
  private states: SkillState[] = [];
  private fx = { frenzyT: 0, frenzyDmg: 0, frenzySpd: 0, hasteT: 0, hasteCdr: 0, shield: 0, shieldT: 0 };
  private over = false; private popCount = 0; private fxCount = 0; private found = 0;
  private bg!: Phaser.GameObjects.TileSprite;
  private stick!: Phaser.GameObjects.Graphics;
  private stickOrigin: Phaser.Math.Vector2 | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hudTxt!: Phaser.GameObjects.Text;
  private hpTxt!: Phaser.GameObjects.Text;
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
    this.invuln = 0; this.time_ = 0; this.kills = 0; this.spawned = 0; this.spawnT = 0.3; this.nextElite = this.mode.eliteEvery; this.regenAcc = 0;
    this.bossSpawned = false; this.bossDead = false; this.xpGained = 0; this.startLevel = this.char.level;
    this.enemies = []; this.shots = []; this.zones = []; this.drops = []; this.states = []; this.icons = [];
    this.fx = { frenzyT: 0, frenzyDmg: 0, frenzySpd: 0, hasteT: 0, hasteCdr: 0, shield: 0, shieldT: 0 };
    this.over = false; this.popCount = 0; this.fxCount = 0; this.found = 0; this.stickOrigin = null; this.quitArmed = false;
  }

  create(): void {
    setupCam(this);
    this.cameras.main.setBackgroundColor(0x0a0814);
    this.bg = this.add.tileSprite(0, 0, W, H, 'ground').setOrigin(0).setScrollFactor(0);
    this.player = spr(this, 0, 0, `pl_${this.char.cls}`).setDepth(10);
    this.cameras.main.setScroll(-W / 2, -H / 2);

    this.ebars = this.add.graphics().setDepth(40);
    this.warn = this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0).setScrollFactor(0).setDepth(90);
    this.bars = this.add.graphics().setScrollFactor(0).setDepth(100);
    const ts = { fontSize: '13px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 };
    this.hpTxt = this.add.text(78, 21, '', { ...ts, fontSize: '12px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.killTxt = this.add.text(W / 2 + 10, 14, '', { ...ts, fontSize: '16px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.hudTxt = this.add.text(8, 44, '', { ...ts, fontSize: '12px' }).setScrollFactor(0).setDepth(101);
    this.stick = this.add.graphics().setScrollFactor(0).setDepth(100);
    const qb = this.add.rectangle(322, 30, 70, 28, 0x3a2226).setStrokeStyle(2, 0xc0626f).setScrollFactor(0).setDepth(100).setInteractive();
    this.quitTxt = this.add.text(322, 30, 'ZAKOŃCZ', { fontSize: '11px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    qb.on('pointerdown', () => {
      if (this.over) return;
      if (this.quitArmed) return this.end(false);
      this.quitArmed = true; this.quitTxt.setText('NA PEWNO?');
      this.time.delayedCall(2000, () => { this.quitArmed = false; this.quitTxt.setText('ZAKOŃCZ'); });
    });

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => { if (!this.over && over.length === 0) this.stickOrigin = new Phaser.Math.Vector2(p.x / S, p.y / S); });
    this.input.on('pointerup', () => { this.stickOrigin = null; });
    this.buildStates();
    this.refreshStats();
    this.icons = this.states.map((s, i) => spr(this, W / 2 + (i - (this.states.length - 1) / 2) * 50, H - 30, `ic_${s.id}`).setScale(40 / 44 / S).setScrollFactor(0).setDepth(100));
    Object.assign(window, { __game: this, __mk: makeItem }); // do testów
  }

  // ---------- statystyki biegu (postać + aury + chwilowe wzmocnienia) ----------
  private strength(m: Mods): number { return m.dmg * m.area; }

  private refreshStats(): void {
    const b: Stats = { ...this.char.stats };
    const add = (k: StatKey, v: number) => { b[k] += v; };
    for (const s of this.states) {
      if (s.kind !== 'aura') continue;
      const k = this.strength(s.m), lv = s.lv;
      switch (s.id) {
        case 'a_fury': add('dmg', (0.06 + 0.03 * lv) * k); break;
        case 'a_haste': add('cdr', (0.03 + 0.015 * lv) * k); add('speed', (0.02 + 0.01 * lv) * k); break;
        case 'a_guard': add('armor', (1 + 0.8 * lv) * k); add('regen', (0.25 + 0.12 * lv) * k); break;
        case 'a_sight': add('crit', (0.02 + 0.012 * lv) * k); add('area', (0.03 + 0.015 * lv) * k); break;
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
        const n = 1 + Math.floor(s.lv / 2) + Math.round(this.char.stats.proj) + m.proj;
        for (let i = 0; i < n; i++) s.minions.push({ obj: spr(this, 0, 0, id === 'm_eye' ? 'mn_eye' : 'mn_servant').setDepth(9), cd: 0.5 + i * 0.3, hitCd: 0 });
      }
      return s;
    });
  }

  // ---------- pętla ----------
  update(_t: number, dtMs: number): void {
    this.drawHud();
    if (this.over) return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.time_ += dt; this.invuln -= dt;
    this.tickFx(dt);
    this.regenAcc += this.st.regen * dt;
    if (this.regenAcc >= 1) { this.heal(Math.floor(this.regenAcc)); this.regenAcc %= 1; }

    this.move(dt);
    this.spawn(dt);
    this.states.forEach((s) => (s.kind === 'attack' ? this.cast(s, dt) : s.kind === 'buff' ? this.castBuff(s, dt) : s.kind === 'minion' ? this.minions(s, dt) : undefined));
    this.updateShots(dt);
    this.updateZones(dt);
    this.updateEnemies(dt);
    this.updateDrops();

    const cam = this.cameras.main, k = Math.min(1, 9 * dt);
    cam.scrollX += (this.player.x - W / 2 - cam.scrollX) * k;
    cam.scrollY += (this.player.y - H / 2 - cam.scrollY) * k;
    this.bg.tilePositionX = cam.scrollX;
    this.bg.tilePositionY = cam.scrollY;

    if (this.hp <= 0) this.end(false);
    else if (this.kills >= this.mode.target) {
      if (!this.mode.boss) this.end(true);
      else if (!this.bossSpawned) this.spawnBoss();
      else if (this.bossDead) this.end(true);
    }
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
    this.player.x += v.x * sp * dt; this.player.y += v.y * sp * dt;
  }

  // ---------- przeciwnicy ----------
  private spawn(dt: number): void {
    if (this.spawned >= this.mode.target) return;
    if (this.kills >= this.nextElite && this.mode.eliteEvery > 0) { this.nextElite += this.mode.eliteEvery; this.addEnemy('elite'); return; }
    this.spawnT -= dt;
    if (this.enemies.length < 4) this.spawnT = Math.min(this.spawnT, 0.12);
    if (this.spawnT > 0 || this.enemies.length >= ENEMY_CAP) return;
    const p = this.spawned / this.mode.target;
    this.spawnT = Phaser.Math.Linear(this.mode.spawn0, this.mode.spawn1, p);
    const r = Math.random();
    this.addEnemy(p > 0.3 && r < 0.18 ? 'tank' : p > 0.12 && r < 0.4 ? 'fast' : 'grunt');
  }

  private addEnemy(type: 'grunt' | 'fast' | 'tank' | 'elite' | 'boss'): void {
    const L = this.char.level, p = this.spawned / this.mode.target;
    const hpScale = (1 + 0.15 * (L - 1)) * (1 + this.mode.ramp * p) * this.mode.hpMul;
    const dmgScale = (1 + 0.07 * (L - 1)) * this.mode.dmgMul;
    const xpScale = (1 + 0.2 * (L - 1)) * this.mode.xpMul;
    let key = 'e_grunt', r = 11, hp = 12, speed = 55, dmg = 8, xp = 1, big = 1;
    if (type === 'fast') { key = 'e_fast'; r = 9; hp = 7; speed = 95; dmg = 6; xp = 1; }
    else if (type === 'tank') { key = 'e_tank'; r = 18; hp = 60; speed = 38; dmg = 16; xp = 3; }
    else if (type === 'elite') { key = 'e_elite'; r = 22; hp = 150; speed = 50; dmg = 14; xp = 12; }
    else if (type === 'boss') { key = 'e_elite'; r = 40; hp = 1100; speed = 42; dmg = 24; xp = 90; big = 1.8; }
    if (type !== 'boss') this.spawned++;
    const a = Math.random() * Math.PI * 2;
    const obj = spr(this, this.player.x + Math.cos(a) * 400, this.player.y + Math.sin(a) * 400, key).setDepth(type === 'boss' ? 6 : 5);
    if (big !== 1) obj.setScale(big / S);
    const e: Enemy = { obj, hp: hp * hpScale, maxHp: hp * hpScale, speed, dmg: dmg * dmgScale, r, xp: xp * xpScale, hitT: 0, slowT: 0, frozenT: 0, burnT: 0, burnDps: 0, elite: type === 'elite', boss: type === 'boss', dead: false };
    this.enemies.push(e);
    if (type === 'boss') this.toast('BOSS!', '#ff5470');
  }

  private spawnBoss(): void {
    this.bossSpawned = true;
    this.addEnemy('boss');
  }

  private nearestTo(x: number, y: number, maxD = 1e9, skip?: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (skip?.has(e) || e.dead) continue;
      const d = (e.obj.x - x) ** 2 + (e.obj.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
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
    const { lv, m } = s, st = this.st, P = this.player;
    const area = (1 + st.area) * m.area, extra = Math.round(st.proj) + m.proj, cdm = (1 - st.cdr) * m.cd;
    const setCd = (v: number) => { if (!echo) { s.cd = Math.max(0.2, v * cdm); s.cdMax = s.cd; } };
    const aimAt = (e: Enemy) => Math.atan2(e.obj.y - P.y, e.obj.x - P.x);

    switch (s.id) {
      case 'blade': {
        const target = this.nearestTo(P.x, P.y, 170 * area);
        if (!target) return false;
        setCd(1.0 - 0.07 * lv);
        const ang = aimAt(target), range = (60 + 7 * lv) * area, base = (14 + 5 * lv) * dmgS;
        const n = 1 + Math.min(extra, 3), half = Math.PI / 2;
        for (let i = 0; i < n; i++) {
          const a = ang + (i - (n - 1) / 2) * 1.0;
          for (const e of this.enemies.slice()) {
            if (e.dead || this.dist(P, e.obj) > range + e.r) continue;
            if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.obj.y - P.y, e.obj.x - P.x) - a)) > half) continue;
            this.hurt(e, base, m);
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
        setCd(1.3 - 0.1 * lv);
        const ang = aimAt(target), count = 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0) + extra;
        for (let i = 0; i < count; i++) this.shot(P.x, P.y, 'bolt', ang + (i - (count - 1) / 2) * 0.14, 320, 1.4, 1 + (lv >= 4 ? 1 : 0) + m.pierce, (10 + 3 * lv) * dmgS, m);
        return true;
      }
      case 'lance': {
        const target = this.nearestTo(P.x, P.y, 460);
        if (!target) return false;
        setCd(2.0);
        const ang = aimAt(target), count = 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0) + extra;
        for (let i = 0; i < count; i++) this.shot(P.x, P.y, 'lance', ang + (i - (count - 1) / 2) * 0.12, 540, 0.95, 6 + m.pierce, (22 + 8 * lv) * dmgS, m);
        return true;
      }
      case 'scythe': {
        const target = this.nearestTo(P.x, P.y, 320);
        if (!target) return false;
        setCd(3.0);
        const ang = aimAt(target), count = 1 + extra;
        for (let i = 0; i < count; i++) this.shot(P.x, P.y, 'scythe', ang + (i - (count - 1) / 2) * 0.6, 300, 6, 999, (16 + 6 * lv) * dmgS, m, 'boom', 210 * area);
        return true;
      }
      case 'swarm': {
        if (!this.nearestTo(P.x, P.y, 420)) return false;
        setCd(3.2);
        const n = 3 + lv + extra;
        for (let i = 0; i < n; i++) this.shot(P.x, P.y, 'wisp', Math.random() * Math.PI * 2, 240, 2.6, 1 + m.pierce, (6 + 2.5 * lv) * dmgS, m, 'home');
        return true;
      }
      case 'rift': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < 340);
        if (!pool.length) return false;
        setCd(5.0);
        const R = 55 * area;
        for (let i = 0; i < 1 + extra; i++) {
          const e = Phaser.Utils.Array.GetRandom(pool);
          const obj = this.add.circle(e.obj.x, e.obj.y, R, SKILLS.rift.color, 0.2).setStrokeStyle(3, SKILLS.rift.color, 0.9).setDepth(2);
          this.tweens.add({ targets: obj, scale: 1.08, yoyo: true, repeat: -1, duration: 400 });
          this.zones.push({ obj, x: e.obj.x, y: e.obj.y, R, life: 3.5, tick: 0.1, dmg: (8 + 3 * lv) * dmgS, m });
        }
        return true;
      }
      case 'nova': {
        if (!this.nearestTo(P.x, P.y, 200 * area)) return false;
        setCd(3.6);
        const R = (90 + 10 * lv) * area;
        for (const e of this.enemies.slice()) {
          if (e.dead || this.dist(P, e.obj) > R + e.r) continue;
          this.hurt(e, (18 + 6 * lv) * dmgS, m);
          e.slowT = Math.max(e.slowT, 2.5 + m.slow);
        }
        const ring = this.add.circle(P.x, P.y, R, SKILLS.nova.color, 0.18).setStrokeStyle(3, SKILLS.nova.color).setDepth(9).setScale(0.1);
        this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
        return true;
      }
      case 'chain': {
        const first = this.nearestTo(P.x, P.y, 280);
        if (!first) return false;
        setCd(1.6);
        const hit = new Set<Enemy>(), g = this.add.graphics().setDepth(11);
        g.lineStyle(3, SKILLS.chain.color);
        let cur: Enemy | null = first, px = P.x, py = P.y;
        const jumps = 3 + lv + extra + m.pierce;
        for (let i = 0; i < jumps && cur; i++) {
          g.lineBetween(px, py, cur.obj.x, cur.obj.y);
          hit.add(cur); px = cur.obj.x; py = cur.obj.y;
          this.hurt(cur, (16 + 5 * lv) * dmgS, m);
          cur = this.nearestTo(px, py, 150, hit);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
        return true;
      }
      case 'meteor': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < 340);
        if (!pool.length) return false;
        setCd(4);
        const R = 70 * area;
        for (let i = 0; i < 1 + extra; i++) {
          const e = Phaser.Utils.Array.GetRandom(pool), x = e.obj.x, y = e.obj.y;
          const mark = this.add.circle(x, y, R, SKILLS.meteor.color, 0.15).setStrokeStyle(2, SKILLS.meteor.color).setDepth(2);
          this.time.delayedCall(700, () => { mark.destroy(); this.blast(x, y, R, (40 + 14 * lv) * dmgS, m, SKILLS.meteor.color); });
        }
        return true;
      }
      case 'spikes': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < 260);
        if (!pool.length) return false;
        setCd(2.4);
        const R = 34 * area, n = Math.min(pool.length, 3 + Math.floor(lv / 2) + extra * 2);
        Phaser.Utils.Array.Shuffle(pool).slice(0, n).forEach((e) => {
          const x = e.obj.x, y = e.obj.y;
          const mark = this.add.circle(x, y, R, SKILLS.spikes.color, 0.12).setStrokeStyle(2, SKILLS.spikes.color).setDepth(2);
          this.time.delayedCall(450, () => { mark.destroy(); this.blast(x, y, R, (20 + 7 * lv) * dmgS, m, SKILLS.spikes.color); });
        });
        return true;
      }
      case 'tentacles': {
        const pool = this.enemies.filter((e) => !e.dead && this.dist(P, e.obj) < 230 * area);
        if (!pool.length) return false;
        setCd(2.2);
        const n = Math.min(pool.length, 2 + Math.floor(lv / 2) + extra), g = this.add.graphics().setDepth(11);
        g.lineStyle(4, SKILLS.tentacles.color, 0.9);
        Phaser.Utils.Array.Shuffle(pool).slice(0, n).forEach((e) => {
          const ex = e.obj.x, ey = e.obj.y, mx = (P.x + ex) / 2 + (Math.random() - 0.5) * 60, my = (P.y + ey) / 2 + (Math.random() - 0.5) * 60;
          g.strokePoints(new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(P.x, P.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(ex, ey)).getPoints(14));
          this.hurt(e, (15 + 5 * lv) * dmgS, m);
          if (!e.dead && !e.boss) {
            const a = Math.atan2(P.y - e.obj.y, P.x - e.obj.x);
            e.obj.x += Math.cos(a) * 28; e.obj.y += Math.sin(a) * 28;
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
    const { lv, m } = s, st = this.st;
    const area = (1 + st.area) * m.area, want = 1 + Math.floor(lv / 2) + Math.round(st.proj) + m.proj;
    while (s.orbs.length < want) s.orbs.push(spr(this, 0, 0, 'orb').setDepth(9));
    s.angle += (dt * (2.6 + 0.15 * lv)) / Math.max(0.5, (1 - st.cdr) * m.cd);
    const R = 65 * area;
    s.orbs.forEach((o, i) => {
      const a = s.angle + (i / s.orbs.length) * Math.PI * 2;
      o.setPosition(this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R).setRotation(a);
      for (const e of this.enemies.slice()) {
        if (e.dead || e.hitT > 0) continue;
        if (this.dist(o, e.obj) < e.r + 10) this.hurt(e, 8 + 3 * lv, m);
      }
    });
  }

  // ---------- wzmocnienia (sloty pomocnicze) ----------
  private castBuff(s: SkillState, dt: number): void {
    s.cd -= dt;
    if (s.cd > 0) return;
    const { lv, m } = s, k = this.strength(m), P = this.player, cdm = (1 - this.st.cdr) * m.cd;
    if (!this.nearestTo(P.x, P.y, 300)) return;
    const f = this.fx;
    const ring = (color: number, R: number) => {
      const r = this.add.circle(P.x, P.y, R, color, 0.2).setStrokeStyle(3, color).setDepth(9);
      this.tweens.add({ targets: r, alpha: 0, scale: 1.4, duration: 450, onComplete: () => r.destroy() });
    };
    switch (s.id) {
      case 'heal': {
        s.cd = 6 * cdm;
        this.heal(Math.round(this.char.maxHp * (0.04 + 0.02 * lv) * k));
        const R = 80 * (1 + this.st.area) * m.area;
        for (const e of this.enemies.slice()) if (!e.dead && this.dist(P, e.obj) < R + e.r) this.hurt(e, 10 + 5 * lv, m);
        ring(SKILLS.heal.color, R); break;
      }
      case 'frenzy': s.cd = 11 * cdm; f.frenzyT = 4 + 0.4 * lv; f.frenzyDmg = (0.25 + 0.07 * lv) * k; f.frenzySpd = (0.15 + 0.03 * lv) * k; ring(SKILLS.frenzy.color, 50); this.refreshStats(); break;
      case 'haste': s.cd = 12 * cdm; f.hasteT = 3.5 + 0.3 * lv; f.hasteCdr = (0.25 + 0.04 * lv) * k; ring(SKILLS.haste.color, 50); this.refreshStats(); break;
      case 'ward': s.cd = 12 * cdm; f.shield = this.char.maxHp * (0.12 + 0.05 * lv) * k; f.shieldT = 6; ring(SKILLS.ward.color, 50); break;
      default: break;
    }
    s.cdMax = Math.max(1, s.cd);
  }

  // ---------- słudzy ----------
  private minions(s: SkillState, dt: number): void {
    const { lv, m } = s, P = this.player, cdm = (1 - this.st.cdr) * m.cd, n = s.minions.length;
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
          if (t) { mn.cd = 1.1 * cdm; this.shot(o.x, o.y, 'wisp', Math.atan2(t.obj.y - o.y, t.obj.x - o.x), 300, 1.2, 1 + m.pierce, (7 + 3 * lv), m); }
          else mn.cd = 0.3;
        }
      } else {
        const t = this.nearestTo(o.x, o.y, 280);
        let tx = P.x + Math.cos(s.angle + (i / n) * Math.PI * 2) * 40, ty = P.y + Math.sin(s.angle + (i / n) * Math.PI * 2) * 40, sp = 140;
        if (t) { tx = t.obj.x; ty = t.obj.y; sp = 150 + 8 * lv; }
        const a = Math.atan2(ty - o.y, tx - o.x), d = Phaser.Math.Distance.Between(o.x, o.y, tx, ty);
        if (d > 6) { o.x += Math.cos(a) * sp * dt; o.y += Math.sin(a) * sp * dt; }
        if (t && mn.hitCd <= 0 && d < t.r + 14) { mn.hitCd = 0.5 * cdm; this.hurt(t, 9 + 4 * lv, m); }
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
      let alive = s.life > 0;
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
        z.tick = 0.35;
        for (const e of this.enemies.slice()) if (!e.dead && Phaser.Math.Distance.Between(z.x, z.y, e.obj.x, e.obj.y) < z.R + e.r) this.hurt(e, z.dmg, z.m);
      }
      if (z.life <= 0) { z.obj.destroy(); return false; }
      return true;
    });
  }

  // ---------- trafienia, zabicia, XP ----------
  private hurt(e: Enemy, base: number, m: Mods = NO_MODS): void {
    if (e.dead) return;
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
      e.obj.x += Math.cos(a) * 18; e.obj.y += Math.sin(a) * 18;
    }
  }

  private kill(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.xpFly(e.obj.x, e.obj.y);
    this.xpGained += e.xp;
    const lv = this.char.gainXp(e.xp);
    if (lv > 0) { this.toast(`POZIOM ${this.char.level}!  +${lv} pkt drzewka`, '#ffd86b'); this.char.save(); }
    this.rollDrop(e);
    if (e.boss) this.bossDead = true;
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
    const x = e.obj.x + Phaser.Math.Between(-12, 12), y = e.obj.y + Phaser.Math.Between(-12, 12);
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
      d.obj.destroy(); d.beam?.destroy();
      return false;
    });
  }

  private toast(msg: string, color: string): void {
    const t = this.add.text(W / 2, 96, msg, { fontSize: '15px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3, align: 'center', wordWrap: { width: 330 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(150);
    this.tweens.add({ targets: t, y: 78, alpha: 0, delay: 1600, duration: 700, onComplete: () => t.destroy() });
  }

  private updateEnemies(dt: number): void {
    const armor = this.st.armor, f = this.fx;
    this.ebars.clear();
    for (const e of this.enemies.slice()) {
      if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
      if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burnDps * dt; if (e.hp <= 0) { this.kill(e); continue; } }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.frozenT > 0) e.frozenT -= dt;
      if (e.hitT > 0.28) e.obj.setTintFill(0xffffff);
      else if (e.frozenT > 0 || e.slowT > 0) e.obj.setTint(0x8fc4ff);
      else if (e.burnT > 0) e.obj.setTint(0xffa060);
      else if (e.boss) e.obj.setTint(0xff7070);
      else e.obj.clearTint();
      const sf = e.frozenT > 0 ? 0 : e.slowT > 0 ? 0.5 : 1;
      const a = Math.atan2(this.player.y - e.obj.y, this.player.x - e.obj.x);
      e.obj.x += Math.cos(a) * e.speed * sf * dt; e.obj.y += Math.sin(a) * e.speed * sf * dt;
      if (e.elite || e.boss || (e.hp < e.maxHp * 0.999 && e.r >= 18)) {
        const w = e.r * 2.2, bx = e.obj.x - w / 2, by = e.obj.y - e.r - 14;
        this.ebars.fillStyle(0x000000, 0.8).fillRect(bx - 1, by - 1, w + 2, 7);
        this.ebars.fillStyle(e.boss ? 0xff3b3b : e.elite ? 0xff9f1a : 0xc77dff).fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), 5);
      }
      if (this.invuln <= 0 && this.dist(e.obj, this.player) < e.r + 12) {
        let dmg = Math.max(e.dmg * 0.3, e.dmg - Math.min(armor, e.dmg * 0.7));
        if (f.shield > 0) { const ab = Math.min(f.shield, dmg); f.shield -= ab; dmg -= ab; }
        this.hp -= dmg; this.invuln = 0.6;
        this.cameras.main.shake(90, 0.006);
      }
    }
    this.player.setAlpha(this.invuln > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(this.time_ * 30)) : 1);
    if (f.frenzyT > 0) this.player.setTint(0xff9a7a); else this.player.clearTint();
    // aury i tarcza wokół gracza
    const g = this.ebars, P = this.player;
    let ri = 0;
    for (const s of this.states) if (s.kind === 'aura') { g.lineStyle(2, SKILLS[s.id].color, 0.35 + 0.15 * Math.sin(this.time_ * 3 + ri)).strokeCircle(P.x, P.y, 26 + ri * 4); ri++; }
    if (f.shield > 0) g.lineStyle(3, 0x8fd3ff, 0.9).strokeCircle(P.x, P.y, 24);
  }

  // ---------- koniec i HUD ----------
  private end(win: boolean): void {
    this.over = true; this.stick.clear();
    const c = this.char, md = this.mode;
    const gold = Math.floor((this.kills * 0.8 + this.time_ / 10) * (1 + this.st.gold) * md.goldMul * (win ? 1 : 0.5)) + (win ? 40 * md.goldMul : 0);
    c.gold += gold; c.runs++; if (win) c.wins++;
    c.save();
    const w = W;
    const dim = this.add.rectangle(0, 0, w, H, 0x000000, 0.8).setOrigin(0).setScrollFactor(0).setDepth(200).setInteractive();
    const m = Math.floor(this.time_ / 60), s = Math.floor(this.time_ % 60).toString().padStart(2, '0');
    const gained = c.level - this.startLevel;
    this.add.text(w / 2, 200, win ? 'ZWYCIĘSTWO' : 'KONIEC WYPRAWY', { fontSize: '32px', color: win ? '#4ade80' : '#c9a4ff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 232, md.name, { fontSize: '13px', color: '#a8b0d0' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 335, `Pokonani: ${this.kills} / ${md.target}\nCzas: ${m}:${s}\nZnalezione: ${this.found}\n\n+${Math.round(this.xpGained)} XP${gained > 0 ? `  (poziom ${c.level}, +${gained} pkt drzewka)` : ''}\n+${gold} złota`, { fontSize: '17px', color: '#fff', align: 'center', lineSpacing: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 480, 'Dotknij, aby wrócić', { fontSize: '14px', color: '#8892b0' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
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
    const pr = Math.min(1, this.kills / md.target), bx = 160, bw = 100;
    b.fillStyle(0x000000, 0.75).fillRect(bx, 16, bw, 24);
    b.fillStyle(md.color).fillRect(bx + 2, 18, (bw - 4) * pr, 20);
    b.fillStyle(0xffffff, 0.22).fillRect(bx + 2, 18, (bw - 4) * pr, 6);
    b.lineStyle(2, 0xffffff, 0.8).strokeRect(bx, 16, bw, 24);
    this.killTxt.setPosition(bx + bw / 2, 20).setText(this.kills >= md.target && md.boss && !this.bossDead ? 'BOSS' : `${this.kills} / ${md.target}`);
    const m = Math.floor(this.time_ / 60), s = Math.floor(this.time_ % 60).toString().padStart(2, '0');
    this.hudTxt.setText(`Poziom ${ch.level}      ${m}:${s}`);
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
