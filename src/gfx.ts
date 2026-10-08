import Phaser from 'phaser';
import { CLASS_IDS, CLASSES, ClassId, SKILLS, SKILL_IDS, SkillId } from './data';

/** gra jest rysowana w podwójnej rozdzielczości; logiczny ekran to 360x640 */
export const S = 2;
export const W = 360;
export const H = 640;

/** każda scena: zoom S z początkiem w (0,0), więc współrzędne logiczne zostają 360x640 */
export function setupCam(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(S).setOrigin(0, 0).setScroll(0, 0);
}

/** twarde kolory z podpisem rzadkości itp. */
export const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

class Pen {
  constructor(public g: Phaser.GameObjects.Graphics) {}
  circle(x: number, y: number, r: number, fill: number, a = 1): this { this.g.fillStyle(fill, a).fillCircle(x * S, y * S, r * S); return this; }
  ring(x: number, y: number, r: number, c: number, lw: number, a = 1): this { this.g.lineStyle(lw * S, c, a).strokeCircle(x * S, y * S, r * S); return this; }
  ellipse(x: number, y: number, w: number, h: number, fill: number, a = 1): this { this.g.fillStyle(fill, a).fillEllipse(x * S, y * S, w * S, h * S); return this; }
  rect(x: number, y: number, w: number, h: number, fill: number, a = 1, r = 0): this {
    this.g.fillStyle(fill, a);
    if (r) this.g.fillRoundedRect(x * S, y * S, w * S, h * S, r * S); else this.g.fillRect(x * S, y * S, w * S, h * S);
    return this;
  }
  frame(x: number, y: number, w: number, h: number, c: number, lw: number, r = 0): this {
    this.g.lineStyle(lw * S, c);
    if (r) this.g.strokeRoundedRect(x * S, y * S, w * S, h * S, r * S); else this.g.strokeRect(x * S, y * S, w * S, h * S);
    return this;
  }
  poly(pts: number[][], fill?: number, stroke?: number, lw = 2): this {
    const p = pts.map(([x, y]) => new Phaser.Math.Vector2(x * S, y * S));
    if (fill !== undefined) this.g.fillStyle(fill).fillPoints(p, true);
    if (stroke !== undefined) this.g.lineStyle(lw * S, stroke).strokePoints(p, true);
    return this;
  }
  path(pts: number[][], c: number, lw: number, a = 1): this {
    this.g.lineStyle(lw * S, c, a).strokePoints(pts.map(([x, y]) => new Phaser.Math.Vector2(x * S, y * S)), false);
    return this;
  }
  line(x1: number, y1: number, x2: number, y2: number, c: number, lw: number): this { this.g.lineStyle(lw * S, c).lineBetween(x1 * S, y1 * S, x2 * S, y2 * S); return this; }
  arc(x: number, y: number, r: number, a0: number, a1: number, c: number, lw: number): this {
    this.g.lineStyle(lw * S, c).beginPath().arc(x * S, y * S, r * S, a0, a1).strokePath();
    return this;
  }
}

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (p: Pen) => void, hires = true): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(new Pen(g));
  const k = hires ? S : 1;
  g.generateTexture(key, w * k, h * k);
  g.destroy();
}

const star = (cx: number, cy: number, ro: number, ri: number, n = 5, rot = -Math.PI / 2): number[][] =>
  Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

const BLACK = 0x07050f;

function classGlyph(p: Pen, id: ClassId, cx: number, cy: number): void {
  const w = 0xffffff;
  switch (id) {
    case 'blood': p.circle(cx, cy + 2, 4.5, w).poly([[cx - 4, cy], [cx + 4, cy], [cx, cy - 7]], w); break;
    case 'star': p.poly(star(cx, cy, 7, 3), w); break;
    case 'void': p.poly([[cx, cy - 7], [cx + 5, cy], [cx, cy + 7], [cx - 5, cy]], w); break;
    case 'deep': p.ellipse(cx, cy, 14, 8, w).circle(cx, cy, 3.2, BLACK); break;
    case 'dream': p.circle(cx, cy, 6.5, w).circle(cx + 3, cy - 2, 5.5, CLASSES.dream.color); break;
    case 'bone': p.line(cx - 5, cy - 5, cx + 5, cy + 5, w, 3).line(cx + 5, cy - 5, cx - 5, cy + 5, w, 3).circle(cx - 6, cy - 6, 2, w).circle(cx + 6, cy + 6, 2, w).circle(cx + 6, cy - 6, 2, w).circle(cx - 6, cy + 6, 2, w); break;
  }
}

