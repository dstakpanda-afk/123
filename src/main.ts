import Phaser from 'phaser';
import { MenuScene } from './menu';
import { GameScene } from './game';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.body,
  backgroundColor: '#0b0b14',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 360, height: 640 },
  input: { activePointers: 2 },
  scene: [MenuScene, GameScene],
});
