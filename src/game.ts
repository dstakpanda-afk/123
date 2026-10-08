import Phaser from 'phaser';
import { MAX_LEVEL, PASSIVES, WEAPONS, MetaState, PassiveId, WeaponId, loadMeta, saveMeta } from './data';

interface Enemy { obj: Phaser.GameObjects.Arc; hp: number; speed: number; dmg: number; r: number; xp: number; hitT: number }
interface Gem { obj: Phaser.GameObjects.Arc; v: number }
interface Shot { obj: Phaser.GameObjects.Arc; vx: number; vy: number; life: number; pierce: number; dmg: number; hit: Set<Enemy> }
interface Weapon { id: WeaponId; level: number; evolved: boolean; cd: number; orbs: Phaser.GameObjects.Arc[]; angle: number }
interface Card { title: string; desc: string; color: number; apply: () => void }

const WIN_TIME = 360;
const ENEMY_CAP = 160;

export class GameScene extends Phaser.Scene {
  private meta!: MetaState;
  private player!: Phaser.GameObjects.Arc;
  private hp = 100; private maxHp = 100;
  private invuln = 0;
  private level = 1; private xp = 0;
  private time_ = 0; private kills = 0; private spawnT = 0;
  private enemies: Enemy[] = []; private gems: Gem[] = []; private shots: Shot[] = [];
  private weapons: Weapon[] = [];
  private passives: Partial<Record<PassiveId, number>> = {};
  private paused_ = false; private over = false;
  private aim = new Phaser.Math.Vector2(1, 0);
  private bg!: Phaser.GameObjects.TileSprite;
  private stick!: Phaser.GameObjects.Graphics;
  private stickOrigin: Phaser.Math.Vector2 | null = null;
  private stickVec = new Phaser.Math.Vector2();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hud!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('game'); }

  init(data: { meta?: MetaState }): void {
    this.meta = data.meta ?? loadMeta();
    this.hp = this.maxHp = 100 + this.meta.hp * 10;
    this.invuln = 0; this.level = 1; this.xp = 0; this.time_ = 0; this.kills = 0; this.spawnT = 0;
    this.enemies = []; this.gems = []; this.shots = []; this.weapons = []; this.passives = {};
    this.paused_ = false; this.over = false; this.overlay = []; this.stickOrigin = null;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    const g = this.add.graphics();
    g.lineStyle(1, 0x1c2238).strokeRect(0, 0, 64, 64).generateTexture('grid', 64, 64); g.destroy();
    this.bg = this.add.tileSprite(0, 0, w, h, 'grid').setOrigin(0).setScrollFactor(0);
    this.player = this.add.circle(0, 0, 12, 0x4ade80).setStrokeStyle(2, 0xffffff).setDepth(10);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.bars = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.hud = this.add.text(8, 22, '', { fontSize: '13px', color: '#fff' }).setScrollFactor(0).setDepth(100);
    this.stick = this.add.graphics().setScrollFactor(0).setDepth(100);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (!this.paused_ && !this.over) this.stickOrigin = new Phaser.Math.Vector2(p.x, p.y); });
    this.input.on('pointerup', () => { this.stickOrigin = null; this.stickVec.set(0, 0); });

    this.addWeapon('blade');
    (window as unknown as { __game: GameScene }).__game = this; // do testów
  }

  // ---------- statystyki ----------
  private pl(id: PassiveId): number { return this.passives[id] ?? 0; }
  private dmgMul(): number { return (1 + 0.25 * this.pl('might')) * (1 + 0.08 * this.meta.dmg); }
  private cdMul(): number { return Math.pow(0.9, this.pl('haste')); }
  private speed(): number { return 130 * (1 + 0.1 * this.pl('boots')) * (1 + 0.05 * this.meta.spd); }

  private addWeapon(id: WeaponId): void {
    this.weapons.push({ id, level: 1, evolved: false, cd: 0, orbs: [], angle: 0 });
  }

  // ---------- pętla ----------
  update(_t: number, dtMs: number): void {
    if (this.over || this.paused_) { this.drawHud(); return; }
    const dt = Math.min(dtMs, 50) / 1000;
    this.time_ += dt;
    this.invuln -= dt;

    this.move(dt);
    this.spawn(dt);
    this.weapons.forEach((wp) => this.fire(wp, dt));
    this.updateShots(dt);
    this.updateEnemies(dt);
    this.updateGems(dt);

    this.bg.tilePositionX = this.cameras.main.scrollX;
    this.bg.tilePositionY = this.cameras.main.scrollY;
    this.drawHud();
    if (this.hp <= 0) this.end(false);
    else if (this.time_ >= WIN_TIME) this.end(true);
  }

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
    this.player.x += v.x * this.speed() * dt;
    this.player.y += v.y * this.speed() * dt;
  }

  private spawn(dt: number): void {
    this.spawnT -= dt;
    if (this.spawnT > 0 || this.enemies.length >= ENEMY_CAP) return;
    this.spawnT = Math.max(0.12, 0.8 - this.time_ / 450);
    const t = this.time_;
    const roll = Math.random();
    const scale = 1 + t / 60 * 0.4;
    let r = 10, hp = 12, speed = 55, dmg = 8, color = 0xe74c3c, xp = 1;
    if (t > 40 && roll < 0.25) { r = 8; hp = 7; speed = 95; dmg = 6; color = 0xf1c40f; }
    else if (t > 90 && roll < 0.4) { r = 18; hp = 60; speed = 38; dmg = 16; color = 0x9b59b6; xp = 4; }
    const a = Math.random() * Math.PI * 2;
    const obj = this.add.circle(this.player.x + Math.cos(a) * 400, this.player.y + Math.sin(a) * 400, r, color).setDepth(5);
    this.enemies.push({ obj, hp: hp * scale, speed, dmg, r, xp, hitT: 0 });
  }

  private nearest(maxD = 1e9): Enemy | null {
    let best: Enemy | null = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      const d = (e.obj.x - this.player.x) ** 2 + (e.obj.y - this.player.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------- bronie ----------
  private fire(wp: Weapon, dt: number): void {
    const lv = wp.level, ev = wp.evolved, mul = this.dmgMul();
    if (wp.id === 'orbs') return this.updateOrbs(wp, dt, mul);
    wp.cd -= dt;
    if (wp.cd > 0) return;
    const target = this.nearest(wp.id === 'blade' ? 160 : 420);
    if (!target) return;
    const ang = Math.atan2(target.obj.y - this.player.y, target.obj.x - this.player.x);

    if (wp.id === 'blade') {
      wp.cd = (ev ? 0.55 : 1.0 - 0.07 * lv) * this.cdMul();
      const range = (60 + 7 * lv) * (ev ? 1.6 : 1), dmg = (14 + 5 * lv) * (ev ? 1.8 : 1) * mul;
      const half = ev ? Math.PI : Math.PI / 2;
      for (const e of this.enemies.slice()) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.obj.x, e.obj.y);
        if (d > range + e.r) continue;
        const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.obj.y - this.player.y, e.obj.x - this.player.x) - ang));
        if (da > half) continue;
        this.hurt(e, dmg);
        if (ev && e.hp > 0) { e.obj.x += Math.cos(ang) * 14; e.obj.y += Math.sin(ang) * 14; }
      }
      const arc = this.add.graphics().setDepth(9);
      arc.fillStyle(ev ? 0x8fb4ff : 0xffffff, 0.45).slice(this.player.x, this.player.y, range, ang - half, ang + half).fillPath();
      this.tweens.add({ targets: arc, alpha: 0, duration: 160, onComplete: () => arc.destroy() });
    } else {
      wp.cd = (ev ? 0.9 : 1.3 - 0.1 * lv) * this.cdMul();
      const count = ev ? 5 : 1 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0);
      const spread = ev ? 0.18 : 0.12;
      for (let i = 0; i < count; i++) {
        const a = ang + (i - (count - 1) / 2) * spread;
        const obj = this.add.circle(this.player.x, this.player.y, ev ? 6 : 5, WEAPONS.bolt.color).setDepth(8);
        this.shots.push({ obj, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 1.4, pierce: ev ? 4 : lv >= 4 ? 2 : 1, dmg: (10 + 3 * lv) * mul, hit: new Set() });
      }
    }
  }

  private updateOrbs(wp: Weapon, dt: number, mul: number): void {
    const want = wp.evolved ? 6 : 1 + Math.floor(wp.level / 2);
    while (wp.orbs.length < want) wp.orbs.push(this.add.circle(0, 0, wp.evolved ? 10 : 7, WEAPONS.orbs.color).setDepth(9));
    wp.angle += dt * (wp.evolved ? 4.5 : 2.6 + 0.15 * wp.level) / Math.max(0.6, this.cdMul());
    const R = wp.evolved ? 95 : 65;
    wp.orbs.forEach((o, i) => {
      const a = wp.angle + (i / wp.orbs.length) * Math.PI * 2;
      o.setPosition(this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R);
      if (wp.evolved) o.setRadius(10).setFillStyle(0xff6a3d);
      for (const e of this.enemies.slice()) {
        if (e.hitT > 0) continue;
        if (Phaser.Math.Distance.Between(o.x, o.y, e.obj.x, e.obj.y) < e.r + o.radius) this.hurt(e, (8 + 3 * wp.level) * (wp.evolved ? 1.7 : 1) * mul);
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
        if (Phaser.Math.Distance.Between(s.obj.x, s.obj.y, e.obj.x, e.obj.y) < e.r + 5) {
          s.hit.add(e); this.hurt(e, s.dmg);
          if (--s.pierce <= 0) alive = false;
        }
      }
      if (!alive) s.obj.destroy();
      return alive;
    });
  }

  private hurt(e: Enemy, dmg: number): void {
    e.hp -= dmg; e.hitT = 0.35; // chroni przed wielokrotnym trafieniem tą samą kulą
    e.obj.setAlpha(0.5);
    if (e.hp > 0) return;
    this.kills++;
    this.gems.push({ obj: this.add.circle(e.obj.x, e.obj.y, 4, 0x5dade2).setDepth(3), v: e.xp });
    e.obj.destroy();
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.hitT > 0) { e.hitT -= dt; if (e.hitT <= 0) { e.hitT = 0; e.obj.setAlpha(1); } }
      const a = Math.atan2(this.player.y - e.obj.y, this.player.x - e.obj.x);
      e.obj.x += Math.cos(a) * e.speed * dt; e.obj.y += Math.sin(a) * e.speed * dt;
      if (this.invuln <= 0 && Phaser.Math.Distance.Between(e.obj.x, e.obj.y, this.player.x, this.player.y) < e.r + 12) {
        this.hp -= e.dmg; this.invuln = 0.6;
        this.cameras.main.shake(80, 0.004);
      }
    }
  }

  private updateGems(dt: number): void {
    const magnet = 70;
    this.gems = this.gems.filter((g) => {
      const d = Phaser.Math.Distance.Between(g.obj.x, g.obj.y, this.player.x, this.player.y);
      if (d < magnet) {
        const a = Math.atan2(this.player.y - g.obj.y, this.player.x - g.obj.x);
        g.obj.x += Math.cos(a) * 260 * dt; g.obj.y += Math.sin(a) * 260 * dt;
      }
      if (d < 14) { this.xp += g.v; g.obj.destroy(); return false; }
      return true;
    });
    const need = 5 + this.level * 4;
    if (this.xp >= need) { this.xp -= need; this.level++; this.levelUp(); }
  }

  // ---------- level up i ewolucje ----------
  private buildCards(): Card[] {
    const evo: Card[] = [], rest: Card[] = [];
    for (const wp of this.weapons) {
      const def = WEAPONS[wp.id];
      if (wp.evolved) continue;
      if (wp.level >= MAX_LEVEL && this.pl(def.evolvesWith) > 0) {
        evo.push({ title: `★ EWOLUCJA: ${def.evolvedName}`, desc: def.evolvedDesc, color: 0xffd86b, apply: () => { wp.evolved = true; wp.orbs.forEach((o) => o.destroy()); wp.orbs = []; } });
      } else if (wp.level < MAX_LEVEL) {
        rest.push({ title: `${def.name} → poz. ${wp.level + 1}`, desc: def.desc + (wp.level + 1 === MAX_LEVEL ? `\n(maks. — potrzebuje: ${PASSIVES[def.evolvesWith].name})` : ''), color: 0x3b82f6, apply: () => { wp.level++; } });
      }
    }
    if (this.weapons.length < 3) {
      (Object.keys(WEAPONS) as WeaponId[]).filter((id) => !this.weapons.some((w) => w.id === id)).forEach((id) =>
        rest.push({ title: `Nowa broń: ${WEAPONS[id].name}`, desc: WEAPONS[id].desc, color: 0x22c55e, apply: () => this.addWeapon(id) }));
    }
    (Object.keys(PASSIVES) as PassiveId[]).forEach((id) => {
      const l = this.pl(id);
      if (l >= MAX_LEVEL) return;
      rest.push({ title: `${PASSIVES[id].name} → poz. ${l + 1}`, desc: PASSIVES[id].desc, color: 0xa855f7, apply: () => { this.passives[id] = l + 1; if (id === 'vigor') { this.maxHp += 20; this.hp += 20; } } });
    });
    Phaser.Utils.Array.Shuffle(rest);
    return [...evo, ...rest].slice(0, 3);
  }

  private levelUp(): void {
    const cards = this.buildCards();
    if (cards.length === 0) { this.hp = Math.min(this.maxHp, this.hp + 30); return; }
    this.paused_ = true; this.stickOrigin = null; this.stick.clear();
    const w = this.scale.width;
    const dim = this.add.rectangle(0, 0, w, this.scale.height, 0x000000, 0.7).setOrigin(0).setScrollFactor(0).setDepth(200);
    const title = this.add.text(w / 2, 70, `POZIOM ${this.level}`, { fontSize: '28px', color: '#ffd86b', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.overlay.push(dim, title);
    cards.forEach((c, i) => {
      const y = 190 + i * 130;
      const bg = this.add.rectangle(w / 2, y, 310, 110, 0x1b2036).setStrokeStyle(3, c.color).setScrollFactor(0).setDepth(201).setInteractive();
      const t = this.add.text(w / 2, y - 22, c.title, { fontSize: '17px', color: '#fff', fontStyle: 'bold', align: 'center', wordWrap: { width: 290 } }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      const d = this.add.text(w / 2, y + 22, c.desc, { fontSize: '13px', color: '#aab', align: 'center', wordWrap: { width: 290 } }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
      bg.on('pointerdown', () => { c.apply(); this.closeOverlay(); this.paused_ = false; });
      this.overlay.push(bg, t, d);
    });
  }

  private closeOverlay(): void { this.overlay.forEach((o) => o.destroy()); this.overlay = []; }

  // ---------- koniec i HUD ----------
  private end(win: boolean): void {
    this.over = true; this.stick.clear();
    const gold = Math.floor(this.kills / 5 + this.time_ / 6) + (win ? 50 : 0);
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
    b.fillStyle(0xef4444).fillRect(8, 40, 120 * Math.max(0, this.hp) / this.maxHp, 8);
    const m = Math.floor(this.time_ / 60), s = Math.floor(this.time_ % 60).toString().padStart(2, '0');
    const wl = this.weapons.map((x) => `${x.evolved ? '★' + WEAPONS[x.id].evolvedName : WEAPONS[x.id].name} ${x.level}`).join(' | ');
    this.hud.setText(`Lv ${this.level}   ${m}:${s}   ☠ ${this.kills}\n\n${wl}`);
  }
}
