import Phaser from 'phaser';

/** mapa wyprawy: układ (jaskinia / tunele / komnaty) w losowym kształcie, rysowany kawałkami na bieżąco */
export const TILE = 32;
const MS = 1.5; // skala tekstur mapy względem układu logicznego
const CHUNK = 8; // kafelków w jednym kawałku tekstury

export type Layout = 'cave' | 'tunnels' | 'rooms';
export type Deco = 'rune' | 'bone' | 'vein' | 'wave' | 'ash' | 'frost';
export interface Biome {
  id: string; name: string; floorA: number; floorB: number; wall: number; void: number; rim: number; face: number; accent: number;
  kind: Deco; layouts: Layout[];
}
export const BIOMES: Biome[] = [
  { id: 'void', name: 'Szepczące Pustkowie', floorA: 0x16112b, floorB: 0x1a1432, wall: 0x2a2250, void: 0x07050f, rim: 0x6f5bc4, face: 0x211a40, accent: 0x8f6bd6, kind: 'rune', layouts: ['cave', 'tunnels'] },
  { id: 'flesh', name: 'Pulsujące Trzewia', floorA: 0x2a1018, floorB: 0x31131d, wall: 0x4a1a28, void: 0x0d0408, rim: 0xc2415b, face: 0x38141f, accent: 0xd7263d, kind: 'vein', layouts: ['tunnels', 'cave'] },
  { id: 'bone', name: 'Kościany Labirynt', floorA: 0x211e1c, floorB: 0x282420, wall: 0x45403a, void: 0x0a0908, rim: 0xb9ad98, face: 0x302c27, accent: 0xe8e0c8, kind: 'bone', layouts: ['rooms', 'rooms', 'tunnels'] },
  { id: 'deep', name: 'Zalana Krypta', floorA: 0x0c2028, floorB: 0x0f2831, wall: 0x143a48, void: 0x040d11, rim: 0x3fa6b8, face: 0x0e2c37, accent: 0x4ff0d2, kind: 'wave', layouts: ['cave', 'rooms'] },
  { id: 'ash', name: 'Spopielone Pustkowia', floorA: 0x241612, floorB: 0x2b1a14, wall: 0x4a2c20, void: 0x0c0605, rim: 0xe0742e, face: 0x331d15, accent: 0xff8a3d, kind: 'ash', layouts: ['cave', 'rooms'] },
  { id: 'frost', name: 'Mroźna Otchłań', floorA: 0x142230, floorB: 0x182a3a, wall: 0x2c4a63, void: 0x060c13, rim: 0xa9d8f0, face: 0x1d3347, accent: 0xcfeeff, kind: 'frost', layouts: ['rooms', 'cave', 'tunnels'] },
];

export interface GameMap {
  w: number; h: number; solid: Uint8Array; start: [number, number]; far: [number, number];
  dist: Int16Array; maxDist: number; open: number[]; biome: Biome; layout: Layout; shape: string;
}

function rng32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const N8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** odległość w krokach (8 kierunków, bez ścinania rogów) od kafelka (sx,sy); -1 = nieosiągalne */
export function bfs(solid: Uint8Array, w: number, h: number, sx: number, sy: number, out: Int16Array): void {
  out.fill(-1);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || solid[sy * w + sx]) return;
  const q = new Int32Array(w * h);
  let qa = 0, qb = 0;
  q[qb++] = sy * w + sx; out[sy * w + sx] = 0;
  while (qa < qb) {
    const i = q[qa++], x = i % w, y = (i / w) | 0, d = out[i];
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (solid[j] || out[j] >= 0) continue;
      if (dx && dy && (solid[y * w + nx] || solid[ny * w + x])) continue;
      out[j] = d + 1; q[qb++] = j;
    }
  }
}

