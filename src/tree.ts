import { CLASSES, CLASS_IDS, ClassId, StatKey, Stats } from './data';

export interface TreeNode {
  id: string; name: string; kind: 's' | 'n' | 'k' | 'start'; stats: Partial<Stats>;
  x: number; y: number; links: string[]; sector: number; ring: number; cost: number;
}

/** kolejność sektorów wokół drzewka (sąsiedzi tematycznie pasują) */
export const SECTORS: ClassId[] = ['star', 'dream', 'void', 'deep', 'bone', 'blood'];
export const sectorColor = (s: number): number => CLASSES[SECTORS[s]].color;

// deterministyczny generator (ID węzłów muszą być stałe, bo trafiają do zapisu)
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL: Record<ClassId, StatKey[]> = {
  blood: ['dmg', 'dmg', 'critDmg', 'hp', 'steal', 'crit'],
  star: ['cdr', 'cdr', 'area', 'area', 'xp', 'dmg', 'proj'],
  void: ['speed', 'speed', 'crit', 'crit', 'drop', 'gold', 'magnet', 'proj'],
  deep: ['hp', 'hp', 'regen', 'regen', 'armor', 'armor', 'steal'],
  dream: ['speed', 'cdr', 'xp', 'xp', 'magnet', 'area', 'drop'],
  bone: ['armor', 'armor', 'hp', 'dmg', 'dmg', 'regen', 'critDmg'],
};
const SMALL: Record<StatKey, number> = {
  dmg: 0.04, cdr: 0.02, hp: 8, regen: 0.15, speed: 0.02, crit: 0.01, critDmg: 0.08, area: 0.03,
  proj: 0, steal: 0.004, armor: 1, xp: 0.04, magnet: 0.12, gold: 0.06, drop: 0.05,
};
const SMALL_NAME: Record<StatKey, string[]> = {
  dmg: ['Żar w żyłach', 'Brutalny cios', 'Szał ofiarny'], cdr: ['Szybkie szepty', 'Iskra z nieba', 'Skupienie'],
  hp: ['Hart ducha', 'Twarde ciało', 'Wigor'], regen: ['Powolne gojenie', 'Odrost', 'Oddech Głębin'],
  speed: ['Chód cienia', 'Lekkie kroki', 'Szybkie nogi'], crit: ['Oko w ciemności', 'Zimna precyzja', 'Wprawa'],
  critDmg: ['Rzeźnik', 'Dobicie', 'Bezlitosny'], area: ['Daleki zasięg', 'Rozległość', 'Szeroki zamach'],
  proj: ['Rozszczepienie'], steal: ['Krwiopijca', 'Pijawka', 'Głód'], armor: ['Skorupa', 'Pancerz z kości', 'Chityna'],
  xp: ['Zakazana wiedza', 'Ciekawość', 'Mądrość Starych'], magnet: ['Zbieracz Reliktów', 'Chciwe ręce', 'Przyciąganie'],
  gold: ['Szczęście Szaleńca', 'Skarbnik', 'Łup'], drop: ['Węch padlinożercy', 'Poszukiwacz', 'Łowca skarbów'],
};
const ADJ: Record<ClassId, string[]> = {
  blood: ['Szkarłatny', 'Ofiarny', 'Krwawy', 'Dziki'], star: ['Gwiezdny', 'Kosmiczny', 'Astralny', 'Odległy'],
  void: ['Pusty', 'Cichy', 'Zapomniany', 'Mglisty'], deep: ['Pradawny', 'Głęboki', 'Mroczny', 'Zatopiony'],
  dream: ['Senny', 'Mglisty', 'Koszmarny', 'Snujący'], bone: ['Kościany', 'Grobowy', 'Cmentarny', 'Biały'],
};
const NOUN: Record<StatKey, string[]> = {
  dmg: ['Szał', 'Cios', 'Ryt'], cdr: ['Rytm', 'Przepływ', 'Pośpiech'], hp: ['Wigor', 'Hart', 'Kolos'], regen: ['Dar', 'Odrost', 'Oddech'],
  speed: ['Bieg', 'Krok', 'Wiatr'], crit: ['Wzrok', 'Precyzja', 'Instynkt'], critDmg: ['Dobicie', 'Żniwo', 'Wyrok'],
  area: ['Zasięg', 'Fala', 'Rozmach'], proj: ['Szept', 'Rój', 'Chór'], steal: ['Głód', 'Uczta', 'Pragnienie'],
  armor: ['Pancerz', 'Skorupa', 'Bastion'], xp: ['Wiedza', 'Objawienie', 'Wizja'], magnet: ['Zew', 'Uchwyt', 'Pazur'],
  gold: ['Skarb', 'Fortuna', 'Zysk'], drop: ['Węch', 'Trop', 'Szczęście'],
};