function skillGlyph(p: Pen, id: SkillId, cx: number, cy: number, c: number): void {
  switch (id) {
    case 'blade': p.arc(cx + 3, cy, 12, Math.PI * 0.55, Math.PI * 1.45, c, 4).line(cx - 7, cy - 10, cx - 3, cy - 6, c, 3); break;
    case 'orbs': p.ellipse(cx, cy, 24, 15, c).circle(cx, cy, 5.5, BLACK).circle(cx - 1.5, cy - 1.5, 1.6, 0xffffff); break;
    case 'bolt': p.line(cx - 11, cy, cx + 6, cy, c, 4).poly([[cx + 12, cy], [cx + 3, cy - 7], [cx + 3, cy + 7]], c); break;
    case 'nova': p.ring(cx, cy, 5, c, 3).ring(cx, cy, 11, c, 2.5); break;
    case 'chain': p.path([[cx - 4, cy - 12], [cx + 4, cy - 3], [cx - 4, cy + 1], [cx + 5, cy + 12]], c, 4); break;
    case 'meteor': p.circle(cx + 4, cy + 4, 7, c).line(cx - 11, cy - 11, cx - 2, cy - 2, c, 3).line(cx - 12, cy - 4, cx - 5, cy + 1, c, 2.5); break;
    case 'tentacles': p.path(Array.from({ length: 12 }, (_, i) => [cx - 11 + i * 2, cy + Math.sin(i * 0.9) * 7]), c, 4); break;
    case 'spikes': p.poly([[cx - 12, cy + 10], [cx - 7, cy - 8], [cx - 2, cy + 10]], c).poly([[cx - 3, cy + 10], [cx + 3, cy - 12], [cx + 9, cy + 10]], c); break;
    case 'rift': p.arc(cx, cy, 11, 0.3, Math.PI * 1.7, c, 3.5).arc(cx, cy, 6, Math.PI, Math.PI * 2.6, c, 3).circle(cx, cy, 2, c); break;
    case 'lance': p.line(cx - 13, cy + 8, cx + 8, cy - 8, c, 4).poly([[cx + 13, cy - 12], [cx + 3, cy - 9], [cx + 9, cy - 3]], c); break;
    case 'scythe': p.arc(cx, cy + 3, 12, Math.PI * 1.05, Math.PI * 1.95, c, 4.5).line(cx + 9, cy - 6, cx + 9, cy + 12, c, 3); break;
    case 'swarm': [[-8, -7], [3, -9], [-2, 1], [8, 7], [-9, 8]].forEach(([dx, dy]) => { p.circle(cx + dx, cy + dy, 3.4, c).line(cx + dx - 6, cy + dy + 4, cx + dx - 2, cy + dy + 1.5, c, 1.8); }); break;
    case 'heal': p.rect(cx - 3, cy - 11, 6, 22, c).rect(cx - 11, cy - 3, 22, 6, c); break;
    case 'frenzy': p.poly([[cx, cy - 13], [cx + 8, cy - 1], [cx + 5, cy + 12], [cx - 5, cy + 12], [cx - 8, cy - 1], [cx - 3, cy - 4]], c); break;
    case 'ward': p.poly([[cx - 10, cy - 10], [cx + 10, cy - 10], [cx + 9, cy + 3], [cx, cy + 13], [cx - 9, cy + 3]], undefined, c, 3.5); p.line(cx, cy - 6, cx, cy + 6, c, 3); break;
    case 'haste': p.ring(cx, cy, 11, c, 3).line(cx, cy, cx, cy - 7, c, 3).line(cx, cy, cx + 6, cy + 3, c, 3); break;
    case 'a_fury': p.ring(cx, cy, 12, c, 2.5, 0.8).path([[cx - 6, cy + 3], [cx, cy - 5], [cx + 6, cy + 3]], c, 3.5).path([[cx - 6, cy + 9], [cx, cy + 1], [cx + 6, cy + 9]], c, 3.5); break;
    case 'a_haste': p.ring(cx, cy, 12, c, 2.5, 0.8).line(cx, cy, cx, cy - 7, c, 3).line(cx, cy, cx + 6, cy + 3, c, 3); break;
    case 'a_guard': p.ring(cx, cy, 12, c, 2.5, 0.8).poly([[cx - 6, cy - 6], [cx + 6, cy - 6], [cx + 5, cy + 2], [cx, cy + 8], [cx - 5, cy + 2]], c); break;
    case 'a_sight': p.ring(cx, cy, 12, c, 2.5, 0.8).ellipse(cx, cy, 15, 9, c).circle(cx, cy, 3, BLACK); break;
    case 'm_eye': p.ellipse(cx, cy, 16, 11, c).circle(cx, cy, 4, BLACK).poly([[cx - 8, cy - 2], [cx - 15, cy - 8], [cx - 10, cy + 2]], c).poly([[cx + 8, cy - 2], [cx + 15, cy - 8], [cx + 10, cy + 2]], c); break;
    case 'm_servant': p.circle(cx, cy - 3, 8, c).circle(cx - 3, cy - 4, 1.8, BLACK).circle(cx + 3, cy - 4, 1.8, BLACK).path([[cx - 5, cy + 4], [cx - 7, cy + 11]], c, 3).path([[cx, cy + 5], [cx, cy + 12]], c, 3).path([[cx + 5, cy + 4], [cx + 7, cy + 11]], c, 3); break;
  }
}

