import Phaser from 'phaser';
import { CLASSES, ClassId, MetaState, SKILLS, SkillId, loadMeta, saveMeta } from './data';
import { RARITY_COLOR, Item, makeItem } from './items';
import { Run } from './run';

interface Enemy { obj: Phaser.GameObjects.Arc; hp: number; speed: number; dmg: number; r: number; xp: number; hitT: number; slowT: number; frozenT: number; elite: boolean }
interface Gem { obj: Phaser.GameObjects.Arc; v: number }
interface Shot { obj: Phaser.GameObjects.Arc; vx: number; vy: number; life: number; pierce: number; dmg: number; hit: Set<Enemy> }
interface Drop { obj: Phaser.GameObjects.Shape; item?: Item; skill?: SkillId }
interface SkillState { id: SkillId; cd: number; orbs: Phaser.GameObjects.Arc[]; angle: number }

const WIN_TIME = 360;
const ENEMY_CAP = 160;

export class GameScene extends Phaser.Scene {
  run!: Run;
  private player!: Phaser.GameObjects.Arc;
  private hp = 100;
  private invuln = 0;
  private level = 1; private xp = 0;
  time_ = 0; private kills = 0; private spawnT = 0; private eliteT = 40; private regenAcc = 0;
  private enemies: Enemy[] = []; private gems: Gem[] = []; private shots: Shot[] = []; private drops: Drop[] = [];
  private states: SkillState[] = [];
  private over = false; private popCount = 0;
  private aim = new Phaser.Math.Vector2(1, 0);
  private bg!: Phaser.GameObjects.TileSprite;
  private stick!: Phaser.GameObjects.Graphics;
  private stickOrigin: Phaser.Math.Vector2 | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private treeBtn!: Phaser.GameObjects.Text;

  constructor() { super('game'); }

