import Phaser from 'phaser';
import { Mods, NO_MODS, SKILLS, SKILL_IDS, SUPPORTS, SUPPORT_IDS, SkillId, SupportId, combineMods } from './data';
import { Character, getChar } from './char';
import { RARITY_COLOR, Item, makeItem } from './items';
import { H, S, W, setupCam, spr } from './gfx';

interface Enemy {
  obj: Phaser.GameObjects.Image; hp: number; maxHp: number; speed: number; dmg: number; r: number; xp: number;
  hitT: number; slowT: number; frozenT: number; burnT: number; burnDps: number; elite: boolean; dead: boolean;
}
interface Gem { obj: Phaser.GameObjects.Image; v: number }
interface Shot { obj: Phaser.GameObjects.Image; vx: number; vy: number; life: number; pierce: number; dmg: number; hit: Set<Enemy>; m: Mods }
interface Drop { obj: Phaser.GameObjects.Image; beam?: Phaser.GameObjects.Image; item?: Item; skill?: SkillId; support?: SupportId }
interface SkillState { id: SkillId; lv: number; m: Mods; cd: number; cdMax: number; orbs: Phaser.GameObjects.Image[]; angle: number }

const WIN_TIME = 360;
const ENEMY_CAP = 160;

export class GameScene extends Phaser.Scene {
  private char!: Character;
  private player!: Phaser.GameObjects.Image;
  private hp = 100;
  private invuln = 0;
  private level = 1; private xp = 0;
  time_ = 0; private kills = 0; private spawnT = 0; private eliteT = 40; private regenAcc = 0;
  private enemies: Enemy[] = []; private gems: Gem[] = []; private shots: Shot[] = []; private drops: Drop[] = [];
  private states: SkillState[] = [];
  private over = false; private popCount = 0; private found = 0;
  private bg!: Phaser.GameObjects.TileSprite;
  private stick!: Phaser.GameObjects.Graphics;
  private stickOrigin: Phaser.Math.Vector2 | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hudTxt!: Phaser.GameObjects.Text;
  private hpTxt!: Phaser.GameObjects.Text;
  private timeTxt!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private ebars!: Phaser.GameObjects.Graphics;
  private warn!: Phaser.GameObjects.Rectangle;
  private quitTxt!: Phaser.GameObjects.Text;
  private quitArmed = false;
  private icons: Phaser.GameObjects.Image[] = [];

  constructor() { super('game'); }

