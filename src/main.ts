import Phaser from 'phaser';
import { MenuScene, ClassScene } from './menu';
import { GameScene } from './game';
import { TreeScene, InvScene, SkillsScene, ShopScene, AchScene, DailyScene } from './ui';
import { H, S, W, makeTextures, patchText } from './gfx';
import { makeItem } from './items';
import * as tree from './tree';

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create(): void {
    makeTextures(this);
    this.textures.each((t: Phaser.Textures.Texture) => { if (t.key !== '__DEFAULT' && t.key !== '__MISSING' && t.key !== '__WHITE') t.setFilter(Phaser.Textures.FilterMode.LINEAR); }, this);
    this.scene.start('menu');
  }
}

patchText();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.body,
  backgroundColor: '#0a0814',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W * S, height: H * S },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, ClassScene, GameScene, TreeScene, InvScene, SkillsScene, ShopScene, AchScene, DailyScene],
});
Object.assign(window, { __phaser: game, __mk: makeItem, __tree: tree }); // do testów