// ---------- kształty obszaru ----------
const SHAPES = ['rect', 'ellipse', 'cross', 'ell', 'diag', 'blob', 'ring'] as const;
type Shape = typeof SHAPES[number];
function shapeMask(shape: Shape, w: number, h: number, r: () => number): Uint8Array {
  const m = new Uint8Array(w * h), p1 = r() * 6.28, p2 = r() * 6.28, flip = r() < 0.5 ? 1 : -1, q = Math.floor(r() * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1, rr = Math.hypot(u, v), th = Math.atan2(v, u);
    let ok = false;
    switch (shape) {
      case 'rect': ok = Math.abs(u) < 0.96 && Math.abs(v) < 0.96; break;
      case 'ellipse': ok = rr < 1; break;
      case 'cross': ok = Math.abs(u) < 0.5 || Math.abs(v) < 0.5; break;
      case 'ell': ok = !((q & 1 ? u > 0.05 : u < -0.05) && (q & 2 ? v > 0.05 : v < -0.05)); break;
      case 'diag': ok = Math.abs(u - flip * v) < 0.95; break;
      case 'blob': ok = rr < 0.8 + 0.2 * Math.sin(3 * th + p1) + 0.1 * Math.sin(5 * th + p2); break;
      case 'ring': ok = rr < 1 && rr > 0.3; break;
    }
    m[y * w + x] = ok ? 1 : 0;
  }
  return m;
}

function largestRegion(g: Uint8Array, w: number, h: number): number {
  const n = w * h, lab = new Int32Array(n).fill(-1), sizes: number[] = [];
  for (let i = 0; i < n; i++) {
    if (g[i] || lab[i] >= 0) continue;
    const id = sizes.length, st = [i]; lab[i] = id; let cnt = 0;
    while (st.length) {
      const c = st.pop() as number; cnt++;
      const x = c % w;
      for (const j of [c - 1, c + 1, c - w, c + w]) {
        if (j < 0 || j >= n || g[j] || lab[j] >= 0) continue;
        if ((j === c - 1 && x === 0) || (j === c + 1 && x === w - 1)) continue;
        lab[j] = id; st.push(j);
      }
    }
    sizes.push(cnt);
  }
  let big = 0; sizes.forEach((s, i) => { if (s > sizes[big]) big = i; });
  let kept = 0;
  for (let i = 0; i < n; i++) { if (!g[i] && lab[i] !== big) g[i] = 1; else if (!g[i]) kept++; }
  return kept;
}

function carveDisc(g: Uint8Array, w: number, h: number, mask: Uint8Array | null, cx: number, cy: number, rad: number): void {
  for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
    if (x < 2 || y < 2 || x > w - 3 || y > h - 3) continue;
    if (mask && !mask[y * w + x]) continue;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + 1) g[y * w + x] = 0;
  }
}

/** jaskinia: automat komórkowy w obrębie maski */
function layCave(w: number, h: number, mask: Uint8Array, r: () => number): Uint8Array {
  const n = w * h, dens = 0.5 + r() * 0.05;
  let g = new Uint8Array(n);
  for (let i = 0; i < n; i++) g[i] = !mask[i] || r() < dens ? 1 : 0;
  const iters = 3 + Math.floor(r() * 3);
  for (let it = 0; it < iters; it++) {
    const nx = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) { nx[i] = 1; continue; }
      let c = 0;
      for (const [dx, dy] of N8) { const ax = x + dx, ay = y + dy; c += ax < 0 || ay < 0 || ax >= w || ay >= h ? 1 : g[ay * w + ax]; }
      nx[i] = (g[i] ? c >= 4 : c >= 5) ? 1 : 0;
    }
    g = nx;
  }
  return g;
}

