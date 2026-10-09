import Phaser from 'phaser';

/** mapa wyprawy: jaskinia generowana automatem komórkowym, rysowana kawałkami */
export const TILE = 32;
const MS = 1.5; // skala tekstur mapy względem układu logicznego
const CHUNK = 8; // kafelków w jednym kawałku tekstury

export interface Biome { id: string; name: string; floorA: number; floorB: number; wall: number; void: number; rim: number; face: number; accent: number; kind: 'rune' | 'bone' | 'vein' | 'wave' }
export const BIOMES: Biome[] = [
  { id: 'void', name: 'Szepczące Pustkowie', floorA: 0x16112b, floorB: 0x1a1432, wall: 0x2a2250, void: 0x07050f, rim: 0x6f5bc4, face: 0x211a40, accent: 0x8f6bd6, kind: 'rune' },
  { id: 'flesh', name: 'Pulsujące Trzewia', floorA: 0x2a1018, floorB: 0x31131d, wall: 0x4a1a28, void: 0x0d0408, rim: 0xc2415b, face: 0x38141f, accent: 0xd7263d, kind: 'vein' },
  { id: 'bone', name: 'Kościany Labirynt', floorA: 0x211e1c, floorB: 0x282420, wall: 0x45403a, void: 0x0a0908, rim: 0xb9ad98, face: 0x302c27, accent: 0xe8e0c8, kind: 'bone' },
  { id: 'deep', name: 'Zalana Krypta', floorA: 0x0c2028, floorB: 0x0f2831, wall: 0x143a48, void: 0x040d11, rim: 0x3fa6b8, face: 0x0e2c37, accent: 0x4ff0d2, kind: 'wave' },
];

export interface GameMap {
  w: number; h: number; solid: Uint8Array; start: [number, number]; far: [number, number];
  dist: Int16Array; maxDist: number; open: number[]; biome: Biome;
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

export function generateMap(size: number, seed: number): GameMap {
  const w = size, h = size, n = w * h;
  let solid = new Uint8Array(n);
  let attempt = 0;
  for (; attempt < 30; attempt++) {
    const r = rng32(seed + attempt * 7919);
    let g = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x === 0 || y === 0 || x === w - 1 || y === h - 1 || r() < 0.45 ? 1 : 0;
    for (let it = 0; it < 5; it++) {
      const nx = new Uint8Array(n);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let c = 0;
        for (const [dx, dy] of N8) { const ax = x + dx, ay = y + dy; c += ax < 0 || ay < 0 || ax >= w || ay >= h ? 1 : g[ay * w + ax]; }
        nx[y * w + x] = x === 0 || y === 0 || x === w - 1 || y === h - 1 || c >= 5 ? 1 : 0;
      }
      g = nx;
    }
    // poszerzenie wąskich przejść
    const widen: number[] = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!g[i]) continue;
      if ((!g[i - 1] && !g[i + 1]) || (!g[i - w] && !g[i + w])) widen.push(i);
    }
    for (const i of widen) { const x = i % w, y = (i / w) | 0; if (x > 1 && y > 1 && x < w - 2 && y < h - 2) g[i] = 0; }
    // największy spójny obszar
    const lab = new Int32Array(n).fill(-1), sizes: number[] = [];
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
    for (let i = 0; i < n; i++) if (!g[i] && lab[i] !== big) g[i] = 1;
    solid = g;
    if (sizes[big] / n >= 0.4) break;
  }

  // start: otwarty kafelek najbliższy losowemu rogowi
  const r = rng32(seed ^ 0x9e3779b9);
  const corner = [[0.17, 0.83], [0.83, 0.83], [0.17, 0.17], [0.83, 0.17]][Math.floor(r() * 4)];
  const near = (tx: number, ty: number): [number, number] => {
    let best: [number, number] = [w >> 1, h >> 1], bd = 1e9;
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      if (solid[y * w + x]) continue;
      const d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  };
  const carve = (cx: number, cy: number, rad: number) => {
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (x < 2 || y < 2 || x > w - 3 || y > h - 3) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + 1) solid[y * w + x] = 0;
    }
  };
  const start = near(Math.round(corner[0] * w), Math.round(corner[1] * h));
  carve(start[0], start[1], 2);
  const dist = new Int16Array(n);
  bfs(solid, w, h, start[0], start[1], dist);
  let far: [number, number] = start, fd = -1;
  for (let i = 0; i < n; i++) if (dist[i] > fd) { fd = dist[i]; far = [i % w, (i / w) | 0]; }
  carve(far[0], far[1], 3); // arena bossa
  bfs(solid, w, h, start[0], start[1], dist);
  let maxDist = 1;
  const open: number[] = [];
  for (let i = 0; i < n; i++) if (dist[i] >= 0) { open.push(i); if (dist[i] > maxDist) maxDist = dist[i]; }
  return { w, h, solid, start, far, dist, maxDist, open, biome: BIOMES[Math.floor(r() * BIOMES.length)] };
}

