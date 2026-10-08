import { Mods, SKILLS, SUPPORTS, SkillId, Stats, SupportId, combineMods } from './data';

/** Parametry bazowe gemów (wspólne dla gry i podsumowania). */
export interface Base { dmg: number; cd: number; count: number; range: number; pierce: number; dur: number; a: number; b: number }
const B = (o: Partial<Base>): Base => ({ dmg: 0, cd: 0, count: 1, range: 0, pierce: 0, dur: 0, a: 0, b: 0, ...o });

export function skillBase(id: SkillId, lv: number): Base {
  const hi3 = lv >= 3 ? 1 : 0, hi5 = lv >= 5 ? 1 : 0, half = Math.floor(lv / 2);
  switch (id) {
    case 'blade': return B({ dmg: 14 + 5 * lv, cd: 1.0 - 0.07 * lv, range: 60 + 7 * lv });
    case 'bolt': return B({ dmg: 10 + 3 * lv, cd: 1.3 - 0.1 * lv, count: 1 + hi3 + hi5, pierce: 1 + (lv >= 4 ? 1 : 0) });
    case 'lance': return B({ dmg: 22 + 8 * lv, cd: 2.0, count: 1 + hi3 + hi5, pierce: 6 });
    case 'scythe': return B({ dmg: 16 + 6 * lv, cd: 3.0, range: 210 });
    case 'swarm': return B({ dmg: 6 + 2.5 * lv, cd: 3.2, count: 3 + lv, pierce: 1 });
    case 'rift': return B({ dmg: 8 + 3 * lv, cd: 5.0, range: 55, dur: 3.5, a: 0.35 });
    case 'nova': return B({ dmg: 18 + 6 * lv, cd: 3.6, range: 90 + 10 * lv, dur: 2.5 });
    case 'chain': return B({ dmg: 16 + 5 * lv, cd: 1.6, count: 3 + lv });
    case 'meteor': return B({ dmg: 40 + 14 * lv, cd: 4.0, range: 70 });
    case 'spikes': return B({ dmg: 20 + 7 * lv, cd: 2.4, count: 3 + half, range: 34 });
    case 'tentacles': return B({ dmg: 15 + 5 * lv, cd: 2.2, count: 2 + half, range: 230 });
    case 'orbs': return B({ dmg: 8 + 3 * lv, count: 1 + half, range: 65, a: 2.6 + 0.15 * lv });
    case 'heal': return B({ dmg: 10 + 5 * lv, cd: 6, range: 80, a: 4 + 2 * lv });
    case 'frenzy': return B({ cd: 11, dur: 4 + 0.4 * lv, a: 25 + 7 * lv, b: 15 + 3 * lv });
    case 'ward': return B({ cd: 12, dur: 6, a: 12 + 5 * lv });
    case 'haste': return B({ cd: 12, dur: 3.5 + 0.3 * lv, a: 25 + 4 * lv });
    case 'a_fury': return B({ a: 6 + 3 * lv });
    case 'a_haste': return B({ a: 3 + 1.5 * lv, b: 2 + lv });
    case 'a_guard': return B({ a: 1 + 0.8 * lv, b: 0.25 + 0.12 * lv });
    case 'a_sight': return B({ a: 2 + 1.2 * lv, b: 3 + 1.5 * lv });
    case 'm_eye': return B({ dmg: 7 + 3 * lv, cd: 1.1, count: 1 + half });
    case 'm_servant': return B({ dmg: 9 + 4 * lv, cd: 0.5, count: 1 + half });
  }
}

/** ile pocisków/celów/skoków po uwzględnieniu dodatkowych */
export function countOf(id: SkillId, b: Base, extra: number, m: Mods): number {
  switch (id) {
    case 'blade': return 1 + Math.min(extra, 3);
    case 'nova': case 'heal': return 1;
    case 'rift': case 'meteor': case 'scythe': return 1 + extra;
    case 'spikes': return b.count + extra * 2;
    case 'chain': return b.count + extra + m.pierce;
    default: return b.count + extra;
  }
}