/** tunele: kilku „pijaków" drąży szerokie korytarze */
function layTunnels(w: number, h: number, mask: Uint8Array, r: () => number): Uint8Array {
  const n = w * h, g = new Uint8Array(n).fill(1);
  let area = 0; for (let i = 0; i < n; i++) area += mask[i];
  const goal = area * 0.46, walkers = 5 + Math.floor(r() * 4);
  const cells: number[] = []; for (let i = 0; i < n; i++) if (mask[i]) cells.push(i);
  let opened = 0;
  const ws = Array.from({ length: walkers }, () => { const c = cells[Math.floor(r() * cells.length)]; return { x: c % w, y: (c / w) | 0, dx: 1, dy: 0 }; });
  for (let step = 0; step < 60000 && opened < goal; step++) {
    const k = ws[step % walkers];
    if (r() < 0.12) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)]; k.dx = d[0]; k.dy = d[1]; }
    let nx = k.x + k.dx, ny = k.y + k.dy;
    if (nx < 3 || ny < 3 || nx > w - 4 || ny > h - 4 || !mask[ny * w + nx]) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)]; k.dx = d[0]; k.dy = d[1]; continue; }
    k.x = nx; k.y = ny;
    for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
      const i = (ny + oy) * w + nx + ox;
      if (mask[i] && g[i]) { g[i] = 0; opened++; }
    }
  }
  return g;
}

/** komnaty połączone korytarzami */
function layRooms(w: number, h: number, mask: Uint8Array, r: () => number): Uint8Array {
  const n = w * h, g = new Uint8Array(n).fill(1);
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  const fits = (x: number, y: number, rw: number, rh: number) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) if (!mask[yy * w + xx]) return false;
    return true;
  };
  const target = Math.round((w * h) / 48);
  for (let t = 0; t < 600 && rooms.length < target; t++) {
    const rw = 5 + Math.floor(r() * 7), rh = 5 + Math.floor(r() * 7), x = 3 + Math.floor(r() * (w - rw - 6)), y = 3 + Math.floor(r() * (h - rh - 6));
    if (x < 3 || y < 3 || x + rw > w - 3 || y + rh > h - 3 || !fits(x, y, rw, rh)) continue;
    if (rooms.some((o) => x < o.x + o.w + 2 && x + rw + 2 > o.x && y < o.y + o.h + 2 && y + rh + 2 > o.y)) continue;
    rooms.push({ x, y, w: rw, h: rh });
  }
  for (const o of rooms) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) g[y * w + x] = 0;
  const cx = (o: { x: number; w: number }) => Math.floor(o.x + o.w / 2), cy = (o: { y: number; h: number }) => Math.floor(o.y + o.h / 2);
  const corridor = (a: typeof rooms[0], b: typeof rooms[0]) => {
    let x = cx(a), y = cy(a); const tx = cx(b), ty = cy(b);
    const horizFirst = r() < 0.5;
    const dig = (xx: number, yy: number) => { for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) { const i = (yy + oy) * w + xx + ox; if (xx + ox > 1 && yy + oy > 1 && xx + ox < w - 2 && yy + oy < h - 2) g[i] = 0; } };
    const horiz = () => { while (x !== tx) { x += Math.sign(tx - x); dig(x, y); } };
    const vert = () => { while (y !== ty) { y += Math.sign(ty - y); dig(x, y); } };
    if (horizFirst) { horiz(); vert(); } else { vert(); horiz(); }
  };
  if (rooms.length < 2) return g;
  // najbliższy sąsiad dla każdej komnaty + kilka dodatkowych pętli
  const done = [rooms[0]];
  while (done.length < rooms.length) {
    let best: [number, number] = [0, 0], bd = 1e9;
    rooms.forEach((a, i) => { if (done.includes(a)) return; done.forEach((b, j) => { const d = Math.hypot(cx(a) - cx(b), cy(a) - cy(b)); if (d < bd) { bd = d; best = [i, j]; } }); });
    corridor(rooms[best[0]], done[best[1]]); done.push(rooms[best[0]]);
  }
  for (let k = 0; k < Math.floor(rooms.length / 4); k++) corridor(rooms[Math.floor(r() * rooms.length)], rooms[Math.floor(r() * rooms.length)]);
  // zaokrąglone narożniki komnat (kaplice): poszarp kilka krawędzi
  return g;
}