/** rysuje mapę w kawałkach; zwraca obiekty i funkcję sprzątającą */
export function buildMapImages(scene: Phaser.Scene, map: GameMap, seed: number): { images: Phaser.GameObjects.Image[]; destroy: () => void } {
  const { w, h, solid, biome: b } = map;
  const T = TILE * MS, px = CHUNK * T;
  const images: Phaser.GameObjects.Image[] = [];
  const keys: string[] = [];
  const isSolid = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || solid[y * w + x] === 1;
  const r = rng32(seed ^ 0x51ed270b);
  for (let cy = 0; cy < h / CHUNK; cy++) for (let cx = 0; cx < w / CHUNK; cx++) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let ty = 0; ty < CHUNK; ty++) for (let tx = 0; tx < CHUNK; tx++) {
      const mx = cx * CHUNK + tx, my = cy * CHUNK + ty, X = tx * T, Y = ty * T;
      if (solid[my * w + mx]) {
        const nearOpen = N8.some(([dx, dy]) => !isSolid(mx + dx, my + dy));
        if (!nearOpen) { g.fillStyle(b.void).fillRect(X, Y, T, T); continue; }
        g.fillStyle(b.wall).fillRect(X, Y, T, T);
        g.fillStyle(0x000000, 0.18).fillRect(X, Y + T * 0.5, T, T * 0.5);
        g.lineStyle(1.5, 0x000000, 0.35).strokeRect(X + 1, Y + 1, T - 2, T - 2);
        if (!isSolid(mx, my - 1)) g.fillStyle(b.rim, 0.9).fillRect(X, Y, T, 3);
        if (!isSolid(mx - 1, my)) g.fillStyle(b.rim, 0.55).fillRect(X, Y, 3, T);
        if (!isSolid(mx + 1, my)) g.fillStyle(b.rim, 0.55).fillRect(X + T - 3, Y, 3, T);
        if (!isSolid(mx, my + 1)) { g.fillStyle(b.face).fillRect(X, Y + T * 0.55, T, T * 0.45); g.fillStyle(b.rim, 0.7).fillRect(X, Y + T - 3, T, 3); g.fillStyle(0x000000, 0.3).fillRect(X, Y + T * 0.55, T, 2); }
        if (r() < 0.35) g.fillStyle(0xffffff, 0.05).fillRect(X + r() * T * 0.6, Y + r() * T * 0.4, T * 0.3, 3);
        continue;
      }
      g.fillStyle(r() < 0.5 ? b.floorA : b.floorB).fillRect(X, Y, T, T);
      if (r() < 0.5) g.fillStyle(0xffffff, 0.025).fillRect(X + r() * T * 0.5, Y + r() * T * 0.5, T * 0.4, T * 0.3);
      // cień przy ścianach
      const sh = (a: number, rx: number, ry: number, rw: number, rh: number) => g.fillStyle(0x000000, a).fillRect(X + rx, Y + ry, rw, rh);
      if (isSolid(mx, my - 1)) { sh(0.42, 0, 0, T, 4); sh(0.2, 0, 4, T, 6); }
      if (isSolid(mx, my + 1)) { sh(0.3, 0, T - 4, T, 4); }
      if (isSolid(mx - 1, my)) { sh(0.3, 0, 0, 4, T); sh(0.14, 4, 0, 6, T); }
      if (isSolid(mx + 1, my)) { sh(0.3, T - 4, 0, 4, T); sh(0.14, T - 10, 0, 6, T); }
      // ozdoby
      const q = r();
      if (q < 0.16) {
        const ox = X + 8 + r() * (T - 16), oy = Y + 8 + r() * (T - 16);
        g.lineStyle(1.6, b.accent, 0.22);
        if (b.kind === 'rune') { g.strokeCircle(ox, oy, 6 + r() * 5); g.lineBetween(ox - 4, oy, ox + 4, oy); g.lineBetween(ox, oy - 4, ox, oy + 4); }
        else if (b.kind === 'vein') { g.beginPath(); g.moveTo(ox - 10, oy); g.lineTo(ox - 2, oy + 5 * (r() - 0.5) * 2); g.lineTo(ox + 5, oy - 4); g.lineTo(ox + 12, oy + 3); g.strokePath(); g.fillStyle(b.accent, 0.18).fillCircle(ox, oy, 2.5); }
        else if (b.kind === 'bone') { g.lineStyle(3, b.accent, 0.22).lineBetween(ox - 7, oy - 3, ox + 7, oy + 3); g.fillStyle(b.accent, 0.22).fillCircle(ox - 7, oy - 3, 2.5).fillCircle(ox + 7, oy + 3, 2.5); }
        else { g.strokeEllipse(ox, oy, 16 + r() * 8, 7); g.strokeEllipse(ox, oy, 8, 3.5); }
      } else if (q < 0.26) {
        g.fillStyle(b.accent, 0.1).fillCircle(X + r() * T, Y + r() * T, 2 + r() * 2.5);
      }
    }
    const key = `map_${cx}_${cy}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    g.generateTexture(key, px, px);
    g.destroy();
    keys.push(key);
    const im = scene.add.image(cx * CHUNK * TILE, cy * CHUNK * TILE, key).setOrigin(0).setScale((px + 1.5) / px / MS).setDepth(0);
    images.push(im);
  }
  return { images, destroy: () => { images.forEach((i) => i.destroy()); keys.forEach((k) => scene.textures.exists(k) && scene.textures.remove(k)); } };
}