const COUNT_LABEL: Partial<Record<SkillId, string>> = {
  blade: 'cięcia', bolt: 'pociski', lance: 'włócznie', scythe: 'kosy', swarm: 'widma', rift: 'szczeliny', meteor: 'meteory',
  spikes: 'kolce', tentacles: 'macki', chain: 'skoki pioruna', orbs: 'oczy', m_eye: 'oczy', m_servant: 'słudzy',
};
const RANGE_LABEL: Partial<Record<SkillId, string>> = {
  blade: 'Zasięg cięcia', scythe: 'Zasięg kosy', rift: 'Promień strefy', nova: 'Promień fali', meteor: 'Promień wybuchu',
  spikes: 'Promień kolca', tentacles: 'Zasięg macek', orbs: 'Promień orbity', heal: 'Promień pulsu',
};
const AREA_SKILLS: SkillId[] = ['blade', 'scythe', 'rift', 'nova', 'meteor', 'spikes', 'tentacles', 'orbs', 'heal'];
const PIERCE_SKILLS: SkillId[] = ['bolt', 'lance', 'swarm', 'chain', 'm_eye'];

type Cat = 'attack' | 'aura' | 'buff' | 'minion';
const kindOf = (id: SkillId): Cat => SKILLS[id].kind;
const hitKind = (id: SkillId): boolean => kindOf(id) === 'attack' || kindOf(id) === 'minion' || id === 'heal';

