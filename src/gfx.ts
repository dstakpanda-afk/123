import Phaser from 'phaser';
import { CLASS_IDS, CLASSES, ClassId, SKILLS, SKILL_IDS, SkillId } from './data';
import { PALETTE } from './enemies';
import { BIOMES } from './map';

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

const mix = (a: number, b: number, t: number): number => {
  const f = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (f(16) << 16) | (f(8) << 8) | f(0);
};

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
  // ----- wrogowie (po jednym zestawie na biom) -----
  BIOMES.forEach((bm) => {
    const pal = PALETTE[bm.id], c = pal.body, ac = pal.accent, lt = mix(c, 0xffffff, 0.35), dk = mix(c, 0x000000, 0.45), id = bm.id;
    tex(scene, `e_grunt_${id}`, 32, 32, (p) => {
      p.ellipse(16, 27, 22, 7, BLACK, 0.5);
      p.circle(11, 23, 4.5, BLACK).circle(21, 23, 4.5, BLACK).circle(16, 15, 13, BLACK);
      p.circle(11, 22.5, 3.5, c).circle(21, 22.5, 3.5, c).circle(16, 15, 11.5, c).circle(12, 10, 3, lt, 0.6);
      p.ellipse(16, 14, 11, 10, 0xffffff).circle(16, 15, 3.6, BLACK).circle(15, 13.8, 1.1, 0xffffff);
    });
    tex(scene, `e_fast_${id}`, 32, 32, (p) => {
      p.ellipse(16, 27, 18, 6, BLACK, 0.45);
      p.poly(star(16, 15, 14, 6, 6, -Math.PI / 2), c, BLACK, 2.5);
      p.circle(16, 15, 4.5, 0xffffff).circle(16, 15, 2, BLACK);
    });
    tex(scene, `e_spit_${id}`, 36, 36, (p) => {
      p.ellipse(18, 31, 22, 7, BLACK, 0.5);
      p.poly([[18, 2], [31, 24], [5, 24]], BLACK).poly([[18, 5], [28, 23], [8, 23]], c);
      p.ellipse(18, 17, 12, 9, BLACK).circle(14.5, 17, 2.2, ac).circle(21.5, 17, 2.2, ac);
      p.circle(18, 29, 6, BLACK).circle(18, 29, 4.6, ac).circle(16.5, 27.5, 1.6, 0xffffff, 0.8);
    });
    tex(scene, `e_tank_${id}`, 48, 48, (p) => {
      p.ellipse(24, 41, 34, 9, BLACK, 0.5);
      p.circle(24, 22, 20, BLACK).circle(24, 22, 18, c).circle(18, 14, 5, lt, 0.5);
      p.circle(16, 17, 3.4, 0xffe066).circle(32, 17, 3.4, 0xffe066).circle(16, 17.5, 1.4, BLACK).circle(32, 17.5, 1.4, BLACK);
      p.poly([[10, 26], [38, 26], [34, 36], [14, 36]], BLACK);
      [14, 20, 26, 32].forEach((x) => p.poly([[x, 26], [x + 3, 26], [x + 1.5, 31]], 0xffffff));
    });
    tex(scene, `e_caster_${id}`, 40, 44, (p) => {
      p.ellipse(18, 40, 22, 7, BLACK, 0.5);
      p.poly([[18, 6], [32, 38], [4, 38]], BLACK).poly([[18, 9], [29, 36], [7, 36]], c);
      p.circle(18, 14, 7.5, BLACK).circle(18, 14, 6, dk).circle(15.5, 14, 1.8, ac).circle(20.5, 14, 1.8, ac);
      p.line(33, 12, 31, 38, BLACK, 4).line(33, 12, 31, 38, 0x8a6a4a, 2);
      p.circle(33, 9, 6, ac, 0.35).circle(33, 9, 4.5, BLACK).circle(33, 9, 3.4, ac);
    });
    tex(scene, `e_bat_${id}`, 30, 26, (p) => {
      p.ellipse(15, 23, 14, 4, BLACK, 0.4);
      p.poly([[15, 11], [1, 3], [4, 18], [10, 14]], c, BLACK, 1.6).poly([[15, 11], [29, 3], [26, 18], [20, 14]], c, BLACK, 1.6);
      p.circle(15, 13, 6.5, BLACK).circle(15, 13, 5.2, c).circle(13, 12, 1.5, ac).circle(17, 12, 1.5, ac);
      p.poly([[11, 8], [12, 3], [14, 8]], c, BLACK, 1).poly([[16, 8], [18, 3], [19, 8]], c, BLACK, 1);
    });
    tex(scene, `e_bomb_${id}`, 34, 36, (p) => {
      p.ellipse(17, 31, 22, 6, BLACK, 0.5);
      p.circle(17, 20, 13.5, BLACK).circle(17, 20, 12, dk).circle(12, 15, 3.5, lt, 0.35);
      p.path([[9, 17], [14, 21], [12, 26]], ac, 2).path([[22, 14], [20, 20], [25, 24]], ac, 2);
      p.line(17, 8, 21, 3, BLACK, 3).circle(22, 3, 3.2, ac).circle(22, 3, 1.6, 0xffffff);
      p.circle(13, 20, 2, ac).circle(21, 20, 2, ac);
    });
    tex(scene, `e_totem_${id}`, 36, 46, (p) => {
      p.ellipse(18, 42, 28, 7, BLACK, 0.5);
      p.poly([[6, 40], [8, 8], [28, 8], [30, 40]], BLACK).poly([[9, 38], [11, 11], [25, 11], [27, 38]], mix(c, 0x555566, 0.5));
      p.poly([[5, 10], [18, 1], [31, 10]], BLACK).poly([[8, 9], [18, 4], [28, 9]], dk);
      p.ellipse(18, 20, 12, 9, BLACK).circle(18, 20, 4.5, ac).circle(18, 20, 2, BLACK);
      p.line(12, 29, 24, 29, ac, 2).line(14, 34, 22, 34, ac, 2);
    });
    tex(scene, `e_elite_${id}`, 64, 64, (p) => {
      const ec = pal.elite;
      p.ellipse(32, 55, 44, 11, BLACK, 0.5);
      p.poly([[14, 28], [10, 4], [26, 16]], 0xffe066, BLACK, 2).poly([[50, 28], [54, 4], [38, 16]], 0xffe066, BLACK, 2);
      p.circle(32, 33, 25, BLACK).circle(32, 33, 22.5, ec).circle(23, 24, 7, mix(ec, 0xffffff, 0.45), 0.55);
      p.ring(32, 33, 22.5, 0xffffff, 2, 0.9);
      p.ellipse(32, 31, 22, 15, 0xffffff).circle(32, 31, 6.5, 0xd7191c).circle(32, 31, 2.8, BLACK);
      p.poly([[20, 45], [44, 45], [40, 52], [24, 52]], BLACK);
    });
  });
  // ----- bossowie biomów (po jednym, unikalnym) -----
  tex(scene, 'boss_void', 72, 72, (p) => {
    p.ellipse(36, 66, 52, 10, BLACK, 0.5);
    for (let i = 0; i < 6; i++) { const x = 14 + i * 8.8, x2 = x + (i % 2 ? 5 : -5); p.line(x, 48, x2, 67, BLACK, 6).line(x, 48, x2, 67, 0x6b4aa0, 3); }
    p.poly([[16, 18], [18, 1], [28, 11]], 0xe6c9ff, BLACK, 2).poly([[56, 18], [54, 1], [44, 11]], 0xe6c9ff, BLACK, 2).poly([[30, 8], [36, 0], [42, 8]], 0xe6c9ff, BLACK, 2);
    p.circle(36, 36, 29, BLACK).circle(36, 36, 26.5, 0x5a3d9a).circle(26, 25, 9, 0x8f6bd6, 0.5).ring(36, 36, 26.5, 0xe6c9ff, 2, 0.8);
    [[23, 36], [49, 36], [36, 21]].forEach(([x, y]) => { p.ellipse(x, y, 15, 11, 0xffffff).circle(x, y, 5, 0xd7191c).circle(x, y, 2, BLACK); });
    p.poly([[22, 49], [50, 49], [44, 58], [28, 58]], BLACK);
    [26, 32, 38, 44].forEach((x) => p.poly([[x, 49], [x + 3, 49], [x + 1.5, 54]], 0xffffff));
  });
  tex(scene, 'boss_flesh', 72, 72, (p) => {
    p.ellipse(36, 67, 56, 9, BLACK, 0.5);
    [[14, 34, 13], [58, 34, 13], [22, 18, 12], [50, 18, 12], [36, 12, 12]].forEach(([x, y, r]) => p.circle(x, y, r + 2, BLACK));
    p.circle(36, 40, 30, BLACK);
    [[14, 34, 13], [58, 34, 13], [22, 18, 12], [50, 18, 12], [36, 12, 12]].forEach(([x, y, r]) => p.circle(x, y, r, 0xa8283f));
    p.circle(36, 40, 27.5, 0xc23a55).circle(26, 28, 9, 0xff8fa3, 0.4);
    p.path([[8, 34], [16, 40], [14, 50]], 0xff8fa3, 2).path([[64, 34], [56, 42], [58, 52]], 0xff8fa3, 2).path([[36, 14], [32, 24], [38, 30]], 0xff8fa3, 2);
    [[22, 24], [36, 20], [50, 24], [14, 36], [58, 36]].forEach(([x, y]) => { p.circle(x, y, 5, 0xffffff).circle(x, y, 2.4, 0x7a0f1f).circle(x - 0.8, y - 0.8, 0.8, 0xffffff); });
    p.ellipse(36, 52, 30, 16, BLACK);
    [-10, -4, 2, 8].forEach((o) => p.poly([[36 + o, 45], [36 + o + 5, 45], [36 + o + 2.5, 52]], 0xffffff));
    p.ellipse(36, 57, 14, 5, 0x7a0f1f);
  });
  tex(scene, 'boss_bone', 72, 72, (p) => {
    p.ellipse(36, 67, 52, 9, BLACK, 0.5);
    p.ellipse(36, 58, 40, 18, BLACK).ellipse(36, 58, 36, 14, 0xd9d0b8);
    [-12, -4, 4, 12].forEach((o) => p.line(36 + o, 52, 36 + o * 1.3, 64, 0x4a4234, 2));
    p.circle(36, 32, 22, BLACK).circle(36, 32, 19.5, 0xece4cc).circle(28, 24, 6, 0xffffff, 0.35);
    p.circle(28, 32, 6.5, BLACK).circle(44, 32, 6.5, BLACK).circle(28, 32, 2.6, 0xff4d4d).circle(44, 32, 2.6, 0xff4d4d);
    p.poly([[34, 38], [38, 38], [36, 43]], BLACK);
    p.rect(26, 45, 20, 9, BLACK); [28, 32, 36, 40].forEach((x) => p.rect(x, 45, 3, 6, 0xece4cc));
    p.poly([[16, 18], [17, 3], [26, 12], [36, 0], [46, 12], [55, 3], [56, 18]], 0xffd24d, BLACK, 2.2);
    p.circle(36, 8, 2.2, 0xd7191c).circle(21, 12, 1.6, 0x4ff0d2).circle(51, 12, 1.6, 0x4ff0d2);
  });
  tex(scene, 'boss_deep', 72, 72, (p) => {
    p.ellipse(36, 67, 56, 9, BLACK, 0.5);
    [[10, 44, 4, 66], [22, 50, 18, 69], [36, 52, 36, 70], [50, 50, 54, 69], [62, 44, 68, 66]].forEach(([a, b, c, d]) => { p.line(a, b, c, d, BLACK, 8).line(a, b, c, d, 0x22857d, 5); });
    p.poly([[8, 28], [0, 14], [18, 22]], 0x22857d, BLACK, 2).poly([[64, 28], [72, 14], [54, 22]], 0x22857d, BLACK, 2);
    p.ellipse(36, 32, 60, 46, BLACK).ellipse(36, 32, 56, 42, 0x2fa59a).ellipse(30, 20, 26, 12, 0x6fe0d2, 0.35);
    [[16, 36], [56, 36], [24, 46], [48, 46]].forEach(([x, y]) => p.circle(x, y, 2.5, 0x1a6f68));
    p.circle(36, 28, 14, BLACK).circle(36, 28, 12.5, 0xffffff).ellipse(36, 28, 9, 20, 0xffd24d).ellipse(36, 28, 3.6, 17, BLACK);
    for (let i = 0; i < 9; i++) p.poly([[14 + i * 5.5, 47], [18 + i * 5.5, 47], [16 + i * 5.5, 53]], 0xffffff);
  });
  tex(scene, 'boss_ash', 72, 72, (p) => {
    p.ellipse(36, 67, 54, 10, BLACK, 0.5);
    p.poly([[12, 30], [2, 4], [26, 20]], 0x2a1a14, BLACK, 2.2).poly([[60, 30], [70, 4], [46, 20]], 0x2a1a14, BLACK, 2.2);
    p.poly([[18, 16], [22, 4], [28, 14], [36, 0], [44, 14], [50, 4], [54, 16]], 0xff8a3d, BLACK, 2);
    p.circle(36, 42, 28, BLACK).circle(36, 42, 25.5, 0x3a2018).circle(26, 32, 8, 0x6a3a28, 0.5);
    p.path([[16, 52], [22, 44], [20, 36]], 0xff8a3d, 2.6).path([[56, 52], [50, 44], [54, 34]], 0xff8a3d, 2.6).path([[36, 56], [32, 48], [38, 44]], 0xff8a3d, 2.6);
    p.poly([[18, 32], [32, 36], [18, 40]], 0xffd36b, BLACK, 1.5).poly([[54, 32], [40, 36], [54, 40]], 0xffd36b, BLACK, 1.5);
    p.ellipse(36, 54, 24, 11, BLACK).ellipse(36, 55, 18, 6, 0xff8a3d);
    p.poly([[6, 50], [-1, 40], [12, 44]], 0x2a1a14, BLACK, 1.5).poly([[66, 50], [73, 40], [60, 44]], 0x2a1a14, BLACK, 1.5);
  });
  tex(scene, 'boss_frost', 72, 72, (p) => {
    p.ellipse(36, 67, 50, 9, BLACK, 0.5);
    p.poly([[36, 18], [66, 66], [6, 66]], BLACK).poly([[36, 21], [61, 64], [11, 64]], 0x2d5f94);
    p.poly([[36, 30], [52, 64], [20, 64]], 0x1b3f66, undefined);
    p.circle(36, 26, 17, BLACK).circle(36, 26, 15, 0x1b3f66).ellipse(36, 28, 17, 13, 0x0a1a2e);
    p.circle(30, 28, 2.8, 0xcfeeff).circle(42, 28, 2.8, 0xcfeeff);
    [[18, 14, 14, 0, 24, 8], [26, 10, 30, -4, 34, 8], [38, 8, 42, -4, 46, 10], [48, 10, 56, 0, 54, 16]].forEach(([a, b, c, d, e, f]) => p.poly([[a, b], [c, d], [e, f]], 0xcfeeff, BLACK, 1.6));
    p.circle(62, 44, 9, 0xcfeeff, 0.3).circle(62, 44, 6.5, BLACK).circle(62, 44, 5, 0xcfeeff).circle(60.5, 42.5, 1.6, 0xffffff);
    p.line(62, 50, 58, 68, BLACK, 4).line(62, 50, 58, 68, 0x8fb8d8, 2);
    p.poly([[8, 40], [3, 30], [13, 36]], 0xcfeeff, BLACK, 1.4).poly([[12, 56], [4, 52], [14, 48]], 0xcfeeff, BLACK, 1.4);
  });
  tex(scene, 'eshot', 18, 18, (p) => { p.circle(9, 9, 8.5, 0xff3b6b, 0.35).circle(9, 9, 6, BLACK).circle(9, 9, 4.8, 0xff6b81).circle(9, 9, 2.2, 0xffffff); });
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