export function generateMap(size: number, seed: number): GameMap {
  const r0 = rng32(seed ^ 0x9e3779b9);
  const biome = BIOMES[Math.floor(r0() * BIOMES.length)];
  const layout = biome.layouts[Math.floor(r0() * biome.layouts.length)];
  const aspect = 0.8 + r0() * 0.45;
  const round8 = (v: number) => Math.max(32, Math.round(v / CHUNK) * CHUNK);
  const w = round8(size * Math.sqrt(aspect)), h = round8(size / Math.sqrt(aspect)), n = w * h;
  const pool: Shape[] = layout === 'rooms' ? ['rect', 'cross', 'ell', 'diag', 'ellipse', 'ring'] : [...SHAPES];
  const shape = pool[Math.floor(r0() * pool.length)];
  let solid: Uint8Array = new Uint8Array(n).fill(1), mask: Uint8Array = new Uint8Array(n), bestKept = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng32(seed + attempt * 7919);
    mask = shapeMask(shape, w, h, r);
    for (let x = 0; x < w; x++) { mask[x] = 0; mask[(h - 1) * w + x] = 0; }
    for (let y = 0; y < h; y++) { mask[y * w] = 0; mask[y * w + w - 1] = 0; }
    let area = 0; for (let i = 0; i < n; i++) area += mask[i];
    let g = layout === 'cave' ? layCave(w, h, mask, r) : layout === 'tunnels' ? layTunnels(w, h, mask, r) : layRooms(w, h, mask, r);
    // poszerzenie wąskich przejść
    const widen: number[] = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (g[i] && mask[i] && ((!g[i - 1] && !g[i + 1]) || (!g[i - w] && !g[i + w]))) widen.push(i);
    }
    for (const i of widen) g[i] = 0;
    const kept = largestRegion(g, w, h);
    if (kept > bestKept) { bestKept = kept; solid = g; }
    if (kept >= area * 0.34 && kept <= area * 0.8) break;
  }

  const r = rng32(seed ^ 0x51ed270b);
  // start: otwarty kafelek najbliższy losowemu rogowi
  const near = (tx: number, ty: number): [number, number] => {
    let best: [number, number] = [w >> 1, h >> 1], bd = 1e9;
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      if (solid[y * w + x]) continue;
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  };
  const corner = [[0.1, 0.9], [0.9, 0.9], [0.1, 0.1], [0.9, 0.1]][Math.floor(r() * 4)];
  const start = near(Math.round(corner[0] * w), Math.round(corner[1] * h));
  carveDisc(solid, w, h, null, start[0], start[1], 2);
  const dist = new Int16Array(n);
  bfs(solid, w, h, start[0], start[1], dist);
  let far: [number, number] = start, fd = -1;
  for (let i = 0; i < n; i++) if (dist[i] > fd) { fd = dist[i]; far = [i % w, (i / w) | 0]; }
  carveDisc(solid, w, h, null, far[0], far[1], 3); // arena bossa
  // filary: pojedyncze kolumny w otwartych przestrzeniach
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
    const i = y * w + x;
    if (solid[i] || r() > 0.03) continue;
    if (Math.hypot(x - start[0], y - start[1]) < 6 || Math.hypot(x - far[0], y - far[1]) < 5) continue;
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (solid[(y + dy) * w + x + dx]) { ok = false; break; }
    if (ok) solid[i] = 1;
  }
  bfs(solid, w, h, start[0], start[1], dist);
  let maxDist = 1;
  const open: number[] = [];
  for (let i = 0; i < n; i++) if (dist[i] >= 0) { open.push(i); if (dist[i] > maxDist) maxDist = dist[i]; }
  return { w, h, solid, start, far, dist, maxDist, open, biome, layout, shape };
}

// ---------- rysowanie na bieżąco ----------
function hash(a: number, b: number, seed: number): number { return (Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ seed) >>> 0; }

export class MapView {
  private chunks = new Map<number, Phaser.GameObjects.Image>();
  private cw: number; private ch: number;
  constructor(private scene: Phaser.Scene, private map: GameMap, private seed: number) {
    this.cw = map.w / CHUNK; this.ch = map.h / CHUNK;
  }

