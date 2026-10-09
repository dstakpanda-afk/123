import Phaser from 'phaser';
import { BOSS_POINTS, CLASSES, CLASS_IDS, MODES, ModeId, SKILLS, fmtShort, pickBoss, xpNeed } from './data';
import { Character, getChar, setChar } from './char';
import { H, S, W, hex, setupCam, spr } from './gfx';

function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, cb: () => void, fill = 0x22304f, stroke = 0x4d6bb3, size = 15): Phaser.GameObjects.Text {
  const r = scene.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, stroke).setInteractive();
  const t = scene.add.text(x, y, label, { fontSize: `${size}px`, color: '#fff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
  r.on('pointerup', cb);
  return t;
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create(): void {
    setupCam(this);
    this.add.rectangle(0, 0, W, H, 0x0a0814).setOrigin(0);
    const c = getChar();
    if (!c) { this.scene.start('classes'); return; }
    const w = W, def = CLASSES[c.cls];
    this.add.text(w / 2, 30, 'SZEPT OTCHŁANI', { fontSize: '26px', color: '#c9a4ff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(w / 2, 70, `${def.name}  ·  poziom ${c.level}`, { fontSize: '17px', color: hex(def.color), fontStyle: 'bold' }).setOrigin(0.5);
    const need = xpNeed(c.level), g = this.add.graphics();
    g.fillStyle(0x000000, 0.8).fillRect(40, 90, 280, 16).fillStyle(0x8fa9ff).fillRect(42, 92, 276 * Math.min(1, c.xp / need), 12).lineStyle(2, 0xffffff, 0.7).strokeRect(40, 90, 280, 16);
    this.add.text(w / 2, 98, `XP ${Math.floor(c.xp)} / ${need}`, { fontSize: '11px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    this.add.text(w / 2, 124, `Punkty drzewka: ${c.points}   ·   Złoto: ${c.gold}`, { fontSize: '14px', color: '#fff' }).setOrigin(0.5);
    this.add.text(w / 2, 144, `Wyprawy: ${c.runs}   ·   Wygrane: ${c.wins}`, { fontSize: '12px', color: '#8f86b3' }).setOrigin(0.5);

    const boss = pickBoss(c.level, c.bosses);
    (['quick', 'long'] as ModeId[]).forEach((id, i) => {
      const md = MODES[id], y = 200 + i * 80;
      const r = this.add.rectangle(w / 2, y, 330, 72, id === 'quick' ? 0x1d3d2c : 0x4a1f2b).setStrokeStyle(3, md.color).setInteractive();
      this.add.text(w / 2, y - 24, md.name, { fontSize: '18px', color: hex(md.color), fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(w / 2, id === 'long' ? y + 12 : y + 6, id === 'long' ? `ok. 4–6 min · 500 wrogów · ×2 XP, ×3 złota\nboss: ${boss.name}${c.bosses[boss.id] ? '' : ` · 1. raz: +${BOSS_POINTS} pkt`}` : md.desc, { fontSize: '12px', color: '#e4e9ff', align: 'center', lineSpacing: 2 }).setOrigin(0.5);
      r.on('pointerup', () => this.scene.start('game', { mode: id }));
    });
    const pts = c.points > 0 ? ` (${c.points})` : '';
    button(this, 95, 346, 156, 44, `DRZEWKO${pts}`, () => this.scene.start('tree'), c.points > 0 ? 0x2b5a3a : 0x22304f, c.points > 0 ? 0x4ade80 : 0x4d6bb3);
    button(this, 265, 346, 156, 44, 'UMIEJĘTNOŚCI', () => this.scene.start('skills'));
    button(this, 95, 396, 156, 44, 'EKWIPUNEK', () => this.scene.start('inv'));
    button(this, 265, 396, 156, 44, 'HANDLARZ', () => this.scene.start('shop'));

    button(this, w / 2, 446, 330, 40, 'OSIĄGNIĘCIA I BOSSOWIE', () => this.scene.start('ach'), 0x3a3320, 0x9b8a4d, 14);
    this.add.text(16, 484, 'Aktywny zestaw', { fontSize: '13px', color: '#8f86b3' });
    c.loadout.forEach((l, i) => {
      const x = 30 + i * 56, y = 534;
      this.add.rectangle(x + (i >= 3 ? 14 : 0), y, 46, 46, 0x120e24).setStrokeStyle(2, l.skill ? SKILLS[l.skill].color : 0x2a3050);
      if (l.skill) {
        spr(this, x + (i >= 3 ? 14 : 0), y - 2, `ic_${l.skill}`).setScale(40 / 44 / S);
        this.add.text(x + (i >= 3 ? 14 : 0) + 21, y + 22, `${c.skills[l.skill]}`, { fontSize: '12px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 1);
      }
      const sups = l.sup.filter((x2) => !!x2).length;
      this.add.text(x + (i >= 3 ? 14 : 0), y + 34, `${sups}/${l.sup.length}`, { fontSize: '10px', color: '#8a82b4' }).setOrigin(0.5);
    });
    this.add.text(16, 588, 'ataki  |  aury · wzmocnienia · słudzy', { fontSize: '11px', color: '#6f6896' });

    const reset = this.add.text(w / 2, 622, 'Nowa postać', { fontSize: '13px', color: '#8a82b4' }).setOrigin(0.5).setInteractive();
    let armed = false;
    reset.on('pointerup', () => {
      if (armed) { this.scene.start('classes', { fresh: true }); return; }
      armed = true; reset.setText('Dotknij ponownie: USUNIE obecną postać!').setColor('#ff6b81');
      this.time.delayedCall(2500, () => { armed = false; reset.setText('Nowa postać').setColor('#8a82b4'); });
    });
  }
}

export class ClassScene extends Phaser.Scene {
  private fresh = false;
  constructor() { super('classes'); }
  init(d: { fresh?: boolean }): void { this.fresh = !!d?.fresh; }

  create(): void {
    setupCam(this);
    this.add.rectangle(0, 0, W, H, 0x0a0814).setOrigin(0);
    const w = W;
    this.add.text(w / 2, 30, 'WYBIERZ ŚCIEŻKĘ', { fontSize: '22px', color: '#c9a4ff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(w / 2, 58, 'Jedno drzewko, klasa to miejsce startu.', { fontSize: '11px', wordWrap: { width: 330 }, color: '#8f86b3', align: 'center' }).setOrigin(0.5);
    CLASS_IDS.forEach((id, i) => {
      const c = CLASSES[id], y = 118 + i * 92, col = hex(c.color);
      const bg = this.add.rectangle(w / 2, y, 340, 84, 0x14102a).setStrokeStyle(3, c.color).setInteractive();
      spr(this, 44, y, `pl_${id}`).setScale(1.25 / S);
      this.add.text(82, y - 38, c.name, { fontSize: '16px', color: col, fontStyle: 'bold' });
      this.add.text(82, y - 20, c.desc, { fontSize: '11px', color: '#d6d0ee', wordWrap: { width: 250 } });
      this.add.text(82, y + 11, `${SKILLS[c.skill].name}: ${fmtShort(c.stats)}`, { fontSize: '11px', color: col, wordWrap: { width: 250 } });
      bg.on('pointerup', () => {
        const ch = Character.create(id);
        setChar(ch); ch.save();
        this.scene.start('menu');
      });
    });
    if (this.fresh) {
      const back = this.add.text(w / 2, 622, '‹ wróć', { fontSize: '14px', color: '#8f86b3' }).setOrigin(0.5).setInteractive();
      back.on('pointerup', () => this.scene.start('menu'));
    }
  }
}