const KEYSTONES: { name: string; stats: Partial<Stats> }[] = [
  { name: 'Pakt Krwi', stats: { dmg: 0.6, hp: -30 } },
  { name: 'Czarna Gwiazda', stats: { area: 0.4, cdr: 0.15, hp: -20 } },
  { name: 'Rozszczepienie Pustki', stats: { proj: 2, dmg: -0.15 } },
  { name: 'Pradawny Kolos', stats: { hp: 150, armor: 5, speed: -0.15 } },
  { name: 'Szept Szaleństwa', stats: { crit: 0.25, critDmg: 0.5, dmg: -0.2 } },
  { name: 'Wieczny Sen', stats: { cdr: 0.2, speed: -0.2 } },
  { name: 'Kościany Pancerz', stats: { armor: 8, dmg: -0.15 } },
  { name: 'Krwawa Żyła', stats: { steal: 0.06, hp: -40 } },
  { name: 'Zachłanność', stats: { drop: 0.5, gold: 0.5, dmg: -0.2 } },
  { name: 'Oko Kosmosu', stats: { xp: 0.5, area: 0.2, hp: -30 } },
  { name: 'Nieustanny Bieg', stats: { speed: 0.25, hp: -30 } },
  { name: 'Przeklęta Regeneracja', stats: { regen: 3, hp: -60, dmg: -0.1 } },
];

export const TREE_VERSION = 2;
export const NODES: Record<string, TreeNode> = {};
export const NODE_LIST: TreeNode[] = [];
export const CLASS_START = {} as Record<ClassId, string>;

export const R = (k: number): number => 150 + 88 * (k - 1); // promień pierścienia k = 1..7
export const KR = 790; // pierścień kamieni węgielnych
const STEP = 44; // odstęp węzłów w łańcuchu
const roundStat = (k: StatKey, v: number) => (k === 'hp' || k === 'armor' ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000);
const rad = (deg: number) => (deg * Math.PI) / 180;