  init(): void {
    this.char = getChar() as Character;
    this.char.recalc();
    this.hp = this.char.maxHp;
    this.invuln = 0; this.level = 1; this.xp = 0; this.time_ = 0; this.kills = 0; this.spawnT = 0; this.eliteT = 40; this.regenAcc = 0;
    this.enemies = []; this.gems = []; this.shots = []; this.drops = []; this.states = [];
    this.over = false; this.popCount = 0; this.found = 0; this.stickOrigin = null; this.quitArmed = false;
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
    this.timeTxt = this.add.text(W / 2, 14, '', { ...ts, fontSize: '18px' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
    this.hudTxt = this.add.text(8, 44, '', { ...ts, fontSize: '12px' }).setScrollFactor(0).setDepth(101);
    this.stick = this.add.graphics().setScrollFactor(0).setDepth(100);
    const qb = this.add.rectangle(318, 28, 80, 28, 0x3a2226).setStrokeStyle(2, 0xc0626f).setScrollFactor(0).setDepth(100).setInteractive();
    this.quitTxt = this.add.text(318, 28, 'ZAKOŃCZ', { fontSize: '12px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
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
    this.icons = this.states.map((st, i) => spr(this, W / 2 + (i - (this.states.length - 1) / 2) * 50, H - 30, `ic_${st.id}`).setScale(40 / 44 / S).setScrollFactor(0).setDepth(100));
    Object.assign(window, { __game: this, __mk: makeItem }); // do testów
  }

  private buildStates(): void {
    this.states = this.char.loadout.filter((l) => l.skill).map((l) => ({
      id: l.skill as SkillId, lv: this.char.skills[l.skill as SkillId], m: combineMods(l.sup), cd: 0, cdMax: 1, orbs: [], angle: 0,
    }));
  }

  // ---------- pętla ----------
  update(_t: number, dtMs: number): void {
    this.drawHud();
    if (this.over) return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.time_ += dt; this.invuln -= dt;
    this.regenAcc += this.char.stats.regen * dt;
    if (this.regenAcc >= 1) { this.heal(Math.floor(this.regenAcc)); this.regenAcc %= 1; }

    this.move(dt);
    this.spawn(dt);
    this.states.forEach((s) => this.cast(s, dt));
    this.updateShots(dt);
    this.updateEnemies(dt);
    this.updateGems(dt);
    this.updateDrops();

    const cam = this.cameras.main, k = Math.min(1, 9 * dt);
    cam.scrollX += (this.player.x - W / 2 - cam.scrollX) * k;
    cam.scrollY += (this.player.y - H / 2 - cam.scrollY) * k;
    this.bg.tilePositionX = cam.scrollX;
    this.bg.tilePositionY = cam.scrollY;
    if (this.hp <= 0) this.end(false);
    else if (this.time_ >= WIN_TIME) this.end(true);
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
    const sp = 130 * (1 + this.char.stats.speed);
    this.player.x += v.x * sp * dt; this.player.y += v.y * sp * dt;
  }

  private spawn(dt: number): void {
    this.eliteT -= dt;
    if (this.eliteT <= 0) { this.eliteT = 40; this.addEnemy(true); }
    this.spawnT -= dt;
    if (this.spawnT > 0 || this.enemies.length >= ENEMY_CAP) return;
    this.spawnT = Math.max(0.1, 0.8 - this.time_ / 400);
    this.addEnemy(false);
  }

  private addEnemy(elite: boolean): void {
    const t = this.time_, roll = Math.random(), scale = 1 + (t / 60) * 0.4;
    let key = 'e_grunt', r = 11, hp = 12, speed = 55, dmg = 8, xp = 1;
    if (elite) { key = 'e_elite'; r = 22; hp = 150; speed = 50; dmg = 14; xp = 12; }
    else if (t > 40 && roll < 0.25) { key = 'e_fast'; r = 9; hp = 7; speed = 95; dmg = 6; }
    else if (t > 90 && roll < 0.4) { key = 'e_tank'; r = 18; hp = 60; speed = 38; dmg = 16; xp = 4; }
    const a = Math.random() * Math.PI * 2;
    const obj = spr(this, this.player.x + Math.cos(a) * 400, this.player.y + Math.sin(a) * 400, key).setDepth(5);
    this.enemies.push({ obj, hp: hp * scale, maxHp: hp * scale, speed, dmg, r, xp, hitT: 0, slowT: 0, frozenT: 0, burnT: 0, burnDps: 0, elite, dead: false });
  }

  private nearestTo(x: number, y: number, maxD = 1e9, skip?: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (skip?.has(e)) continue;
      const d = (e.obj.x - x) ** 2 + (e.obj.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  private dist(a: { x: number; y: number }, b: { x: number; y: number }): number { return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y); }

  // ---------- umiejętności ----------
  private cast(s: SkillState, dt: number): void {
    if (s.id === 'orbs') return this.orbs(s, dt);
    s.cd -= dt;
    if (s.cd > 0) return;
    if (this.fire(s, 1, false) && s.m.echo > 0) this.time.delayedCall(450, () => { if (!this.over) this.fire(s, 0.7, true); });
  }

  /** zwraca true, jeśli umiejętność wystrzeliła (jest cel) */
  private fire(s: SkillState, dmgS: number, echo: boolean): boolean {
    const { lv, m } = s, st = this.char.stats, P = this.player;
    const area = (1 + st.area) * m.area, extra = Math.round(st.proj) + m.proj, cdm = (1 - st.cdr) * m.cd;
    const setCd = (v: number) => { if (!echo) { s.cd = Math.max(0.2, v * cdm); s.cdMax = s.cd; } };

    switch (s.id) {
      case 'blade': {
        const target = this.nearestTo(P.x, P.y, 170 * area);
        if (!target) return false;
        setCd(1.0 - 0.07 * lv);
        const ang = Math.atan2(target.obj.y - P.y, target.obj.x - P.x), range = (60 + 7 * lv) * area, base = (14 + 5 * lv) * dmgS;
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
        const ang = Math.atan2(target.obj.y - P.y, target.obj.x - P.x), count = 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0) + extra;
        for (let i = 0; i < count; i++) {
          const a = ang + (i - (count - 1) / 2) * 0.14;
          const obj = spr(this, P.x, P.y, 'bolt').setDepth(8).setRotation(a);
          this.shots.push({ obj, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 1.4, pierce: 1 + (lv >= 4 ? 1 : 0) + m.pierce, dmg: (10 + 3 * lv) * dmgS, hit: new Set(), m });
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
        const pool = this.enemies.filter((e) => this.dist(P, e.obj) < 340);
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
        const pool = this.enemies.filter((e) => this.dist(P, e.obj) < 260);
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
        const pool = this.enemies.filter((e) => this.dist(P, e.obj) < 230 * area);
        if (!pool.length) return false;
        setCd(2.2);
        const n = Math.min(pool.length, 2 + Math.floor(lv / 2) + extra), g = this.add.graphics().setDepth(11);
        g.lineStyle(4, SKILLS.tentacles.color, 0.9);
        Phaser.Utils.Array.Shuffle(pool).slice(0, n).forEach((e) => {
          const ex = e.obj.x, ey = e.obj.y, mx = (P.x + ex) / 2 + (Math.random() - 0.5) * 60, my = (P.y + ey) / 2 + (Math.random() - 0.5) * 60;
          g.strokePoints(new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(P.x, P.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(ex, ey)).getPoints(14));
          this.hurt(e, (15 + 5 * lv) * dmgS, m);
          if (!e.dead) {
            const a = Math.atan2(P.y - e.obj.y, P.x - e.obj.x);
            e.obj.x += Math.cos(a) * 28; e.obj.y += Math.sin(a) * 28;
          }
        });
        this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
        return true;
      }
      case 'heal': {
        setCd(6);
        this.heal(Math.round(this.char.maxHp * (0.04 + 0.02 * lv)));
        const R = 80 * area;
        for (const e of this.enemies.slice()) if (!e.dead && this.dist(P, e.obj) < R + e.r) this.hurt(e, (10 + 5 * lv) * dmgS, m);
        const ring = this.add.circle(P.x, P.y, R, SKILLS.heal.color, 0.2).setStrokeStyle(2, SKILLS.heal.color).setDepth(9);
        this.tweens.add({ targets: ring, alpha: 0, scale: 1.3, duration: 400, onComplete: () => ring.destroy() });
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
    const { lv, m } = s, st = this.char.stats;
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

  private updateShots(dt: number): void {
    this.shots = this.shots.filter((s) => {
      s.obj.x += s.vx * dt; s.obj.y += s.vy * dt; s.life -= dt;
      let alive = s.life > 0;
      for (const e of this.enemies.slice()) {
        if (!alive) break;
        if (e.dead || s.hit.has(e)) continue;
        if (this.dist(s.obj, e.obj) < e.r + 5) {
          s.hit.add(e); this.hurt(e, s.dmg, s.m);
          if (--s.pierce <= 0) alive = false;
        }
      }
      if (!alive) s.obj.destroy();
      return alive;
    });
  }

  private hurt(e: Enemy, base: number, m: Mods = NO_MODS): void {
    if (e.dead) return;
    const st = this.char.stats;
    const crit = Math.random() < st.crit + m.crit;
    const v = Math.max(1, base * (1 + st.dmg) * m.dmg * (crit ? 1 + st.critDmg : 1));
    e.hp -= v; e.hitT = 0.35; e.obj.setTintFill(0xffffff);
    const steal = st.steal + m.steal;
    if (steal > 0) this.heal(Math.min(3, v * steal));
    if (m.slow > 0) e.slowT = Math.max(e.slowT, m.slow);
    if (m.burn > 0) { e.burnT = 3; e.burnDps = Math.max(e.burnDps, (v * m.burn) / 3); }
    this.pop(e.obj.x, e.obj.y - e.r, Math.round(v).toString(), crit ? '#ffd24d' : '#ffffff', crit);
    if (e.hp <= 0) return this.kill(e);
    if (m.knock > 0) {
      const a = Math.atan2(e.obj.y - this.player.y, e.obj.x - this.player.x);
      e.obj.x += Math.cos(a) * 18; e.obj.y += Math.sin(a) * 18;
    }
  }

  private kill(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.gems.push({ obj: spr(this, e.obj.x, e.obj.y, 'xp').setDepth(3), v: e.xp });
    this.rollDrop(e);
    e.obj.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  private pop(x: number, y: number, text: string, color: string, big: boolean): void {
    if (this.popCount > 30) return;
    this.popCount++;
    const t = this.add.text(x, y, text, { fontSize: big ? '20px' : '13px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: big ? 4 : 3 }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 600, onComplete: () => { t.destroy(); this.popCount--; } });
  }

  // ---------- łup ----------
  private rollDrop(e: Enemy): void {
    const mult = 1 + this.char.stats.drop, ilvl = 2 + Math.floor(this.time_ / 45) + Math.floor(this.char.alloc.size / 25);
    const gem = () => (Math.random() < 0.3
      ? this.spawnDrop(e, undefined, Phaser.Utils.Array.GetRandom(SKILL_IDS))
      : this.spawnDrop(e, undefined, undefined, Phaser.Utils.Array.GetRandom(SUPPORT_IDS)));
    if (e.elite) {
      if (Math.random() < 0.55) gem(); else this.spawnDrop(e, makeItem(ilvl + 2, 2));
    } else if (Math.random() < 0.004 * mult) gem();
    else if (Math.random() < 0.012 * mult) this.spawnDrop(e, makeItem(ilvl));
  }
  private spawnDrop(e: Enemy, item?: Item, skill?: SkillId, support?: SupportId): void {
    const x = e.obj.x, y = e.obj.y;
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
    const armor = this.char.stats.armor;
    this.ebars.clear();
    for (const e of this.enemies.slice()) {
      if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
      if (e.burnT > 0) { e.burnT -= dt; e.hp -= e.burnDps * dt; if (e.hp <= 0) { this.kill(e); continue; } }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.frozenT > 0) e.frozenT -= dt;
      if (e.hitT > 0.28) e.obj.setTintFill(0xffffff);
      else if (e.frozenT > 0 || e.slowT > 0) e.obj.setTint(0x8fc4ff);
      else if (e.burnT > 0) e.obj.setTint(0xffa060);
      else e.obj.clearTint();
      const f = e.frozenT > 0 ? 0 : e.slowT > 0 ? 0.5 : 1;
      const a = Math.atan2(this.player.y - e.obj.y, this.player.x - e.obj.x);
      e.obj.x += Math.cos(a) * e.speed * f * dt; e.obj.y += Math.sin(a) * e.speed * f * dt;
      if (e.elite || e.hp < e.maxHp * 0.999 && e.r >= 18) {
        const w = e.r * 2.2, bx = e.obj.x - w / 2, by = e.obj.y - e.r - 12;
        this.ebars.fillStyle(0x000000, 0.8).fillRect(bx - 1, by - 1, w + 2, 7);
        this.ebars.fillStyle(e.elite ? 0xff9f1a : 0xc77dff).fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), 5);
      }
      if (this.invuln <= 0 && this.dist(e.obj, this.player) < e.r + 12) {
        this.hp -= Math.max(e.dmg * 0.3, e.dmg - Math.min(armor, e.dmg * 0.7)); this.invuln = 0.6;
        this.cameras.main.shake(90, 0.006);
      }
    }
    this.player.setAlpha(this.invuln > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(this.time_ * 30)) : 1);
  }

  private updateGems(dt: number): void {
    const magnet = 70 * (1 + this.char.stats.magnet);
    this.gems = this.gems.filter((g) => {
      const d = this.dist(g.obj, this.player);
      if (d < magnet) {
        const a = Math.atan2(this.player.y - g.obj.y, this.player.x - g.obj.x);
        g.obj.x += Math.cos(a) * 260 * dt; g.obj.y += Math.sin(a) * 260 * dt;
      }
      if (d < 14) { this.xp += g.v * (1 + this.char.stats.xp); g.obj.destroy(); return false; }
      return true;
    });
    const need = 5 + this.level * 4;
    if (this.xp >= need) { this.xp -= need; this.level++; this.toast(`Poziom ${this.level}`, '#ffd86b'); }
  }

  // ---------- koniec i HUD ----------
  private end(win: boolean): void {
    this.over = true; this.stick.clear();
    const c = this.char, st = c.stats;
    const gold = Math.floor((this.kills / 5 + this.time_ / 6) * (1 + st.gold)) + (win ? 50 : 0);
    const pts = this.level + (win ? 10 : 0);
    c.gold += gold; c.points += pts; c.runs++; c.best = Math.max(c.best, this.level);
    c.save();
    const w = W;
    const dim = this.add.rectangle(0, 0, w, H, 0x000000, 0.78).setOrigin(0).setScrollFactor(0).setDepth(200).setInteractive();
    const m = Math.floor(this.time_ / 60), s = Math.floor(this.time_ % 60).toString().padStart(2, '0');
    this.add.text(w / 2, 240, win ? 'ZWYCIĘSTWO' : 'KONIEC WYPRAWY', { fontSize: '32px', color: win ? '#4ade80' : '#c9a4ff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 335, `Czas: ${m}:${s}\nZabici: ${this.kills}\nPoziom: ${this.level}\nZnalezione: ${this.found}\n\n+${pts} punktów drzewka\n+${gold} złota`, { fontSize: '18px', color: '#fff', align: 'center', lineSpacing: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 480, 'Dotknij, aby wrócić', { fontSize: '14px', color: '#8892b0' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    dim.on('pointerdown', () => this.scene.start('menu'));
  }

  private drawHud(): void {
    const b = this.bars, ch = this.char;
    b.clear();
    // XP
    b.fillStyle(0x000000, 0.6).fillRect(0, 0, W, 10);
    b.fillStyle(0x8fa9ff).fillRect(0, 0, W * Math.min(1, this.xp / (5 + this.level * 4)), 10);
    b.fillStyle(0xffffff, 0.35).fillRect(0, 0, W * Math.min(1, this.xp / (5 + this.level * 4)), 3);
    b.lineStyle(1, 0x000000, 0.9).strokeRect(0, 0, W, 10);
    // HP
    const hpR = Math.max(0, this.hp) / ch.maxHp;
    b.fillStyle(0x000000, 0.75).fillRect(8, 16, 140, 24);
    b.fillStyle(hpR < 0.3 ? 0xff3b3b : 0xd7263d).fillRect(10, 18, 136 * hpR, 20);
    b.fillStyle(0xffffff, 0.22).fillRect(10, 18, 136 * hpR, 6);
    b.lineStyle(2, 0xffffff, 0.8).strokeRect(8, 16, 140, 24);
    this.hpTxt.setText(`${Math.max(0, Math.ceil(this.hp))} / ${ch.maxHp}`);
    const m = Math.floor(this.time_ / 60), s = Math.floor(this.time_ % 60).toString().padStart(2, '0');
    this.timeTxt.setText(`${m}:${s}`);
    this.hudTxt.setText(`Poziom ${this.level}    ☠ ${this.kills}`);
    // ikony umiejętności z odliczaniem
    this.states.forEach((st, i) => {
      const ic = this.icons[i];
      if (!ic) return;
      const r = st.id === 'orbs' ? 0 : Math.max(0, Math.min(1, st.cd / st.cdMax));
      if (r > 0) { b.fillStyle(0x000000, 0.62).fillRect(ic.x - 20, ic.y - 20, 40, 40 * r); }
      b.lineStyle(2, SKILLS[st.id].color, r > 0 ? 0.5 : 1).strokeRect(ic.x - 20, ic.y - 20, 40, 40);
    });
    // czerwona poświata przy niskim życiu
    this.warn.setFillStyle(0xff0000, hpR < 0.3 ? 0.07 + 0.07 * Math.sin(this.time_ * 8) : 0);
  }
}
