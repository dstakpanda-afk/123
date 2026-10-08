import { Stats } from './data';

export interface TreeNode {
  id: string; name: string; kind: 's' | 'n' | 'k' | 'start'; stats: Partial<Stats>;
  x: number; y: number; links: string[]; branch: number; cost: number;
}
type Spec = { name: string; stats: Partial<Stats>; kind: 's' | 'n' | 'k'; id?: string };
const n = (name: string, stats: Partial<Stats>): Spec => ({ name, stats, kind: 's' });
const N = (name: string, stats: Partial<Stats>, id?: string): Spec => ({ name, stats, kind: 'n', id });
const K = (name: string, stats: Partial<Stats>): Spec => ({ name, stats, kind: 'k' });

export const BRANCHES = [
  { name: 'Pustka', color: 0x3fe0c5, angle: 0 },
  { name: 'Głębia', color: 0xa77bff, angle: 90 },
  { name: 'Krew', color: 0xff4d6d, angle: 180 },
  { name: 'Gwiazdy', color: 0xffd36b, angle: 270 },
];
const RING = [1, 2, 3, 3, 3, 2, 1];

// każda gałąź: 15 węzłów, kolejno po pierścieniach 1,2,3,3,3,2,1
const SPECS: Spec[][] = [
  [ // Pustka (Łowca)
    n('Chód cienia', { speed: 0.04 }),
    n('Szybkie szepty', { cdr: 0.03 }), n('Oko w ciemności', { crit: 0.02 }),
    n('Węch padlinożercy', { drop: 0.08 }), N('Grot Pustki', { proj: 1, dmg: 0.05 }, 'k_arrow'), n('Lekkie kroki', { speed: 0.04 }),
    n('Zbieracz Reliktów', { magnet: 0.25 }), N('Rozszczepiony Szept', { proj: 1 }), n('Szczęście Szaleńca', { gold: 0.1 }),
    n('Zimna precyzja', { crit: 0.03 }), N('Mistrz Nicości', { dmg: 0.12, cdr: 0.06 }), n('Poszukiwacz Skarbów', { drop: 0.08 }),
    N('Wiatr Pomiędzy', { speed: 0.1, cdr: 0.05 }), N('Skarbnik Otchłani', { gold: 0.25, drop: 0.15 }),
    K('Rozszczepienie Pustki', { proj: 2, dmg: -0.15 }),
  ],
  [ // Głębia (Strażnik)
    n('Hart ducha', { hp: 10 }),
    n('Powolne gojenie', { regen: 0.3 }), n('Skorupa', { armor: 1 }),
    n('Krwiopijca', { steal: 0.01 }), N('Chitynowy Bastion', { armor: 2, hp: 20 }), N('Dar Głębi', { regen: 0.5, hp: 15 }, 'k_life'),
    n('Twarde ciało', { hp: 25 }), N('Kamienna Skóra', { armor: 3 }), n('Odrost', { regen: 0.5 }),
    N('Krew za Krew', { steal: 0.02, dmg: 0.06 }), N('Twierdza Snu', { hp: 50, armor: 2 }), n('Oddech Głębin', { regen: 0.6 }),
    N('Nieśmiertelny Sługa', { hp: 60, regen: 1 }), N('Pożeracz Głębin', { steal: 0.03, crit: 0.03 }, 'k_deep'),
    K('Pradawny Kolos', { hp: 150, armor: 5, speed: -0.15 }),
  ],
  [ // Krew (Wojownik)
    n('Żar w żyłach', { dmg: 0.05 }),
    n('Brutalny cios', { dmg: 0.06 }), n('Twarda skóra', { hp: 15 }),
    n('Szał ofiarny', { crit: 0.03 }), N('Szlif Sztyletu', { dmg: 0.12, area: 0.08 }, 'k_edge'), n('Pancerz z kości', { armor: 1 }),
    n('Rzeźnik', { critDmg: 0.15 }), N('Szkarłatna Kometa', { dmg: 0.1, cdr: 0.05 }, 'k_comet'), n('Wytrzymałość', { hp: 20 }),
    n('Krwawy szał', { dmg: 0.06 }), N('Arcykapłan Ofiary', { dmg: 0.15, crit: 0.03 }), n('Żelazna wola', { hp: 25 }),
    N('Zabójcza Precyzja', { crit: 0.06, critDmg: 0.25 }), N('Berserker Kultu', { dmg: 0.18, speed: 0.05 }),
    K('Pakt Krwi', { dmg: 0.6, hp: -30 }),
  ],
  [ // Gwiazdy (Mag)
    n('Iskra z nieba', { cdr: 0.03 }),
    n('Zakazana wiedza', { xp: 0.06 }), n('Daleki zasięg', { area: 0.06 }),
    N('Płomień Gwiazdy', { dmg: 0.08, area: 0.08 }, 'k_flame'), n('Mądrość Starych', { xp: 0.08 }), N('Chłód Kosmosu', { cdr: 0.05, area: 0.06 }, 'k_frost'),
    n('Skupienie', { cdr: 0.04 }), N('Burza Gwiazd', { dmg: 0.1, proj: 1 }, 'k_storm'), n('Rozległość', { area: 0.08 }),
    n('Arkana', { dmg: 0.06 }), N('Astrolog', { cdr: 0.08, area: 0.1 }), n('Medytacja', { regen: 0.5 }),
    N('Przepływ Eteru', { cdr: 0.1, xp: 0.1 }), N('Potęga Żywiołów', { dmg: 0.16, area: 0.1 }),
    K('Czarna Gwiazda', { area: 0.4, cdr: 0.15, hp: -20 }),
  ],
];

export const NODES: Record<string, TreeNode> = {};
NODES.start = { id: 'start', name: 'Początek', kind: 'start', stats: {}, x: 0, y: 0, links: [], branch: -1, cost: 0 };
const link = (a: string, b: string) => {
  if (!NODES[a].links.includes(b)) NODES[a].links.push(b);
  if (!NODES[b].links.includes(a)) NODES[b].links.push(a);
};
const ringNodes: string[][][] = [];
SPECS.forEach((specs, b) => {
  const th = (BRANCHES[b].angle * Math.PI) / 180;
  let idx = 0;
  const rings: string[][] = [];
  RING.forEach((cnt, r) => {
    const radius = 70 + r * 62, gap = 58 / radius, ids: string[] = [];
    for (let i = 0; i < cnt; i++) {
      const sp = specs[idx++];
      const id = sp.id ?? `${'lgwm'[b]}${idx}`;
      const a = th + (i - (cnt - 1) / 2) * gap;
      NODES[id] = { id, name: sp.name, kind: sp.kind, stats: sp.stats, x: Math.cos(a) * radius, y: Math.sin(a) * radius, links: [], branch: b, cost: sp.kind === 'k' ? 2 : 1 };
      ids.push(id);
      if (r === 0) link('start', id);
      else {
        const prev = rings[r - 1];
        if (cnt === 1) prev.forEach((p) => link(p, id));
        else link(prev[Math.round((i * (prev.length - 1)) / (cnt - 1))], id);
      }
    }
    rings.push(ids);
  });
  ringNodes.push(rings);
});
// mosty między sąsiednimi gałęziami (pierścień 3)
for (let b = 0; b < 4; b++) {
  const a = ringNodes[b][2], c = ringNodes[(b + 1) % 4][2];
  link(a[a.length - 1], c[0]);
}
export const NODE_LIST = Object.values(NODES);
