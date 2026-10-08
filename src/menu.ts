import Phaser from 'phaser';
import { CLASSES, CLASS_IDS, SKILLS, SUPPORTS, fmtShort } from './data';
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
    this.add.text(w / 2, 62, 'SZEPT\nOTCHŁANI', { fontSize: '34px', color: '#c9a4ff', align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(w / 2, 128, def.name, { fontSize: '18px', color: hex(def.color), fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(w / 2, 152, `Punkty drzewka: ${c.points}   ·   Złoto: ${c.gold}`, { fontSize: '13px', color: '#fff' }).setOrigin(0.5);
    this.add.text(w / 2, 172, `Wyprawy: ${c.runs}   ·   Najlepszy poziom: ${c.best}`, { fontSize: '12px', color: '#8f86b3' }).setOrigin(0.5);

    button(this, w / 2, 235, 300, 68, 'WYRUSZ NA WYPRAWĘ', () => this.scene.start('game'), 0x5a2233, 0xff4d6d, 20);
    const pts = c.points > 0 ? ` (${c.points})` : '';
    button(this, 95, 310, 156, 48, `DRZEWKO${pts}`, () => this.scene.start('tree'), c.points > 0 ? 0x2b5a3a : 0x22304f, c.points > 0 ? 0x4ade80 : 0x4d6bb3);
    button(this, 265, 310, 156, 48, 'UMIEJĘTNOŚCI', () => this.scene.start('skills'));
    button(this, 95, 368, 156, 48, 'EKWIPUNEK', () => this.scene.start('inv'));
    button(this, 265, 368, 156, 48, 'HANDLARZ', () => this.scene.start('shop'));

    this.add.text(16, 414, 'Aktywny zestaw', { fontSize: '13px', color: '#8f86b3' });
    const lines = c.loadout.map((l, i) => {
      if (!l.skill) return `${i < 3 ? 'Główna' : 'Poboczna'}: —`;
      const sups = l.sup.filter((s): s is NonNullable<typeof s> => !!s).map((s) => SUPPORTS[s].short).join(' ');
      return `${i < 3 ? 'Główna' : 'Poboczna'}: ${SKILLS[l.skill].name} ${c.skills[l.skill]}${sups ? '  [' + sups + ']' : ''}`;
    });
    this.add.text(16, 436, lines.join('\n'), { fontSize: '13px', color: '#d6d0ee', lineSpacing: 6 });

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
