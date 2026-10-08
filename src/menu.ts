import Phaser from 'phaser';
import { loadMeta, saveMeta, MetaState } from './data';

const UPGRADES: { key: 'hp' | 'dmg' | 'spd'; label: string }[] = [
  { key: 'hp', label: 'Życie +10' },
  { key: 'dmg', label: 'Obrażenia +8%' },
  { key: 'spd', label: 'Szybkość +5%' },
];
const MAX_META = 10;

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create(): void {
    const meta = loadMeta();
    const w = this.scale.width;
    this.add.text(w / 2, 90, 'EVOLUTION\nARPG', { fontSize: '40px', color: '#ffd86b', align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    const goldTxt = this.add.text(w / 2, 170, '', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);

    const rows: (() => void)[] = [];
    UPGRADES.forEach((u, i) => {
      const y = 240 + i * 70;
      const bg = this.add.rectangle(w / 2, y, 300, 56, 0x22304f).setStrokeStyle(2, 0x4d6bb3).setInteractive();
      const txt = this.add.text(w / 2, y, '', { fontSize: '16px', color: '#fff', align: 'center' }).setOrigin(0.5);
      const refresh = () => {
        const lvl = meta[u.key];
        const cost = this.cost(lvl);
        txt.setText(`${u.label}  [${lvl}/${MAX_META}]\n${lvl >= MAX_META ? 'MAX' : cost + ' złota'}`);
        bg.setFillStyle(lvl < MAX_META && meta.gold >= cost ? 0x2b5a3a : 0x22304f);
      };
      rows.push(refresh);
      bg.on('pointerdown', () => {
        const cost = this.cost(meta[u.key]);
        if (meta[u.key] >= MAX_META || meta.gold < cost) return;
        meta.gold -= cost; meta[u.key]++;
        saveMeta(meta);
        update();
      });
    });
    const update = () => { goldTxt.setText(`Złoto: ${meta.gold}`); rows.forEach((r) => r()); };
    update();

    const play = this.add.rectangle(w / 2, 520, 240, 70, 0xc0392b).setStrokeStyle(3, 0xffd86b).setInteractive();
    this.add.text(w / 2, 520, 'GRAJ', { fontSize: '30px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    play.on('pointerdown', () => this.scene.start('game', { meta } as { meta: MetaState }));
    this.add.text(w / 2, 600, 'Sterowanie: przeciągnij palcem (WASD na PC)\nAtaki są automatyczne', { fontSize: '12px', color: '#8892b0', align: 'center' }).setOrigin(0.5);
  }

  private cost(level: number): number { return 20 * (level + 1); }
}
