import { CLASSES, CLASS_IDS, ClassId, StatKey, Stats } from './data';

export interface TreeNode {
  id: string; name: string; kind: 's' | 'n' | 'k' | 'start'; stats: Partial<Stats>;
  x: number; y: number; links: string[]; sector: number; ring: number; cost: number;
}

/** kolejność sektorów wokół drzewka (sąsiedzi tematycznie pasują) */
export const SECTORS: ClassId[] = ['star', 'dream', 'void', 'deep', 'bone', 'blood'];
export const sectorColor = (s: number): number => CLASSES[SECTORS[s]].color;

const RINGS = 9;
const radius = (k: number) => 100 + k * 86;
const count = (k: number) => Math.max(12, Math.round((2 * Math.PI * radius(k)) / 50 / 6) * 6);

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

export const NODES: Record<string, TreeNode> = {};
export const NODE_LIST: TreeNode[] = [];
export const CLASS_START = {} as Record<ClassId, string>;

const link = (a: string, b: string) => {
  if (a === b) return;
  if (!NODES[a].links.includes(b)) NODES[a].links.push(b);
  if (!NODES[b].links.includes(a)) NODES[b].links.push(a);
};
const roundStat = (k: StatKey, v: number) => (k === 'hp' || k === 'armor' ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000);

(function build() {
  const r = rng(20241);
  NODES.c = { id: 'c', name: 'Serce Otchłani', kind: 's', stats: { dmg: 0.05, hp: 10 }, x: 0, y: 0, links: [], sector: -1, ring: -1, cost: 1 };
  let projLeft = 14, ksIdx = 0;
  const rows: string[][] = [];
  for (let k = 0; k < RINGS; k++) {
    const n = count(k), m = n / 6, row: string[] = [];
    for (let i = 0; i < n; i++) {
      const s = Math.floor(i / m), j = i % m;
      const th = ((-90 + 60 * s - 30 + ((j + 0.5) * 60) / m) * Math.PI) / 180;
      const id = `n${k}_${i}`;
      // temat: wnętrze miesza wszystkie, brzegi sektora sąsiednie
      let theme = s;
      if (k <= 1) theme = Math.floor(r() * 6);
      else if ((j === 0 || j === m - 1) && r() < 0.5) theme = (s + (j === 0 ? 5 : 1)) % 6;
      const cls = SECTORS[theme], scale = 1 + 0.06 * k;
      let kind: 's' | 'n' | 'k' = r() < (k >= 1 ? 0.16 : 0.05) ? 'n' : 's';
      const isKey = (k === 7 && j === Math.floor(m / 2)) || (k === 2 && j === 0);
      if (isKey) kind = 'k';
      let name = '', stats: Partial<Stats> = {};
      if (kind === 'k') {
        const ks = KEYSTONES[ksIdx++ % KEYSTONES.length];
        name = ks.name; stats = { ...ks.stats };
      } else if (kind === 'n') {
        const pool = POOL[cls].slice();
        const picks: StatKey[] = [];
        while (picks.length < 2) {
          const k2 = pool[Math.floor(r() * pool.length)];
          if (k2 === 'proj' && (projLeft <= 0 || k < 3)) continue;
          if (!picks.includes(k2)) picks.push(k2);
        }
        picks.forEach((st, idx) => {
          if (st === 'proj') { stats.proj = 1; projLeft--; }
          else stats[st] = roundStat(st, SMALL[st] * scale * (idx === 0 ? 2.6 : 1.8));
        });
        const lead = picks[0] === 'proj' ? picks[1] : picks[0];
        name = `${ADJ[cls][Math.floor(r() * ADJ[cls].length)]} ${NOUN[lead][Math.floor(r() * NOUN[lead].length)]}`;
      } else {
        let st: StatKey;
        do { st = POOL[cls][Math.floor(r() * POOL[cls].length)]; } while (st === 'proj');
        stats[st] = roundStat(st, SMALL[st] * scale);
        name = SMALL_NAME[st][Math.floor(r() * SMALL_NAME[st].length)];
      }
      NODES[id] = { id, name, kind, stats, x: Math.cos(th) * radius(k), y: Math.sin(th) * radius(k), links: [], sector: s, ring: k, cost: kind === 'k' ? 2 : 1 };
      row.push(id);
    }
    rows.push(row);
  }
  rows.forEach((row, k) => {
    const n = row.length;
    row.forEach((id, i) => {
      if (k === 0) link(id, 'c');
      else {
        const prev = rows[k - 1], idx = Math.floor(((i + 0.5) * prev.length) / n);
        link(id, prev[idx]);
        if (r() < 0.3) link(id, prev[(idx + 1) % prev.length]);
      }
      if (r() < 0.72) link(id, row[(i + 1) % n]);
    });
  });
  // punkty startowe klas: pierścień 4, środek sektora
  const m4 = count(4) / 6;
  SECTORS.forEach((cid, s) => {
    const id = rows[4][s * m4 + Math.floor(m4 / 2)];
    CLASS_START[cid] = id;
    const nd = NODES[id];
    nd.kind = 'start'; nd.name = CLASSES[cid].name; nd.stats = {}; nd.cost = 0;
  });
  NODE_LIST.push(...Object.values(NODES));
})();

export const CLASS_LIST = CLASS_IDS;
