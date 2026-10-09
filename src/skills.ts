import { Arch, Base, MAX_SKILL, Mods, SKILLS, STAT_LABEL, SUPPORTS, SkillId, StatKey, Stats, SupportId, combineMods } from './data';

export type { Base };
const B = (o: Partial<Base>): Base => ({ dmg: 0, cd: 0, count: 1, range: 0, pierce: 0, dur: 0, a: 0, b: 0, ...o });

export function skillBase(id: SkillId, lv: number): Base {
  const gd = SKILLS[id];
  if (gd?.base) return B(gd.base(lv));
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
    default: return B({});
  }
}

/** ile pocisków/celów/skoków po uwzględnieniu dodatkowych */
export function countOf(id: SkillId, b: Base, extra: number, m: Mods): number {
  const ar = SKILLS[id]?.arch;
  if (ar) {
    switch (ar) {
      case 'arc': case 'beam': return 1 + Math.min(extra, 3);
      case 'nova': return 1;
      case 'chain': return b.count + extra + m.pierce;
      case 'ring': case 'cone': case 'home': return b.count + extra * 2;
      case 'totem': return b.count + Math.min(extra, 2);
      default: return b.count + extra;
    }
  }
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
const ARCH_COUNT: Record<Arch, string> = { proj: 'pociski', cone: 'odłamki', beam: 'promienie', nova: 'fale', blast: 'wybuchy', zone: 'strefy', chain: 'skoki', arc: 'cięcia', orbit: 'orby', boom: 'bumerangi', home: 'widma', trap: 'miny', line: 'wybuchy w linii', ring: 'pociski', totem: 'totemy' };
const ARCH_RANGE: Partial<Record<Arch, string>> = { nova: 'Promień fali', blast: 'Promień wybuchu', zone: 'Promień strefy', arc: 'Zasięg cięcia', orbit: 'Promień orbity', boom: 'Zasięg lotu', trap: 'Promień miny', line: 'Promień wybuchu', totem: 'Zasięg totemu' };
const AREA_ARCH: Arch[] = ['nova', 'blast', 'zone', 'arc', 'orbit', 'trap', 'line', 'totem', 'beam'];
const PIERCE_ARCH: Arch[] = ['proj', 'cone', 'ring', 'home', 'chain'];
const archOf = (id: SkillId): Arch | undefined => SKILLS[id]?.arch;
const countLabel = (id: SkillId): string | undefined => COUNT_LABEL[id] ?? (archOf(id) ? ARCH_COUNT[archOf(id) as Arch] : undefined);
const rangeLabel = (id: SkillId): string | undefined => RANGE_LABEL[id] ?? ARCH_RANGE[archOf(id) as Arch];
const isArea = (id: SkillId): boolean => AREA_SKILLS.includes(id) || AREA_ARCH.includes(archOf(id) as Arch);
const isPierce = (id: SkillId): boolean => PIERCE_SKILLS.includes(id) || PIERCE_ARCH.includes(archOf(id) as Arch);

type Cat = 'attack' | 'aura' | 'buff' | 'minion';
const kindOf = (id: SkillId): Cat => SKILLS[id].kind;
const hitKind = (id: SkillId): boolean => (kindOf(id) === 'attack' || kindOf(id) === 'minion' || id === 'heal' || !!SKILLS[id].act) && SKILLS[id].mn !== 'heal';

/** czy dany modyfikator ma jakikolwiek wpływ na ten gem */
export function modApplies(id: SkillId, key: keyof Mods): boolean {
  const k = kindOf(id);
  switch (key) {
    case 'dmg': return true; // siła aur/wzmocnień także skaluje się obrażeniami
    case 'cd': return k !== 'aura';
    case 'area': return isArea(id) || k === 'aura' || k === 'buff' || k === 'minion' && SKILLS[id].mn === 'bomber';
    case 'proj': return (k === 'attack' && id !== 'nova' && archOf(id) !== 'nova') || (k === 'minion' && SKILLS[id].mn !== 'heal');
    case 'pierce': return isPierce(id);
    case 'crit': case 'steal': case 'slow': case 'burn': case 'knock': return hitKind(id) && !(SKILLS[id].act?.t === 'slow');
    case 'echo': return k === 'attack' && id !== 'orbs' && archOf(id) !== 'orbit' && archOf(id) !== 'totem';
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
      case 'proj': t = `+${v} ${countLabel(id) ?? 'celów'}`; break;
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

  const gd = SKILLS[id], ar = gd.arch;
  const PCT_STATS: StatKey[] = ['dmg', 'cdr', 'speed', 'crit', 'critDmg', 'area', 'steal', 'xp', 'magnet', 'gold', 'drop'];
  if (k === 'attack' || (k === 'minion' && gd.mn !== 'heal')) {
    lines.push(['Obrażenia na trafienie', `${f0(hit)}  (krytyk ${f0(crit)})`]);
    const noCd = id === 'orbs' || ar === 'orbit';
    if (!noCd) lines.push([k === 'minion' ? 'Odstęp ataków' : ar === 'totem' ? 'Odnowienie (nowy totem)' : 'Odnowienie', `${f1(cd)} s`]);
    const cl = countLabel(id), rl = rangeLabel(id);
    if (cl) lines.push([id === 'chain' ? 'Skoki pioruna' : ar === 'chain' ? 'Skoki łańcucha' : `Liczba: ${cl}`, f0(cnt)]);
    if (b.range && rl) lines.push([rl, f0(b.range * (isArea(id) ? area : 1))]);
    if (ar === 'beam') lines.push(['Długość / szerokość', `${f0(gd.e?.len ?? 0)} / ${f0((gd.e?.w ?? 0) * area)}`]);
    if (isPierce(id) && id !== 'chain' && id !== 'm_eye' && ar !== 'chain') lines.push(['Przebicie (wrogów)', f0(b.pierce + m.pierce)]);
    if (id === 'rift' || ar === 'zone') lines.push(['Czas trwania strefy', `${f1(b.dur)} s`]);
    if (ar === 'totem') lines.push(['Czas życia / szybkostrzelność', `${f1(b.dur)} s / co ${f1(b.a)} s`]);
    if (id === 'nova') lines.push(['Spowolnienie', `${f1(b.dur + m.slow)} s`]);
    if (gd.fx?.slow) lines.push(['Spowolnienie z gemu', `${f1(gd.fx.slow + m.slow)} s`]);
    const per = id === 'rift' ? (b.dur / b.a) : ar === 'zone' ? (b.dur / b.a) : ar === 'totem' ? (b.dur / b.a) * cnt : id === 'scythe' || ar === 'boom' ? 2 : id === 'blade' || id === 'bolt' || id === 'lance' || id === 'swarm' || ar === 'proj' || ar === 'home' ? cnt : ar === 'cone' ? cnt * 0.6 : ar === 'ring' ? cnt * 0.3 : 1;
    if (!noCd) lines.push(['Szac. DPS na jeden cel', f0(((hit * per * (m.echo ? 1.7 : 1)) / cd) * (k === 'minion' ? cnt : 1))]);
    else lines.push(['Trafienia', `co 0,35 s na wroga (${f0(cnt)} orby)`]);
    lines.push(['Szansa na krytyk', `${f0((st.crit + m.crit + (gd.fx?.crit ?? 0)) * 100)}%`]);
    const burn = m.burn + (gd.fx?.burn ?? 0);
    if (burn) lines.push(['Podpalenie', `${f0(hit * burn)} obrażeń przez 3 s`]);
    if (gd.fx?.steal) lines.push(['Kradzież życia z gemu', `${f0(gd.fx.steal * 100)}%`]);
    if (gd.fx?.knock) lines.push(['Odrzut', 'tak']);
    if (gd.mn === 'bomber') lines.push(['Promień wybuchu', f0(b.range * area)]);
  } else if (k === 'aura' && gd.stats) {
    gd.stats.forEach(([key, field, scale]) => {
      const v = b[field] * scale * power;
      lines.push([STAT_LABEL[key], PCT_STATS.includes(key) ? `+${f1(v * 100)}%` : `+${f1(v)}`]);
    });
    lines.push(['Działa', 'stale, bez odnowienia']);
  } else if (k === 'aura' && gd.act) {
    lines.push(['Promień działania', f0(gd.act.R * area * (1 + st.area))]);
    if (gd.act.t === 'slow') lines.push(['Efekt', 'spowalnia wrogów w promieniu']);
    else lines.push(['Obrażenia na uderzenie', `${f0(b.dmg * (1 + st.dmg) * m.dmg)}  co ${f1(gd.act.tick)} s`]);
    lines.push(['Działa', 'stale, bez odnowienia']);
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
    if (gd.buff === 'crit') lines.push(['Szansa na krytyk', `+${f0(b.a * power)}% przez ${f1(b.dur)} s`]);
    if (gd.buff === 'freeze') { lines.push(['Zamrożenie', `${f1(b.dur * power)} s w promieniu ${f0(b.range * area)}`]); }
    if (gd.buff === 'phase') lines.push(['Nietykalność', `${f1(b.dur * power)} s`]);
    if (gd.buff === 'lifeline') lines.push(['Leczenie', `${f0(b.a * power)}% maks. życia`]);
    if (gd.buff === 'blink') lines.push(['Odskok', 'ok. 110 px od wrogów + 0,4 s nietykalności']);
    if (gd.buff === 'magnet') lines.push(['Przyciąga łup', `z odległości ${f0(b.range * power)}`]);
  } else if (k === 'minion' && gd.mn === 'heal') {
    lines.push(['Okres', `co ${f1(Math.max(0.2, b.cd * cdm))} s`]);
    lines.push(['Leczenie', `${f1(b.a * power)}% maks. życia`]);
  }
  if (k === 'minion' && gd.mn !== 'heal') lines.push(['Siła', `${f0(hit)} obrażeń × ${f0(cnt)} sług`]);

  const slots = sups.length;
  const list = sups.filter((x): x is SupportId => !!x).map((sup) => ({ name: SUPPORTS[sup].name, color: SUPPORTS[sup].color, ...supportText(id, sup) }));
  return { title: def.name, kind: kindNames[k], level: lv, color: def.color, desc: def.desc, lines, supports: list, free: slots - list.length };
}


/** losuje gem do zdobycia: nowe częściej, odpowiednie do poziomu postaci */
export function pickGem(owned: Record<string, number>, level: number): SkillId {
  const ids = Object.keys(SKILLS).filter((id) => (SKILLS[id].lv ?? 1) <= level + 2);
  const fresh = ids.filter((id) => !owned[id]), up = ids.filter((id) => owned[id] > 0 && owned[id] < MAX_SKILL);
  const pool = fresh.length && (Math.random() < 0.6 || !up.length) ? fresh : up.length ? up : ids;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** które mody są "głównym" efektem supportu (gem musi je wykorzystywać, by support miał sens) */
export function supportNeeds(sup: SupportId): (keyof Mods)[] {
  const def = SUPPORTS[sup];
  if (def.needs) return def.needs;
  const keys = (Object.keys(def.mods) as (keyof Mods)[]).filter((k) => k !== 'dmg' && k !== 'cd');
  if (keys.length) return keys;
  return (Object.keys(def.mods) as (keyof Mods)[]).includes('cd') && !def.mods.dmg ? ['cd'] : [];
}
export function supportFits(id: SkillId, sup: SupportId): boolean {
  const need = supportNeeds(sup);
  if (!need.length) return true;
  if (need.length === 1 && need[0] === 'cd') return modApplies(id, 'cd');
  return need.every((k) => modApplies(id, k));
}
const NEED_TEXT: Partial<Record<keyof Mods, string>> = { area: 'obszar działania', proj: 'dodatkowe pociski/cele', pierce: 'przebicie', crit: 'trafienia (krytyk)', steal: 'trafienia (kradzież życia)', slow: 'trafienia (spowolnienie)', burn: 'trafienia (podpalenie)', knock: 'trafienia (odrzut)', echo: 'powtarzanie ataku', cd: 'czas odnowienia' };
/** krótkie wyjaśnienie, dlaczego support nie pasuje */
export function supportWhy(id: SkillId, sup: SupportId): string {
  const bad = supportNeeds(sup).filter((k) => !modApplies(id, k)).map((k) => NEED_TEXT[k] ?? k);
  return bad.length ? `gem nie używa: ${bad.join(', ')}` : '';
}
