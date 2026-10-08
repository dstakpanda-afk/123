import Phaser from 'phaser';
import { MenuScene, ClassScene } from './menu';
import { GameScene } from './game';
import { TreeScene, InvScene } from './ui';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.body,
  backgroundColor: '#0a0814',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 360, height: 640 },
  input: { activePointers: 2 },
  scene: [MenuScene, ClassScene, GameScene, TreeScene, InvScene],
});