export function makeTextures(scene: Phaser.Scene): void {
  // ----- postacie -----
  CLASS_IDS.forEach((id) => tex(scene, `pl_${id}`, 40, 40, (p) => {
    const c = CLASSES[id].color;
    p.ellipse(20, 33, 26, 8, BLACK, 0.5);
    p.circle(20, 19, 15.5, BLACK).circle(20, 19, 13.5, c).circle(15.5, 14.5, 4.5, 0xffffff, 0.35).ring(20, 19, 13.5, 0xffffff, 1.2, 0.7);
    classGlyph(p, id, 20, 19);
  }));
  // ----- wrogowie -----
  tex(scene, 'e_grunt', 32, 32, (p) => {
    p.ellipse(16, 27, 22, 7, BLACK, 0.5);
    p.circle(11, 23, 4.5, BLACK).circle(21, 23, 4.5, BLACK).circle(16, 15, 13, BLACK);
    p.circle(11, 22.5, 3.5, 0xb03a5b).circle(21, 22.5, 3.5, 0xb03a5b).circle(16, 15, 11.5, 0xb03a5b);
    p.circle(12, 10, 3, 0xe8607f, 0.6);
    p.ellipse(16, 14, 11, 10, 0xffffff).circle(16, 15, 3.6, BLACK).circle(15, 13.8, 1.1, 0xffffff);
  });
  tex(scene, 'e_fast', 32, 32, (p) => {
    p.ellipse(16, 27, 18, 6, BLACK, 0.45);
    p.poly(star(16, 15, 14, 6, 6, -Math.PI / 2), 0x3fb8a0, BLACK, 2.5);
    p.circle(16, 15, 4.5, 0xffffff).circle(16, 15, 2, BLACK);
  });
  tex(scene, 'e_tank', 48, 48, (p) => {
    p.ellipse(24, 41, 34, 9, BLACK, 0.5);
    p.circle(24, 22, 20, BLACK).circle(24, 22, 18, 0x6b4aa0).circle(18, 14, 5, 0x9b7bd6, 0.5);
    p.circle(16, 17, 3.4, 0xffe066).circle(32, 17, 3.4, 0xffe066).circle(16, 17.5, 1.4, BLACK).circle(32, 17.5, 1.4, BLACK);
    p.poly([[10, 26], [38, 26], [34, 36], [14, 36]], BLACK);
    [14, 20, 26, 32].forEach((x) => p.poly([[x, 26], [x + 3, 26], [x + 1.5, 31]], 0xffffff));
  });
  tex(scene, 'e_elite', 64, 64, (p) => {
    p.ellipse(32, 55, 44, 11, BLACK, 0.5);
    p.poly([[14, 28], [10, 4], [26, 16]], 0xffe066, BLACK, 2).poly([[50, 28], [54, 4], [38, 16]], 0xffe066, BLACK, 2);
    p.circle(32, 33, 25, BLACK).circle(32, 33, 22.5, 0xff9f1a).circle(23, 24, 7, 0xffd27a, 0.55);
    p.ring(32, 33, 22.5, 0xffffff, 2, 0.9);
    p.ellipse(32, 31, 22, 15, 0xffffff).circle(32, 31, 6.5, 0xd7191c).circle(32, 31, 2.8, BLACK);
    p.poly([[20, 45], [44, 45], [40, 52], [24, 52]], BLACK);
  });
  // ----- łup, XP, pociski -----
  tex(scene, 'xp', 16, 16, (p) => { p.poly([[8, 1], [14, 8], [8, 15], [2, 8]], 0x8fe3ff, BLACK, 1.8).poly([[8, 4], [11, 8], [8, 6.5]], 0xffffff); });
  tex(scene, 'drop_item', 26, 26, (p) => { p.poly([[13, 1], [25, 13], [13, 25], [1, 13]], 0xffffff, BLACK, 2.5).poly([[13, 6], [20, 13], [13, 20], [6, 13]], 0xdddddd).poly([[13, 5], [17, 9], [13, 8]], 0xffffff); });
  tex(scene, 'drop_star', 32, 32, (p) => { p.poly(star(16, 17, 15, 7), 0xffffff, BLACK, 2.5).circle(16, 17, 3.5, 0xdddddd); });
  tex(scene, 'drop_hex', 30, 30, (p) => { p.poly(Array.from({ length: 6 }, (_, i) => [15 + Math.cos((i * Math.PI) / 3) * 13, 15 + Math.sin((i * Math.PI) / 3) * 13]), 0xffffff, BLACK, 2.5).circle(15, 15, 5, 0xdddddd); });
  tex(scene, 'beam', 12, 90, (p) => { for (let i = 0; i < 18; i++) p.rect(2 + i * 0.2, 90 - (i + 1) * 5, 8 - i * 0.4, 5, 0xffffff, 0.5 * (1 - i / 18)); });
  tex(scene, 'bolt', 28, 14, (p) => { p.poly([[1, 7], [10, 1], [27, 7], [10, 13]], 0x4ff0d2, BLACK, 2).line(6, 7, 22, 7, 0xffffff, 2.5); });
  tex(scene, 'orb', 26, 26, (p) => { p.circle(13, 13, 12, BLACK).circle(13, 13, 10.5, 0xb58cff).ellipse(13, 13, 15, 10, 0xffffff).circle(13, 13, 3.6, BLACK).circle(12, 12, 1.2, 0xffffff); });
  tex(scene, 'lance', 48, 12, (p) => { p.poly([[1, 6], [14, 1], [47, 6], [14, 11]], 0xfff2a8, BLACK, 2).line(10, 6, 40, 6, 0xffffff, 2.5); });
  tex(scene, 'scythe', 44, 44, (p) => { p.arc(22, 22, 15, Math.PI * 1.1, Math.PI * 2.0, BLACK, 9).arc(22, 22, 15, Math.PI * 1.1, Math.PI * 2.0, 0xff5470, 5.5).circle(22, 22, 3, 0xffffff); });
  tex(scene, 'wisp', 20, 20, (p) => { p.circle(10, 10, 9, 0x6ee7ff, 0.35).circle(10, 10, 6, 0x6ee7ff).circle(10, 10, 3, 0xffffff); });
  tex(scene, 'mn_eye', 36, 30, (p) => {
    p.ellipse(18, 26, 18, 5, BLACK, 0.45);
    p.poly([[9, 13], [0, 5], [6, 18]], 0xc9a4ff, BLACK, 1.5).poly([[27, 13], [36, 5], [30, 18]], 0xc9a4ff, BLACK, 1.5);
    p.ellipse(18, 14, 22, 17, BLACK).ellipse(18, 14, 19, 14, 0xe8d9ff).circle(18, 14, 5.5, 0x6b4aa0).circle(18, 14, 2.4, BLACK).circle(16.5, 12.5, 1.2, 0xffffff);
  });
  tex(scene, 'mn_servant', 34, 40, (p) => {
    p.ellipse(17, 36, 20, 6, BLACK, 0.45);
    p.circle(17, 15, 12.5, BLACK).circle(17, 15, 11, 0x8f6bd6);
    [[8, 24, 6, 34], [17, 26, 17, 36], [26, 24, 28, 34]].forEach(([a, b, c2, d]) => { p.line(a, b, c2, d, BLACK, 5.5).line(a, b, c2, d, 0x8f6bd6, 3); });
    p.circle(13, 13, 3.2, 0xffffff).circle(21, 13, 3.2, 0xffffff).circle(13, 13.5, 1.4, BLACK).circle(21, 13.5, 1.4, BLACK);
  });
  // ----- ikony umiejętności -----
  SKILL_IDS.forEach((id) => tex(scene, `ic_${id}`, 44, 44, (p) => {
    const c = SKILLS[id].color;
    p.rect(1, 1, 42, 42, 0x120e24, 1, 7).frame(1.5, 1.5, 41, 41, c, 2.5, 7);
    skillGlyph(p, id, 22, 22, c);
  }));
  // ----- ikony slotów przedmiotów (białe, barwione rzadkością) -----
  const W2 = 0xffffff;
  tex(scene, 'sl_weapon', 36, 36, (p) => { p.line(8, 28, 26, 10, W2, 5).poly([[26, 10], [32, 4], [30, 12]], W2).line(7, 21, 15, 29, W2, 4).line(5, 31, 9, 27, W2, 4); });
  tex(scene, 'sl_armor', 36, 36, (p) => { p.poly([[6, 8], [14, 5], [22, 5], [30, 8], [28, 18], [24, 31], [12, 31], [8, 18]], W2).poly([[14, 5], [18, 12], [22, 5]], 0x120e24); });
  tex(scene, 'sl_amulet', 36, 36, (p) => { p.path([[9, 4], [14, 14], [18, 17], [22, 14], [27, 4]], W2, 2.5).poly([[18, 17], [25, 24], [18, 33], [11, 24]], W2).circle(18, 25, 2.5, 0x120e24); });
  tex(scene, 'sl_ring', 36, 36, (p) => { p.ring(18, 21, 9, W2, 5).poly([[18, 3], [23, 9], [18, 14], [13, 9]], W2); });
  tex(scene, 'sl_boots', 36, 36, (p) => { p.poly([[10, 5], [20, 5], [20, 18], [31, 23], [31, 30], [8, 30], [8, 21]], W2).line(10, 12, 20, 12, 0x120e24, 2); });
  // ----- podłoże (niska rozdzielczość, subtelne) -----
  tex(scene, 'ground', 128, 128, (p) => {
    p.rect(0, 0, 128, 128, 0x0b0817);
    for (let i = 0; i < 70; i++) p.rect(Phaser.Math.Between(0, 126), Phaser.Math.Between(0, 126), Phaser.Math.Between(1, 3), Phaser.Math.Between(1, 2), 0x15102a, 0.9);
    p.ring(64, 64, 34, 0x130f26, 2).ring(64, 64, 26, 0x110d22, 1);
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; p.line(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34, 0x130f26, 2); }
    p.path([[10, 100], [26, 92], [38, 104]], 0x120e22, 2).path([[96, 20], [108, 30], [122, 22]], 0x120e22, 2);
  }, false);
}

/** obraz z tekstury w skali logicznej (tekstury są 2x) */
export function spr(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setScale(1 / S);
}

/** wszystkie teksty rysowane w rozdzielczości ekranu */
export function patchText(): void {
  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: (this: unknown, ...a: unknown[]) => unknown };
  const orig = proto.text;
  proto.text = function (this: unknown, ...a: unknown[]) {
    const style = (a[3] ?? {}) as Record<string, unknown>;
    return orig.apply(this, [a[0], a[1], a[2], { resolution: S, ...style }]);
  };
}