  /** utrzymuje kawałki wokół kamery; zwraca liczbę narysowanych */
  update(camX: number, camY: number, viewW: number, viewH: number, budget = 4): void {
    const span = CHUNK * TILE, pad = span * 0.6;
    const x0 = Math.max(0, Math.floor((camX - pad) / span)), x1 = Math.min(this.cw - 1, Math.floor((camX + viewW + pad) / span));
    const y0 = Math.max(0, Math.floor((camY - pad) / span)), y1 = Math.min(this.ch - 1, Math.floor((camY + viewH + pad) / span));
    let made = 0;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const k = cy * this.cw + cx;
      if (this.chunks.has(k)) continue;
      if (made >= budget) return;
      this.chunks.set(k, this.draw(cx, cy)); made++;
    }
    // usuń dalekie
    for (const [k, im] of this.chunks) {
      const cx = k % this.cw, cy = (k / this.cw) | 0;
      if (cx < x0 - 2 || cx > x1 + 2 || cy < y0 - 2 || cy > y1 + 2) { this.scene.textures.remove(im.texture.key); im.destroy(); this.chunks.delete(k); }
    }
  }

  destroy(): void {
    for (const im of this.chunks.values()) { if (this.scene.textures.exists(im.texture.key)) this.scene.textures.remove(im.texture.key); im.destroy(); }
    this.chunks.clear();
  }

  private draw(cx: number, cy: number): Phaser.GameObjects.Image {
    const { w, h, solid, biome: b } = this.map, sc = this.scene;
    const T = TILE * MS, px = CHUNK * T;
    const isSolid = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || solid[y * w + x] === 1;
    const r = rng32(hash(cx, cy, this.seed));
    const g = sc.make.graphics({ x: 0, y: 0 }, false);
    for (let ty = 0; ty < CHUNK; ty++) for (let tx = 0; tx < CHUNK; tx++) {
      const mx = cx * CHUNK + tx, my = cy * CHUNK + ty, X = tx * T, Y = ty * T;
      if (solid[my * w + mx]) {
        const nearOpen = N8.some(([dx, dy]) => !isSolid(mx + dx, my + dy));
        if (!nearOpen) { g.fillStyle(b.void).fillRect(X, Y, T, T); continue; }
        this.wallTile(g, b, X, Y, T, isSolid(mx, my - 1), isSolid(mx, my + 1), isSolid(mx - 1, my), isSolid(mx + 1, my), r);
        continue;
      }
      g.fillStyle(r() < 0.5 ? b.floorA : b.floorB).fillRect(X, Y, T, T);
      if (r() < 0.5) g.fillStyle(0xffffff, 0.025).fillRect(X + r() * T * 0.5, Y + r() * T * 0.5, T * 0.4, T * 0.3);
      const sh = (a: number, rx: number, ry: number, rw: number, rh: number) => g.fillStyle(0x000000, a).fillRect(X + rx, Y + ry, rw, rh);
      if (isSolid(mx, my - 1)) { sh(0.42, 0, 0, T, 4); sh(0.2, 0, 4, T, 6); }
      if (isSolid(mx, my + 1)) sh(0.3, 0, T - 4, T, 4);
      if (isSolid(mx - 1, my)) { sh(0.3, 0, 0, 4, T); sh(0.14, 4, 0, 6, T); }
      if (isSolid(mx + 1, my)) { sh(0.3, T - 4, 0, 4, T); sh(0.14, T - 10, 0, 6, T); }
      const q = r();
      if (q < 0.2) this.prop(g, b, X + 8 + r() * (T - 16), Y + 8 + r() * (T - 16), r);
      else if (q < 0.3) g.fillStyle(b.accent, 0.1).fillCircle(X + r() * T, Y + r() * T, 2 + r() * 2.5);
    }
    const key = `map_${cx}_${cy}`;
    if (sc.textures.exists(key)) sc.textures.remove(key);
    g.generateTexture(key, px, px);
    g.destroy();
    return sc.add.image(cx * CHUNK * TILE, cy * CHUNK * TILE, key).setOrigin(0).setScale((px + 1.5) / px / MS).setDepth(0);
  }

  private wallTile(g: Phaser.GameObjects.Graphics, b: Biome, X: number, Y: number, T: number, up: boolean, down: boolean, left: boolean, right: boolean, r: () => number): void {
    g.fillStyle(b.wall).fillRect(X, Y, T, T);
    g.fillStyle(0x000000, 0.18).fillRect(X, Y + T * 0.5, T, T * 0.5);
    g.lineStyle(1.5, 0x000000, 0.35).strokeRect(X + 1, Y + 1, T - 2, T - 2);
    if (!up) g.fillStyle(b.rim, 0.9).fillRect(X, Y, T, 3);
    if (!left) g.fillStyle(b.rim, 0.55).fillRect(X, Y, 3, T);
    if (!right) g.fillStyle(b.rim, 0.55).fillRect(X + T - 3, Y, 3, T);
    if (!down) {
      g.fillStyle(b.face).fillRect(X, Y + T * 0.55, T, T * 0.45); g.fillStyle(b.rim, 0.7).fillRect(X, Y + T - 3, T, 3); g.fillStyle(0x000000, 0.3).fillRect(X, Y + T * 0.55, T, 2);
      // ozdoby ścian: pochodnie, narośla, szron
      const q = r();
      if (q < 0.07) { // źródło światła
        const lx = X + T * (0.25 + r() * 0.5), ly = Y + T * 0.8;
        g.fillStyle(b.accent, 0.1).fillCircle(lx, ly, 15).fillStyle(b.accent, 0.18).fillCircle(lx, ly, 9).fillStyle(b.accent, 0.9).fillCircle(lx, ly, 3);
      } else if (q < 0.2) {
        g.lineStyle(2, b.accent, 0.3);
        const lx = X + 6 + r() * (T - 12);
        g.lineBetween(lx, Y + T * 0.6, lx + (r() - 0.5) * 6, Y + T * 0.95);
      }
    }
    if (r() < 0.35) g.fillStyle(0xffffff, 0.05).fillRect(X + r() * T * 0.6, Y + r() * T * 0.4, T * 0.3, 3);
  }

  /** drobne rekwizyty na podłodze zależne od biomu */
  private prop(g: Phaser.GameObjects.Graphics, b: Biome, ox: number, oy: number, r: () => number): void {
    const a = b.accent, k = r();
    g.lineStyle(1.6, a, 0.22);
    switch (b.kind) {
      case 'rune':
        if (k < 0.4) { g.strokeCircle(ox, oy, 6 + r() * 5); g.lineBetween(ox - 4, oy, ox + 4, oy); g.lineBetween(ox, oy - 4, ox, oy + 4); }
        else if (k < 0.75) { g.fillStyle(a, 0.35).fillTriangle(ox, oy - 9, ox - 4, oy + 3, ox + 4, oy + 3).fillStyle(a, 0.2).fillTriangle(ox + 7, oy - 4, ox + 4, oy + 5, ox + 10, oy + 5); }
        else { g.strokeCircle(ox, oy, 12); g.strokeCircle(ox, oy, 6); g.fillStyle(a, 0.3).fillCircle(ox, oy, 2); }
        break;
      case 'vein':
        if (k < 0.45) { g.beginPath(); g.moveTo(ox - 10, oy); g.lineTo(ox - 2, oy + 5 * (r() - 0.5) * 2); g.lineTo(ox + 5, oy - 4); g.lineTo(ox + 12, oy + 3); g.strokePath(); g.fillStyle(a, 0.18).fillCircle(ox, oy, 2.5); }
        else if (k < 0.8) { g.fillStyle(a, 0.16).fillCircle(ox, oy, 9).lineStyle(2, a, 0.35).strokeCircle(ox, oy, 9).fillStyle(a, 0.35).fillCircle(ox - 2, oy - 2, 3); }
        else { g.lineStyle(3, a, 0.25).strokeEllipse(ox, oy, 20, 10); g.lineBetween(ox - 6, oy - 5, ox - 6, oy + 5); g.lineBetween(ox + 6, oy - 5, ox + 6, oy + 5); }
        break;
      case 'bone':
        if (k < 0.4) { g.lineStyle(3, a, 0.24).lineBetween(ox - 7, oy - 3, ox + 7, oy + 3); g.fillStyle(a, 0.24).fillCircle(ox - 7, oy - 3, 2.5).fillCircle(ox + 7, oy + 3, 2.5); }
        else if (k < 0.7) { g.fillStyle(a, 0.22).fillCircle(ox, oy, 7).fillStyle(0x000000, 0.45).fillCircle(ox - 2.5, oy - 1, 1.8).fillCircle(ox + 2.5, oy - 1, 1.8).fillRect(ox - 3, oy + 3, 6, 2); }
        else { g.lineStyle(2.5, a, 0.22); g.strokeEllipse(ox, oy, 22, 14); g.strokeEllipse(ox, oy, 14, 8); g.lineBetween(ox, oy - 8, ox, oy + 8); }
        break;
      case 'wave':
        if (k < 0.45) { g.fillStyle(a, 0.1).fillEllipse(ox, oy, 24, 12).lineStyle(1.6, a, 0.3).strokeEllipse(ox, oy, 24, 12).strokeEllipse(ox, oy, 12, 5); }
        else if (k < 0.8) { g.lineStyle(2, a, 0.3); g.beginPath(); g.moveTo(ox, oy + 8); g.lineTo(ox - 3, oy); g.lineTo(ox + 2, oy - 5); g.lineTo(ox - 1, oy - 10); g.strokePath(); }
        else { g.fillStyle(a, 0.26).fillCircle(ox, oy, 4).lineStyle(1.6, a, 0.3).strokeCircle(ox, oy, 4); g.lineBetween(ox, oy, ox + 5, oy - 5); }
        break;
      case 'ash':
        if (k < 0.45) { g.lineStyle(2, a, 0.4); g.beginPath(); g.moveTo(ox - 11, oy - 3); g.lineTo(ox - 2, oy + 2); g.lineTo(ox + 3, oy - 3); g.lineTo(ox + 12, oy + 4); g.strokePath(); g.lineStyle(5, a, 0.1).strokeCircle(ox, oy, 3); }
        else if (k < 0.75) { g.fillStyle(0x000000, 0.35).fillEllipse(ox, oy, 14, 9).fillStyle(a, 0.5).fillCircle(ox + 1, oy, 1.5); }
        else { g.fillStyle(a, 0.5).fillCircle(ox, oy, 1.8).fillCircle(ox + 6, oy - 4, 1.2).fillCircle(ox - 5, oy + 4, 1.4); }
        break;
      case 'frost':
        if (k < 0.45) { g.lineStyle(1.6, a, 0.35); g.beginPath(); g.moveTo(ox - 10, oy + 2); g.lineTo(ox - 1, oy - 3); g.lineTo(ox + 4, oy + 4); g.lineTo(ox + 12, oy - 1); g.strokePath(); g.lineBetween(ox - 1, oy - 3, ox + 1, oy - 9); }
        else if (k < 0.75) { g.fillStyle(a, 0.12).fillEllipse(ox, oy, 24, 11).fillStyle(a, 0.08).fillEllipse(ox + 3, oy - 2, 12, 5); }
        else { g.fillStyle(a, 0.35).fillTriangle(ox, oy - 10, ox - 3, oy + 3, ox + 3, oy + 3).fillStyle(a, 0.22).fillTriangle(ox + 6, oy - 5, ox + 3, oy + 4, ox + 9, oy + 4); }
        break;
    }
  }
}