  init(data: { meta?: MetaState; cls?: ClassId }): void {
    this.run = Run.starter(data.meta ?? loadMeta(), data.cls ?? 'blood');
    this.hp = this.run.maxHp;
    this.invuln = 0; this.level = 1; this.xp = 0; this.time_ = 0; this.kills = 0; this.spawnT = 0; this.eliteT = 40; this.regenAcc = 0;
    this.enemies = []; this.gems = []; this.shots = []; this.drops = []; this.states = [];
    this.over = false; this.popCount = 0; this.stickOrigin = null;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    const g = this.add.graphics();
    g.lineStyle(1, 0x1d1633).strokeRect(0, 0, 64, 64).generateTexture('grid', 64, 64); g.destroy();
    this.bg = this.add.tileSprite(0, 0, w, h, 'grid').setOrigin(0).setScrollFactor(0);
    this.cameras.main.setBackgroundColor(0x0a0814);
    this.player = this.add.circle(0, 0, 12, CLASSES[this.run.cls].color).setStrokeStyle(2, 0xffffff).setDepth(10);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.bars = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hud = this.add.text(8, 22, '', { fontSize: '13px', color: '#fff' }).setScrollFactor(0).setDepth(100);
    this.stick = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.button(95, 612, 'DRZEWKO', () => this.openUI('tree'), true);
    this.button(265, 612, 'EKWIPUNEK', () => this.openUI('inv'));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-T', () => this.openUI('tree'));
    kb.on('keydown-I', () => this.openUI('inv'));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => { if (!this.over && over.length === 0) this.stickOrigin = new Phaser.Math.Vector2(p.x, p.y); });
    this.input.on('pointerup', () => { this.stickOrigin = null; });
    this.events.on('resume', () => this.afterUI());
    this.syncSlots();
    Object.assign(window, { __game: this, __mk: makeItem }); // do testów
  }

  private button(x: number, y: number, label: string, cb: () => void, isTree = false): void {
    const bg = this.add.rectangle(x, y, 150, 40, 0x22304f).setStrokeStyle(2, 0x4d6bb3).setScrollFactor(0).setDepth(100).setInteractive();
    const t = this.add.text(x, y, label, { fontSize: '15px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    bg.on('pointerdown', cb);
    if (isTree) this.treeBtn = t;
  }

  private openUI(key: 'tree' | 'inv'): void {
    if (this.over || !this.scene.isActive('game')) return;
    this.stickOrigin = null; this.stick.clear();
    this.scene.pause();
    this.scene.launch(key, { run: this.run });
  }
  private afterUI(): void {
    const old = this.run.maxHp;
    this.run.recalc();
    this.hp = Math.min(this.run.maxHp, this.hp + Math.max(0, this.run.maxHp - old));
    this.syncSlots();
  }
  private syncSlots(): void {
    this.states.forEach((s) => s.orbs.forEach((o) => o.destroy()));
    const prev = this.states;
    this.states = this.run.slots.filter((s): s is SkillId => !!s).map((id) => ({ id, cd: prev.find((p) => p.id === id)?.cd ?? 0, orbs: [], angle: 0 }));
  }

  // ---------- pętla ----------
  update(_t: number, dtMs: number): void {
    this.drawHud();
    if (this.over) return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.time_ += dt; this.invuln -= dt;
    const st = this.run.stats;
    this.regenAcc += st.regen * dt;
    if (this.regenAcc >= 1) { this.heal(Math.floor(this.regenAcc)); this.regenAcc %= 1; }

    this.move(dt);
    this.spawn(dt);
    this.states.forEach((s) => this.cast(s, dt));
    this.updateShots(dt);
    this.updateEnemies(dt);
    this.updateGems(dt);
    this.updateDrops();

    this.bg.tilePositionX = this.cameras.main.scrollX;
    this.bg.tilePositionY = this.cameras.main.scrollY;
    if (this.hp <= 0) this.end(false);
    else if (this.time_ >= WIN_TIME) this.end(true);
  }

  private heal(v: number): void { this.hp = Math.min(this.run.maxHp, this.hp + v); }

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
      const v = new Phaser.Math.Vector2(p.x - this.stickOrigin.x, p.y - this.stickOrigin.y);
      const len = Math.min(v.length(), 50);
      if (len > 6) { v.setLength(len); dx = v.x / 50; dy = v.y / 50; }
      this.stick.lineStyle(2, 0xffffff, 0.3).strokeCircle(this.stickOrigin.x, this.stickOrigin.y, 50);
      this.stick.fillStyle(0xffffff, 0.35).fillCircle(this.stickOrigin.x + v.x, this.stickOrigin.y + v.y, 18);
    }
    const v = new Phaser.Math.Vector2(dx, dy);
    if (v.length() > 1) v.normalize();
    if (v.lengthSq() > 0.01) this.aim.copy(v).normalize();
    const sp = 130 * (1 + this.run.stats.speed);
    this.player.x += v.x * sp * dt; this.player.y += v.y * sp * dt;
  }

  private spawn(dt: number): void {
    const t = this.time_;
    this.eliteT -= dt;
    if (this.eliteT <= 0) { this.eliteT = 40; this.addEnemy(true); }
    this.spawnT -= dt;
    if (this.spawnT > 0 || this.enemies.length >= ENEMY_CAP) return;
    this.spawnT = Math.max(0.1, 0.8 - t / 400);
    this.addEnemy(false);
  }

  private addEnemy(elite: boolean): void {
    const t = this.time_, roll = Math.random(), scale = 1 + (t / 60) * 0.45;
    let r = 10, hp = 12, speed = 55, dmg = 8, color = 0xb03a5b, xp = 1;
    if (elite) { r = 22; hp = 150; speed = 50; dmg = 14; color = 0xff9f1a; xp = 12; }
    else if (t > 40 && roll < 0.25) { r = 8; hp = 7; speed = 95; dmg = 6; color = 0x3fb8a0; }
    else if (t > 90 && roll < 0.4) { r = 18; hp = 60; speed = 38; dmg = 16; color = 0x6b4aa0; xp = 4; }
    const a = Math.random() * Math.PI * 2;
    const obj = this.add.circle(this.player.x + Math.cos(a) * 400, this.player.y + Math.sin(a) * 400, r, color).setDepth(5);
    if (elite) obj.setStrokeStyle(3, 0xffffff);
    this.enemies.push({ obj, hp: hp * scale, speed, dmg, r, xp, hitT: 0, slowT: 0, frozenT: 0, elite });
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
    const sk = this.run.skills[s.id], lv = sk.lvl, ev = sk.evolved, st = this.run.stats;
    const cdm = 1 - st.cdr, area = 1 + st.area, extra = Math.round(st.proj);
    const P = this.player;
    if (s.id === 'orbs') return this.orbs(s, dt, lv, ev, extra, area);
    s.cd -= dt;
    if (s.cd > 0) return;

    if (s.id === 'blade' || s.id === 'bolt') {
      const target = this.nearestTo(P.x, P.y, s.id === 'blade' ? 170 * area : 420);
      if (!target) return;
      const ang = Math.atan2(target.obj.y - P.y, target.obj.x - P.x);
      if (s.id === 'blade') {
        s.cd = (ev ? 0.55 : 1.0 - 0.07 * lv) * cdm;
        const range = (60 + 7 * lv) * (ev ? 1.6 : 1) * area, base = (14 + 5 * lv) * (ev ? 1.8 : 1), half = ev ? Math.PI : Math.PI / 2;
        for (const e of this.enemies.slice()) {
          if (this.dist(P, e.obj) > range + e.r) continue;
          if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.obj.y - P.y, e.obj.x - P.x) - ang)) > half) continue;
          this.hurt(e, base);
          if (ev && e.hp > 0) { e.obj.x += Math.cos(ang) * 14; e.obj.y += Math.sin(ang) * 14; }
        }
        const arc = this.add.graphics().setDepth(9);
        arc.fillStyle(ev ? 0x8fb4ff : 0xffffff, 0.45).slice(P.x, P.y, range, ang - half, ang + half).fillPath();
        this.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
      } else {
        s.cd = (ev ? 0.9 : 1.3 - 0.1 * lv) * cdm;
        const count = (ev ? 5 : 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0)) + extra, spread = ev ? 0.18 : 0.12;
        for (let i = 0; i < count; i++) {
          const a = ang + (i - (count - 1) / 2) * spread;
          const obj = this.add.circle(P.x, P.y, ev ? 6 : 5, SKILLS.bolt.color).setDepth(8);
          this.shots.push({ obj, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 1.4, pierce: ev ? 4 : lv >= 4 ? 2 : 1, dmg: 10 + 3 * lv, hit: new Set() });
        }
      }
    } else if (s.id === 'nova') {
      if (!this.nearestTo(P.x, P.y, 200 * area)) return;
      s.cd = 3.6 * cdm;
      const R = (90 + 10 * lv) * (ev ? 1.5 : 1) * area;
      for (const e of this.enemies.slice()) {
        if (this.dist(P, e.obj) > R + e.r) continue;
        this.hurt(e, 18 + 6 * lv);
        if (ev) e.frozenT = 1.2; else e.slowT = 2.5;
      }
      const ring = this.add.circle(P.x, P.y, R, 0x9fd8ff, 0.18).setStrokeStyle(3, 0x9fd8ff).setDepth(9).setScale(0.1);
      this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    } else if (s.id === 'chain') {
      const first = this.nearestTo(P.x, P.y, 280);
      if (!first) return;
      s.cd = 1.6 * cdm;
      const hit = new Set<Enemy>(), g = this.add.graphics().setDepth(11);
      g.lineStyle(3, SKILLS.chain.color);
      let cur: Enemy | null = first, px = P.x, py = P.y;
      const jumps = 3 + lv + extra + (ev ? 5 : 0);
      for (let i = 0; i < jumps && cur; i++) {
        g.lineBetween(px, py, cur.obj.x, cur.obj.y);
        hit.add(cur); px = cur.obj.x; py = cur.obj.y;
        this.hurt(cur, (16 + 5 * lv) * (ev ? 1.4 : 1));
        cur = this.nearestTo(px, py, 150, hit);
      }
      this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    } else if (s.id === 'meteor') {
      const pool = this.enemies.filter((e) => this.dist(P, e.obj) < 340);
      if (!pool.length) return;
      s.cd = 4 * cdm;
      const count = (ev ? 3 : 1) + extra, R = 70 * area * (ev ? 1.2 : 1);
      for (let i = 0; i < count; i++) {
        const e = Phaser.Utils.Array.GetRandom(pool);
        const x = e.obj.x, y = e.obj.y;
        const mark = this.add.circle(x, y, R, 0xff6a3d, 0.15).setStrokeStyle(2, 0xff6a3d).setDepth(2);
        this.time.delayedCall(700, () => {
          mark.destroy();
          for (const t of this.enemies.slice()) if (Phaser.Math.Distance.Between(x, y, t.obj.x, t.obj.y) < R + t.r) this.hurt(t, 40 + 14 * lv);
          const boom = this.add.circle(x, y, R, 0xffa040, 0.6).setDepth(9);
          this.tweens.add({ targets: boom, alpha: 0, scale: 1.3, duration: 300, onComplete: () => boom.destroy() });
        });
      }
    } else if (s.id === 'tentacles') {
      const pool = this.enemies.filter((e) => this.dist(P, e.obj) < 230 * area);
      if (!pool.length) return;
      s.cd = 2.2 * cdm;
      const n = Math.min(pool.length, 2 + Math.floor(lv / 2) + extra + (ev ? 3 : 0));
      const g = this.add.graphics().setDepth(11);
      g.lineStyle(4, SKILLS.tentacles.color, 0.9);
      Phaser.Utils.Array.Shuffle(pool).slice(0, n).forEach((e) => {
        const ex = e.obj.x, ey = e.obj.y, mx = (P.x + ex) / 2 + (Math.random() - 0.5) * 60, my = (P.y + ey) / 2 + (Math.random() - 0.5) * 60;
        g.strokePoints(new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(P.x, P.y), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(ex, ey)).getPoints(14));
        this.hurt(e, (15 + 5 * lv) * (ev ? 1.4 : 1));
        if (e.hp > 0) {
          const a = Math.atan2(P.y - e.obj.y, P.x - e.obj.x);
          e.obj.x += Math.cos(a) * 28; e.obj.y += Math.sin(a) * 28;
          if (ev) e.slowT = 2;
        }
      });
      this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    } else if (s.id === 'heal') {
      s.cd = 6 * cdm;
      this.heal(Math.round(this.run.maxHp * (0.04 + 0.02 * lv)));
      const R = ev ? 130 * area : 60;
      if (ev) for (const e of this.enemies.slice()) if (this.dist(P, e.obj) < R + e.r) this.hurt(e, 25 + 8 * lv);
      const ring = this.add.circle(P.x, P.y, R, 0x6ee79a, 0.2).setStrokeStyle(2, 0x6ee79a).setDepth(9);
      this.tweens.add({ targets: ring, alpha: 0, scale: 1.4, duration: 400, onComplete: () => ring.destroy() });
    }
  }

  private orbs(s: SkillState, dt: number, lv: number, ev: boolean, extra: number, area: number): void {
    const want = (ev ? 6 : 1 + Math.floor(lv / 2)) + extra;
    while (s.orbs.length < want) s.orbs.push(this.add.circle(0, 0, ev ? 10 : 7, ev ? 0xff6a3d : SKILLS.orbs.color).setDepth(9));
    s.angle += (dt * (ev ? 4.5 : 2.6 + 0.15 * lv)) / Math.max(0.5, 1 - this.run.stats.cdr);
    const R = (ev ? 95 : 65) * area;
    s.orbs.forEach((o, i) => {
      const a = s.angle + (i / s.orbs.length) * Math.PI * 2;
      o.setPosition(this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R);
      for (const e of this.enemies.slice()) {
        if (e.hitT > 0) continue;
        if (this.dist(o, e.obj) < e.r + o.radius) this.hurt(e, (8 + 3 * lv) * (ev ? 1.7 : 1));
      }
    });
  }

  private updateShots(dt: number): void {
    this.shots = this.shots.filter((s) => {
      s.obj.x += s.vx * dt; s.obj.y += s.vy * dt; s.life -= dt;
      let alive = s.life > 0;
      for (const e of this.enemies.slice()) {
        if (!alive) break;
        if (s.hit.has(e)) continue;
        if (this.dist(s.obj, e.obj) < e.r + 5) {
          s.hit.add(e); this.hurt(e, s.dmg);
          if (--s.pierce <= 0) alive = false;
        }
      }
      if (!alive) s.obj.destroy();
      return alive;
    });
  }

  private hurt(e: Enemy, base: number): void {
    const st = this.run.stats;
    const crit = Math.random() < st.crit;
    const v = Math.max(1, base * (1 + st.dmg) * (crit ? 1 + st.critDmg : 1));
    e.hp -= v; e.hitT = 0.35; e.obj.setAlpha(0.5);
    if (st.steal > 0) this.heal(Math.min(3, v * st.steal));
    this.pop(e.obj.x, e.obj.y - e.r, Math.round(v).toString(), crit ? '#ffd24d' : '#ffffff', crit);
    if (e.hp > 0) return;
    this.kills++;
    this.gems.push({ obj: this.add.circle(e.obj.x, e.obj.y, 4, 0x5dade2).setDepth(3), v: e.xp });
    this.rollDrop(e);
    e.obj.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  private pop(x: number, y: number, text: string, color: string, big: boolean): void {
    if (this.popCount > 30) return;
    this.popCount++;
    const t = this.add.text(x, y, text, { fontSize: big ? '16px' : '11px', color, fontStyle: big ? 'bold' : 'normal', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 520, onComplete: () => { t.destroy(); this.popCount--; } });
  }

  private rollDrop(e: Enemy): void {
    const st = this.run.stats, mult = 1 + st.drop, ilvl = this.level + Math.floor(this.time_ / 60);
    if (e.elite) {
      if (Math.random() < 0.4) this.spawnDrop(e, undefined, Phaser.Utils.Array.GetRandom(Object.keys(SKILLS)) as SkillId);
      else this.spawnDrop(e, makeItem(ilvl + 2, 2));
    } else if (Math.random() < 0.004 * mult) this.spawnDrop(e, undefined, Phaser.Utils.Array.GetRandom(Object.keys(SKILLS)) as SkillId);
    else if (Math.random() < 0.012 * mult) this.spawnDrop(e, makeItem(ilvl));
  }
  private spawnDrop(e: Enemy, item?: Item, skill?: SkillId): void {
    const x = e.obj.x, y = e.obj.y;
    const obj = skill
      ? this.add.star(x, y, 5, 5, 11, 0xd18bff).setStrokeStyle(2, 0xffffff)
      : this.add.rectangle(x, y, 12, 12, RARITY_COLOR[item!.rarity]).setAngle(45).setStrokeStyle(2, 0xffffff);
    obj.setDepth(4);
    this.tweens.add({ targets: obj, scale: 1.25, yoyo: true, repeat: -1, duration: 500 });
    this.drops.push({ obj, item, skill });
  }
  private updateDrops(): void {
    this.drops = this.drops.filter((d) => {
      if (this.dist(this.player, d.obj) > 22) return true;
      if (d.skill) {
        const r = this.run.addSkill(d.skill);
        this.toast(r === 'new' ? `Nowa umiejętność: ${SKILLS[d.skill].name}!` : r === 'up' ? `${SKILLS[d.skill].name} — wyższy poziom!` : `${SKILLS[d.skill].name} — maks. poziom (+20 złota)`, '#d18bff');
        if (r === 'max') this.run.gold += 20;
        this.syncSlots();
      } else if (d.item) {
        const r = this.run.addItem(d.item);
        this.toast(`${d.item.name}${r === 'equipped' ? ' (założony)' : r === 'bag' ? ' (w plecaku)' : ' (plecak pełny — sprzedany)'}`, '#' + RARITY_COLOR[d.item.rarity].toString(16).padStart(6, '0'));
      }
      d.obj.destroy();
      return false;
    });
  }

  private toast(msg: string, color: string): void {
    const t = this.add.text(this.scale.width / 2, 74, msg, { fontSize: '14px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3, align: 'center', wordWrap: { width: 330 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(150);
    this.tweens.add({ targets: t, y: 56, alpha: 0, delay: 1400, duration: 700, onComplete: () => t.destroy() });
  }

  private updateEnemies(dt: number): void {
    const armor = this.run.stats.armor;
    for (const e of this.enemies) {
      if (e.hitT > 0) { e.hitT -= dt; if (e.hitT <= 0) { e.hitT = 0; e.obj.setAlpha(1); } }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.frozenT > 0) e.frozenT -= dt;
      const f = e.frozenT > 0 ? 0 : e.slowT > 0 ? 0.5 : 1;
      const a = Math.atan2(this.player.y - e.obj.y, this.player.x - e.obj.x);
      e.obj.x += Math.cos(a) * e.speed * f * dt; e.obj.y += Math.sin(a) * e.speed * f * dt;
      if (this.invuln <= 0 && this.dist(e.obj, this.player) < e.r + 12) {
        this.hp -= Math.max(e.dmg * 0.3, e.dmg - Math.min(armor, e.dmg * 0.7)) ; this.invuln = 0.6;
        this.cameras.main.shake(80, 0.004);
      }
    }
  }

  private updateGems(dt: number): void {
    const magnet = 70 * (1 + this.run.stats.magnet);
    this.gems = this.gems.filter((g) => {
      const d = this.dist(g.obj, this.player);
      if (d < magnet) {
        const a = Math.atan2(this.player.y - g.obj.y, this.player.x - g.obj.x);
        g.obj.x += Math.cos(a) * 260 * dt; g.obj.y += Math.sin(a) * 260 * dt;
      }
      if (d < 14) { this.xp += g.v * (1 + this.run.stats.xp); g.obj.destroy(); return false; }
      return true;
    });
    const need = 5 + this.level * 4;
    if (this.xp >= need) {
      this.xp -= need; this.level++; this.run.points++;
      this.toast(`Poziom ${this.level}! +1 punkt umiejętności`, '#ffd86b');
    }
  }

  // ---------- koniec i HUD ----------
  private end(win: boolean): void {
    this.over = true; this.stick.clear();
    const gold = Math.floor((this.kills / 5 + this.time_ / 6) * (1 + this.run.stats.gold)) + this.run.gold + (win ? 50 : 0);
    const meta = loadMeta();
    meta.gold += gold; saveMeta(meta);
    const w = this.scale.width;
    const dim = this.add.rectangle(0, 0, w, this.scale.height, 0x000000, 0.75).setOrigin(0).setScrollFactor(0).setDepth(200).setInteractive();
    const m = Math.floor(this.time_ / 60), s = Math.floor(this.time_ % 60).toString().padStart(2, '0');
    this.add.text(w / 2, 260, win ? 'ZWYCIĘSTWO!' : 'PORAŻKA', { fontSize: '36px', color: win ? '#4ade80' : '#ef4444', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 340, `Czas: ${m}:${s}\nZabici: ${this.kills}\nPoziom: ${this.level}\n+${gold} złota`, { fontSize: '20px', color: '#fff', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(w / 2, 460, 'Dotknij, aby wrócić', { fontSize: '14px', color: '#8892b0' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    dim.on('pointerdown', () => this.scene.start('menu'));
  }

  private drawHud(): void {
    const w = this.scale.width, b = this.bars;
    b.clear();
    b.fillStyle(0x222222).fillRect(0, 0, w, 10);
    b.fillStyle(0x5dade2).fillRect(0, 0, w * Math.min(1, this.xp / (5 + this.level * 4)), 10);
    b.fillStyle(0x222222).fillRect(8, 40, 120, 8);
    b.fillStyle(0xef4444).fillRect(8, 40, 120 * Math.max(0, this.hp) / this.run.maxHp, 8);
    const m = Math.floor(this.time_ / 60), s = Math.floor(this.time_ % 60).toString().padStart(2, '0');
    const sl = this.run.slots.map((id) => (id ? `${this.run.skills[id].evolved ? '★' : ''}${SKILLS[id].name} ${this.run.skills[id].lvl}` : '—')).join(' | ');
    this.hud.setText(`Lv ${this.level}   ${m}:${s}   ☠ ${this.kills}\n\n${sl}`);
    this.treeBtn.setText(this.run.points > 0 ? `DRZEWKO (${this.run.points})` : 'DRZEWKO').setColor(this.run.points > 0 ? '#ffd86b' : '#ffffff');
  }
}