/** czy dany modyfikator ma jakikolwiek wpływ na ten gem */
export function modApplies(id: SkillId, key: keyof Mods): boolean {
  const k = kindOf(id);
  switch (key) {
    case 'dmg': return true; // siła aur/wzmocnień także skaluje się obrażeniami
    case 'cd': return k !== 'aura';
    case 'area': return AREA_SKILLS.includes(id) || k === 'aura' || k === 'buff';
    case 'proj': return (k === 'attack' && id !== 'nova') || k === 'minion';
    case 'pierce': return PIERCE_SKILLS.includes(id);
    case 'crit': case 'steal': case 'slow': case 'burn': case 'knock': return hitKind(id);
    case 'echo': return k === 'attack' && id !== 'orbs';
  }
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const f0 = (v: number) => Math.round(v).toString();

export interface Summary {
  title: string; kind: string; level: number; color: number; desc: string;
  lines: [string, string][];
  supports: { name: string; color: number; text: string; works: boolean }[];
  free: number;
}

function supportText(id: SkillId, sup: SupportId): { text: string; works: boolean } {
  const m = SUPPORTS[sup].mods, parts: string[] = [], dead: string[] = [];
  const k = kindOf(id), power = k === 'aura' || k === 'buff';
  (Object.keys(m) as (keyof Mods)[]).forEach((key) => {
    const v = m[key] as number, ok = modApplies(id, key);
    let t = '';
    switch (key) {
      case 'dmg': t = `${power ? 'siła' : 'obrażenia'} ×${f1(v).replace(',', ',')}`; break;
      case 'cd': t = `${k === 'buff' ? 'okres' : 'odnowienie'} ×${f1(v)}`; break;
      case 'area': t = `${power ? 'siła' : 'obszar'} ×${f1(v)}`; break;
      case 'proj': t = `+${v} ${COUNT_LABEL[id] ?? 'celów'}`; break;
      case 'pierce': t = id === 'chain' ? `+${v} skoki` : `+${v} przebicia`; break;
      case 'crit': t = `+${f0(v * 100)}% szansy na krytyk`; break;
      case 'steal': t = `+${f0(v * 100)}% kradzieży życia`; break;
      case 'slow': t = `spowalnia ${v} s`; break;
      case 'burn': t = `podpala (${f0(v * 100)}%/3 s)`; break;
      case 'knock': t = 'odrzut'; break;
      case 'echo': t = 'powtarza po chwili (70%)'; break;
    }
    (ok ? parts : dead).push(t);
  });
  if (!parts.length) return { text: `nie działa z tym gemem (${dead.join(', ')})`, works: false };
  return { text: parts.join(', ') + (dead.length ? `  [bez efektu: ${dead.join(', ')}]` : ''), works: true };
}

/** podsumowanie gemu z supportami i statystykami postaci */
export function describeSkill(id: SkillId, lv: number, sups: (SupportId | null)[], st: Stats): Summary {
  const def = SKILLS[id], m = combineMods(sups), b = skillBase(id, lv), k = kindOf(id);
  const extra = Math.round(st.proj) + m.proj, area = (1 + st.area) * m.area, cdm = (1 - st.cdr) * m.cd, power = m.dmg * m.area;
  const lines: [string, string][] = [];
  const hit = b.dmg * (1 + st.dmg) * m.dmg, crit = hit * (1 + st.critDmg), cd = Math.max(0.2, b.cd * cdm);
  const cnt = countOf(id, b, extra, m);
  const kindNames = { attack: 'atak', aura: 'aura', buff: 'wzmocnienie', minion: 'sługa' };

  if (k === 'attack' || k === 'minion') {
    lines.push(['Obrażenia na trafienie', `${f0(hit)}  (krytyk ${f0(crit)})`]);
    if (id !== 'orbs') lines.push([k === 'minion' ? 'Odstęp ataków' : 'Odnowienie', `${f1(cd)} s`]);
    if (COUNT_LABEL[id]) lines.push([id === 'chain' ? 'Skoki pioruna' : `Liczba: ${COUNT_LABEL[id]}`, f0(cnt)]);
    if (b.range && RANGE_LABEL[id]) lines.push([RANGE_LABEL[id] as string, f0(b.range * (AREA_SKILLS.includes(id) ? area : 1))]);
    if (PIERCE_SKILLS.includes(id) && id !== 'chain' && id !== 'm_eye') lines.push(['Przebicie (wrogów)', f0(b.pierce + m.pierce)]);
    if (id === 'rift') lines.push(['Czas trwania strefy', `${f1(b.dur)} s`]);
    if (id === 'nova') lines.push(['Spowolnienie', `${f1(b.dur + m.slow)} s`]);
    const per = id === 'rift' ? (b.dur / b.a) : id === 'scythe' ? 2 : id === 'blade' || id === 'bolt' || id === 'lance' || id === 'swarm' ? cnt : 1;
    if (id !== 'orbs') lines.push(['Szac. DPS na jeden cel', f0(((hit * per * (m.echo ? 1.7 : 1)) / cd) * (k === 'minion' ? cnt : 1))]);
    else lines.push(['Trafienia', `co 0,35 s na wroga (${f0(cnt)} oczy)`]);
    lines.push(['Szansa na krytyk', `${f0((st.crit + m.crit) * 100)}%`]);
    if (m.burn) lines.push(['Podpalenie', `${f0(hit * m.burn)} obrażeń przez 3 s`]);
  } else if (k === 'aura') {
    const a = b.a * power, c = b.b * power;
    if (id === 'a_fury') lines.push(['Bonus do obrażeń', `+${f1(a)}%`]);
    if (id === 'a_haste') { lines.push(['Redukcja odnowienia', `+${f1(a)}%`]); lines.push(['Szybkość ruchu', `+${f1(c)}%`]); }
    if (id === 'a_guard') { lines.push(['Pancerz', `+${f1(a)}`]); lines.push(['Regeneracja', `+${f1(c)} /s`]); }
    if (id === 'a_sight') { lines.push(['Szansa na krytyk', `+${f1(a)}%`]); lines.push(['Obszar działania', `+${f1(c)}%`]); }
    lines.push(['Działa', 'stale, bez odnowienia']);
  } else if (k === 'buff') {
    const per = b.cd * cdm;
    lines.push(['Okres', `co ${f1(Math.max(0.2, per))} s`]);
    if (id === 'heal') { lines.push(['Leczenie', `${f1(b.a * power)}% maks. życia`]); lines.push(['Puls obrażeń', `${f0(hit)}  (promień ${f0(b.range * area)})`]); }
    if (id === 'frenzy') { lines.push(['Obrażenia', `+${f0(b.a * power)}% przez ${f1(b.dur)} s`]); lines.push(['Szybkość ruchu', `+${f0(b.b * power)}%`]); }
    if (id === 'ward') { lines.push(['Tarcza', `${f0(b.a * power)}% maks. życia`]); lines.push(['Czas trwania', `${f1(b.dur)} s`]); }
    if (id === 'haste') { lines.push(['Redukcja odnowienia', `+${f0(b.a * power)}% przez ${f1(b.dur)} s`]); }
  }
  if (k === 'minion') lines.push(['Siła', `${f0(hit)} obrażeń × ${f0(cnt)} sług`]);

  const slots = sups.length;
  const list = sups.filter((x): x is SupportId => !!x).map((sup) => ({ name: SUPPORTS[sup].name, color: SUPPORTS[sup].color, ...supportText(id, sup) }));
  return { title: def.name, kind: kindNames[k], level: lv, color: def.color, desc: def.desc, lines, supports: list, free: slots - list.length };
}