(function build() {
  const rt = rng(77031), rs = rng(9137);
  const near = (x: number, y: number, d: number) => Object.values(NODES).some((n) => (n.x - x) ** 2 + (n.y - y) ** 2 < d * d);
  const sectorOf = (deg: number) => (((Math.floor((deg + 120) / 60) % 6) + 6) % 6);
  const add = (id: string, x: number, y: number, ring: number, deg: number): string => {
    NODES[id] = { id, name: '', kind: 's', stats: {}, x, y, links: [], sector: sectorOf(deg), ring, cost: 1 };
    return id;
  };
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!NODES[a].links.includes(b)) NODES[a].links.push(b);
    if (!NODES[b].links.includes(a)) NODES[b].links.push(a);
  };
  const chains: { ids: string[]; nx: (i: number) => [number, number] }[] = [];

  add('c', 0, 0, 0, 0);
  const J: string[][] = [];
  for (let col = 0; col < 12; col++) {
    const deg = -120 + 30 * col; J[col] = [];
    for (let k = 1; k <= 7; k++) J[col][k] = add(`j${col}_${k}`, Math.cos(rad(deg)) * R(k), Math.sin(rad(deg)) * R(k), k, deg);
  }
  const KS: string[] = [];
  for (let col = 0; col < 12; col++) { const deg = -120 + 30 * col; KS[col] = add(`K${col}`, Math.cos(rad(deg)) * KR, Math.sin(rad(deg)) * KR, 8, deg); }

  /** prosty odcinek (szprycha) z węzłami pośrednimi */
  const spoke = (a: string, b: string) => {
    const A = NODES[a], B = NODES[b], len = Math.hypot(B.x - A.x, B.y - A.y), n = Math.max(0, Math.round(len / STEP) - 1);
    const ids: string[] = [a];
    const deg = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1), x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
      ids.push(add(`${a}>${b}:${i}`, x, y, Math.max(0, Math.round((Math.hypot(x, y) - 150) / 88) + 1), (Math.atan2(y, x) * 180) / Math.PI));
    }
    ids.push(b);
    for (let i = 0; i + 1 < ids.length; i++) link(ids[i], ids[i + 1]);
    const tang = (_: number): [number, number] => [-Math.sin(rad(deg)), Math.cos(rad(deg))];
    chains.push({ ids: ids.slice(1, -1), nx: tang });
  };
  /** łuk po pierścieniu k między kolumnami */
  const arc = (k: number, col: number) => {
    const c2 = (col + 1) % 12, a0 = -120 + 30 * col, rr = R(k), len = rad(30) * rr, n = Math.max(0, Math.round(len / STEP) - 1);
    const ids: string[] = [J[col][k]];
    for (let i = 1; i <= n; i++) { const deg = a0 + (30 * i) / (n + 1); ids.push(add(`a${k}_${col}:${i}`, Math.cos(rad(deg)) * rr, Math.sin(rad(deg)) * rr, k, deg)); }
    ids.push(J[c2][k]);
    for (let i = 0; i + 1 < ids.length; i++) link(ids[i], ids[i + 1]);
    chains.push({ ids: ids.slice(1, -1), nx: (i) => { const d = NODES[ids[i + 1]]; const l = Math.hypot(d.x, d.y) || 1; return [d.x / l, d.y / l]; } });
  };

  // szprychy: główne (granice sektorów) pełne, osiowe z przerwami
  for (let col = 0; col < 12; col += 2) {
    spoke('c', J[col][1]);
    for (let k = 1; k < 7; k++) spoke(J[col][k], J[col][k + 1]);
    spoke(J[col][7], KS[col]);
  }
  for (let col = 1; col < 12; col += 2) {
    for (let k = 1; k < 7; k++) if (!(k >= 4 && rt() < 0.2)) spoke(J[col][k], J[col][k + 1]);
    spoke(J[col][7], KS[col]);
  }
  // łuki: wzór co pierścień, żeby powstały duże, różne "komórki"
  const pattern: Record<number, (i: number) => boolean> = {
    1: () => true, 2: (i) => i % 2 === 0, 3: () => true, 4: (i) => i % 4 === 1, 5: (i) => i % 3 === 1, 6: (i) => i % 4 === 3, 7: (i) => i % 6 === 0,
  };
  for (let k = 1; k <= 7; k++) for (let col = 0; col < 12; col++) if (pattern[k](col)) arc(k, col);

  // odnogi: krótkie ślepe uliczki do wnętrza komórki, zakończone węzłem
  const spurs: string[] = [];
  chains.forEach((ch) => ch.ids.forEach((id, i) => {
    const n = NODES[id];
    if (n.ring < 3 || n.ring > 7 || Math.abs(Math.hypot(n.x, n.y) - R(n.ring)) > 1 || rt() > 0.16) return;
    const l = Math.hypot(n.x, n.y), ux = n.x / l, uy = n.y / l;
    const p1: [number, number] = [n.x - ux * 34, n.y - uy * 34], p2: [number, number] = [n.x - ux * 64, n.y - uy * 64];
    if (near(p1[0], p1[1], 28) || near(p2[0], p2[1], 28)) return;
    const deg = (Math.atan2(n.y, n.x) * 180) / Math.PI;
    const s1 = add(`s${id}_1`, p1[0], p1[1], n.ring, deg), s2 = add(`s${id}_2`, p2[0], p2[1], n.ring, deg);
    link(id, s1); link(s1, s2); spurs.push(s2);
  }));

  // klastry: małe pierścienie węzłów wiszące na szprychach, z jednym znaczącym węzłem
  const clusterNotable = new Set<string>();
  const clusterMembers = new Set<string>();
  for (let col = 0; col < 12; col++) for (let k = 4; k <= 7; k++) {
    if (rt() > 0.34) continue;
    const A = NODES[J[col][k]], deg = (Math.atan2(A.y, A.x) * 180) / Math.PI, side = rt() < 0.5 ? 1 : -1;
    const tx = -Math.sin(rad(deg)) * side, ty = Math.cos(rad(deg)) * side, cx = A.x + tx * 62, cy = A.y + ty * 62;
    const pts: [number, number][] = Array.from({ length: 6 }, (_, i) => { const f = Math.atan2(-ty, -tx) + (i * Math.PI) / 3; return [cx + Math.cos(f) * 26, cy + Math.sin(f) * 26]; });
    if (pts.some(([x, y]) => near(x, y, 34))) continue;
    const ids = pts.map(([x, y], i) => add(`g${col}_${k}_${i}`, x, y, k, (Math.atan2(y, x) * 180) / Math.PI));
    ids.forEach((id, i) => link(id, ids[(i + 1) % ids.length]));
    link(J[col][k], ids[0]);
    const far = ids[3]; clusterNotable.add(far); ids.forEach((id) => clusterMembers.add(id));
  }

  // spójność: odcięte wyspy dołączamy do najbliższego węzła głównej sieci
  for (let guard = 0; guard < 30; guard++) {
    const seen = new Set<string>(['c']), q = ['c'];
    while (q.length) { const x = q.pop() as string; NODES[x].links.forEach((y) => { if (!seen.has(y)) { seen.add(y); q.push(y); } }); }
    const lost = Object.keys(NODES).filter((id) => !seen.has(id));
    if (!lost.length) break;
    let best: [string, string] | null = null, bd = 1e12;
    lost.forEach((a2) => seen.forEach((b2) => { const d = (NODES[a2].x - NODES[b2].x) ** 2 + (NODES[a2].y - NODES[b2].y) ** 2; if (d < bd) { bd = d; best = [a2, b2]; } }));
    if (best) link(best[0], best[1]);
  }

  // rodzaje węzłów
  const notable = new Set<string>(clusterNotable);
  chains.forEach((ch) => { let prev = false; ch.ids.forEach((id) => { const is = !prev && rt() < 0.15 && !NODES[id].id.startsWith('s'); if (is) notable.add(id); prev = is; }); });
  spurs.forEach((id) => notable.add(id));
  // satelity: małe węzły wokół części znaczących (klastry)
  const sats: Record<string, string[]> = {};
  chains.forEach((ch) => ch.ids.forEach((id, i) => {
    if (!notable.has(id) || clusterNotable.has(id) || rt() > 0.3) return;
    const n = NODES[id], [nx, ny] = ch.nx(i), tx = -ny, ty = nx;
    const offs: [number, number][] = [[nx * 30 + tx * 22, ny * 30 + ty * 22], [nx * 30 - tx * 22, ny * 30 - ty * 22]];
    sats[id] = [];
    offs.forEach(([dx, dy], j) => {
      const x = n.x + dx, y = n.y + dy;
      if (near(x, y, 26)) return;
      const sid = add(`q${id}_${j}`, x, y, n.ring, (Math.atan2(y, x) * 180) / Math.PI);
      link(id, sid); sats[id].push(sid);
    });
    if (sats[id].length === 2) link(sats[id][0], sats[id][1]);
  }));

  // statystyki, nazwy, koszty
  let ksIdx = 0, projLeft = 14;
  const theme = (n: TreeNode): number => {
    if (n.ring <= 1) return Math.floor(rs() * 6);
    const deg = (Math.atan2(n.y, n.x) * 180) / Math.PI, off = (((deg + 120) % 60) + 60) % 60;
    if ((off < 8 || off > 52) && rs() < 0.5) return (n.sector + (off < 8 ? 5 : 1)) % 6;
    return n.sector;
  };
  Object.values(NODES).forEach((n) => {
    if (n.id === 'c') { n.kind = 'n'; n.name = 'Serce Otchłani'; n.stats = { dmg: 0.08, hp: 15, cdr: 0.04 }; return; }
    const cls = SECTORS[theme(n)], ring = Math.max(0, n.ring), scale = 1 + 0.06 * ring;
    if (n.id.startsWith('K')) {
      const ks = KEYSTONES[ksIdx++ % KEYSTONES.length];
      n.kind = 'k'; n.name = ks.name; n.stats = { ...ks.stats }; n.cost = 2; return;
    }
    n.kind = notable.has(n.id) ? 'n' : 's';
    if (n.kind === 'n') {
      const pool = POOL[cls].slice(), picks: StatKey[] = [];
      while (picks.length < 2) {
        const k2 = pool[Math.floor(rs() * pool.length)];
        if (k2 === 'proj' && (projLeft <= 0 || ring < 3)) continue;
        if (!picks.includes(k2)) picks.push(k2);
      }
      picks.forEach((st, idx) => { if (st === 'proj') { n.stats.proj = 1; projLeft--; } else n.stats[st] = roundStat(st, SMALL[st] * scale * (idx === 0 ? 2.6 : 1.8)); });
      const lead = picks[0] === 'proj' ? picks[1] : picks[0];
      n.name = `${ADJ[cls][Math.floor(rs() * ADJ[cls].length)]} ${NOUN[lead][Math.floor(rs() * NOUN[lead].length)]}`;
    } else {
      let st: StatKey;
      do { st = POOL[cls][Math.floor(rs() * POOL[cls].length)]; } while (st === 'proj');
      n.stats[st] = roundStat(st, SMALL[st] * scale);
      n.name = SMALL_NAME[st][Math.floor(rs() * SMALL_NAME[st].length)];
    }
  });
  // punkty startowe klas: pierścień 3, oś sektora
  SECTORS.forEach((cid, s) => {
    const id = J[2 * s + 1][3];
    CLASS_START[cid] = id;
    const nd = NODES[id];
    nd.kind = 'start'; nd.name = CLASSES[cid].name; nd.stats = {}; nd.cost = 0;
  });
  NODE_LIST.push(...Object.values(NODES));
})();

export const CLASS_LIST = CLASS_IDS;
