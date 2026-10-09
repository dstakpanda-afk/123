import type { Arch, Eng, Mods, SkillDef } from './data';

/** krótki zapis parametrów bazowych: d obrażenia, dl +na poziom, c odnowienie, cl -na poziom, n liczba, ns co ile poziomów +1, r zasięg, rl +na poziom, p przebicie, t czas, a pomocniczy */
interface Q { d: number; dl: number; c: number; cl?: number; n?: number; ns?: number; r?: number; rl?: number; p?: number; t?: number; a?: number }
const base = (q: Q) => (lv: number) => ({
  dmg: q.d + q.dl * lv, cd: Math.max(0.3, q.c - (q.cl ?? 0) * lv), count: (q.n ?? 1) + (q.ns ? Math.floor(lv / q.ns) : 0),
  range: (q.r ?? 0) + (q.rl ?? 0) * lv, pierce: q.p ?? 0, dur: q.t ?? 0, a: q.a ?? 0,
});
const A = (name: string, desc: string, color: number, arch: Arch, lv: number, q: Q, e: Eng = {}, fx: Partial<Mods> = {}): SkillDef =>
  ({ kind: 'attack', name, desc, color, lv, arch, base: base(q), e, fx });

export const EXTRA_GEMS: Record<string, SkillDef> = {
  // ---------- pociski ----------
  ember_bolt: A('Żar Pustki', 'Ognisty pocisk podpala trafionych', 0xff7a3d, 'proj', 1, { d: 12, dl: 3.5, c: 1.2, cl: 0.06, n: 1, ns: 4 }, { spd: 300, life: 1.4, tex: 'bolt' }, { burn: 0.5 }),
  frost_shard: A('Odłamek Mrozu', 'Lodowy pocisk spowalnia i przebija wroga', 0x9fd8ff, 'proj', 1, { d: 11, dl: 3, c: 1.1, cl: 0.05, n: 1, ns: 3, p: 1 }, { spd: 320, life: 1.4, tex: 'bolt' }, { slow: 1.5 }),
  venom_dart: A('Trujący Kolec', 'Szybkie kolce z trucizną, podpalają obrażeniami w czasie', 0x9be34a, 'proj', 3, { d: 6, dl: 2, c: 0.55, cl: 0.02, n: 1, ns: 5 }, { spd: 400, life: 1.1, tex: 'lance', sz: 0.7 }, { burn: 0.8 }),
  void_orb: A('Kula Otchłani', 'Wolna, potężna kula przebija całe szeregi', 0x7a4fd6, 'proj', 8, { d: 30, dl: 9, c: 2.4, cl: 0.1, p: 3 }, { spd: 140, life: 3, tex: 'orb', sz: 1.6 }),
  ghost_arrow: A('Strzała Widma', 'Przenika wrogów i często kryje', 0xcfeaff, 'proj', 8, { d: 19, dl: 5.5, c: 1.2, cl: 0.05, n: 1, ns: 4, p: 3 }, { spd: 430, life: 1.2, tex: 'lance', sz: 0.8 }, { crit: 0.15 }),
  blood_dart: A('Krwawy Pocisk', 'Pocisk kradnie życie', 0xd7263d, 'proj', 5, { d: 13, dl: 4, c: 0.9, cl: 0.04, n: 1, ns: 4 }, { spd: 330, life: 1.3, tex: 'bolt' }, { steal: 0.03 }),
  storm_bolt: A('Błyskawica Kulista', 'Szybki grom z szansą na krytyk', 0xf7e56b, 'proj', 12, { d: 20, dl: 6, c: 1.5, cl: 0.06, n: 1, ns: 3, p: 2 }, { spd: 380, life: 1.2, tex: 'lance' }, { crit: 0.1 }),
  // ---------- stożki ----------
  thorn_burst: A('Grad Cierni', 'Wachlarz cierni z bliska', 0xb0e070, 'cone', 2, { d: 6, dl: 2, c: 1.4, cl: 0.06, n: 5, ns: 2 }, { spread: 0.7, spd: 340, life: 0.45, tex: 'lance', sz: 0.55 }),
  flame_breath: A('Ognisty Oddech', 'Strumień płomieni podpala', 0xff9a4d, 'cone', 10, { d: 5, dl: 1.8, c: 0.9, cl: 0.03, n: 6, ns: 3 }, { spread: 0.6, spd: 280, life: 0.4, tex: 'wisp', sz: 0.9 }, { burn: 0.6 }),
  bone_shards: A('Kościany Szrapnel', 'Odłamki kości odpychają wrogów', 0xe8dcc0, 'cone', 6, { d: 8, dl: 2.6, c: 1.8, cl: 0.07, n: 6, ns: 2 }, { spread: 0.9, spd: 320, life: 0.5, tex: 'lance', sz: 0.5 }, { knock: 1 }),
  // ---------- promienie ----------
  void_ray: A('Promień Pustki', 'Natychmiastowa linia obrażeń', 0xb58cff, 'beam', 6, { d: 30, dl: 9, c: 2, cl: 0.08 }, { len: 380, w: 16 }),
  ice_ray: A('Lodowy Promień', 'Linia mrozu spowalnia wszystkich na drodze', 0x8fd3ff, 'beam', 9, { d: 22, dl: 7.5, c: 1.7, cl: 0.07 }, { len: 340, w: 16 }, { slow: 2 }),
  sun_beam: A('Słoneczny Wyrok', 'Szeroki, miażdżący promień', 0xffe066, 'beam', 18, { d: 60, dl: 18, c: 4.2, cl: 0.15 }, { len: 420, w: 34 }),
  death_ray: A('Żniwo Dusz', 'Promień wysysa życie z trafionych', 0xff5470, 'beam', 14, { d: 26, dl: 8.5, c: 1.8, cl: 0.07 }, { len: 320, w: 14 }, { steal: 0.05 }),
  // ---------- fale ----------
  frost_nova: A('Mroźna Fala', 'Pierścień mrozu dookoła ciebie', 0x9fd8ff, 'nova', 3, { d: 14, dl: 5, c: 3.2, cl: 0.12, r: 100, rl: 8 }, {}, { slow: 2.5 }),
  blaze_nova: A('Wybuch Żaru', 'Eksplozja ognia podpala wszystko wokół', 0xff7a3d, 'nova', 7, { d: 16, dl: 5.5, c: 3, cl: 0.12, r: 95, rl: 8 }, {}, { burn: 0.6 }),
  shock_nova: A('Wyładowanie', 'Błyskawiczna fala z wysoką szansą na krytyk', 0xf7e56b, 'nova', 11, { d: 20, dl: 6, c: 2.6, cl: 0.1, r: 80, rl: 7 }, {}, { crit: 0.2 }),
  bone_nova: A('Kościany Pierścień', 'Fala kości odrzuca wrogów', 0xe8dcc0, 'nova', 4, { d: 15, dl: 5, c: 3.4, cl: 0.12, r: 110, rl: 8 }, {}, { knock: 1 }),
  // ---------- wybuchy z opóźnieniem ----------
  inferno: A('Piekielny Słup', 'Słupy ognia z opóźnieniem pod wrogami', 0xff5a2a, 'blast', 8, { d: 38, dl: 12, c: 3.8, cl: 0.15, n: 2, ns: 4, r: 62, rl: 2 }, { delay: 0.8 }, { burn: 0.5 }),
  ice_comet: A('Lodowa Kometa', 'Kometa uderza i spowalnia', 0xaee4ff, 'blast', 6, { d: 32, dl: 10, c: 3.4, cl: 0.13, n: 1, ns: 3, r: 70, rl: 3 }, { delay: 0.6 }, { slow: 2 }),
  void_rain: A('Deszcz Otchłani', 'Wiele małych, szybkich eksplozji', 0x9b6bff, 'blast', 12, { d: 11, dl: 3.5, c: 2.4, cl: 0.1, n: 5, ns: 2, r: 34, rl: 1 }, { delay: 0.5 }),
  star_nail: A('Gwiezdny Gwóźdź', 'Pojedyncze, potężne uderzenie z krytykiem', 0xfff2a8, 'blast', 16, { d: 70, dl: 22, c: 4.5, cl: 0.17, n: 1, ns: 5, r: 42 }, { delay: 0.9 }, { crit: 0.25 }),
  blood_rain: A('Krwawa Ulewa', 'Krwawe kule leczą po trafieniu', 0xc0314f, 'blast', 10, { d: 15, dl: 5, c: 3, cl: 0.12, n: 4, ns: 3, r: 40 }, { delay: 0.5 }, { steal: 0.04 }),
  // ---------- strefy ----------
  poison_pool: A('Kałuża Trucizny', 'Strefa trucizny rani wrogów w środku', 0x8bd44a, 'zone', 4, { d: 4, dl: 1.4, c: 4.5, cl: 0.15, n: 1, ns: 4, r: 52, rl: 2, t: 4, a: 0.4 }, {}, { burn: 0.5 }),
  frost_field: A('Pole Szronu', 'Strefa mrozu spowalnia i rani', 0x9fd8ff, 'zone', 7, { d: 5, dl: 1.7, c: 4.5, cl: 0.15, r: 60, rl: 2, t: 4, a: 0.45 }, {}, { slow: 1.5 }),
  blaze_field: A('Morze Ognia', 'Płonąca strefa z podpaleniem', 0xff7a3d, 'zone', 13, { d: 6, dl: 2, c: 5, cl: 0.17, n: 1, ns: 4, r: 58, rl: 2, t: 3.5, a: 0.35 }, {}, { burn: 0.5 }),
  // ---------- łańcuchy ----------
  shadow_chain: A('Łańcuch Cieni', 'Cień skacze między wrogami', 0xa77bff, 'chain', 5, { d: 14, dl: 4.5, c: 1.5, cl: 0.06, n: 4, ns: 2 }),
  frost_chain: A('Mroźny Łańcuch', 'Lodowy łańcuch spowalnia trafionych', 0xaee4ff, 'chain', 9, { d: 12, dl: 4, c: 1.6, cl: 0.06, n: 3, ns: 2 }, {}, { slow: 1.5 }),
  fire_chain: A('Płonący Łańcuch', 'Ognisty łańcuch podpala', 0xff8a3d, 'chain', 12, { d: 12, dl: 4.2, c: 1.7, cl: 0.07, n: 3, ns: 2 }, {}, { burn: 0.5 }),
  // ---------- ciosy ----------
  cleave: A('Rozpłatanie', 'Szeroki, ciężki cios', 0xff6b3d, 'arc', 2, { d: 24, dl: 7, c: 1.5, cl: 0.06, r: 70, rl: 5 }, { arc: 2.2 }),
  whirl: A('Wir Ostrzy', 'Obrót z ciosem dookoła', 0xe0e0ff, 'arc', 5, { d: 14, dl: 4.5, c: 1.3, cl: 0.05, r: 78, rl: 5 }, { arc: 6.28 }),
  thrust: A('Pchnięcie Cienia', 'Długie, wąskie pchnięcie z odrzutem', 0x7a6bff, 'arc', 9, { d: 30, dl: 9, c: 1.2, cl: 0.05, r: 105, rl: 6 }, { arc: 0.7 }, { knock: 1 }),
  frost_slash: A('Lodowe Cięcie', 'Cios mrozem spowalnia', 0x8fd3ff, 'arc', 7, { d: 20, dl: 6, c: 1.2, cl: 0.05, r: 75, rl: 5 }, { arc: 1.8 }, { slow: 1.5 }),
  // ---------- orbity ----------
  fire_orbs: A('Płonące Oczy', 'Ogniste oczy krążą i podpalają', 0xff7a3d, 'orbit', 6, { d: 7, dl: 2.6, c: 0, n: 2, ns: 3, r: 60, rl: 1, a: 3 }, {}, { burn: 0.4 }),
  blade_orbit: A('Wirujące Ostrza', 'Ostrza obiegają cię w szerokim kręgu', 0xdfe6ff, 'orbit', 14, { d: 10, dl: 3.4, c: 0, n: 3, ns: 3, r: 75, rl: 2, a: 3.6 }),
  // ---------- bumerangi ----------
  chakram: A('Czakram Gwiazd', 'Okrąg tnie w obie strony', 0xffd36b, 'boom', 7, { d: 22, dl: 7, c: 2.6, cl: 0.1, n: 1, ns: 4, r: 230, rl: 6 }),
  bone_boom: A('Kościany Bumerang', 'Dwa bumerangi z odrzutem', 0xe8dcc0, 'boom', 3, { d: 22, dl: 7, c: 2, cl: 0.08, n: 2, ns: 4, r: 180, rl: 5 }, {}, { knock: 1 }),
  // ---------- naprowadzane ----------
  spirits: A('Duchy Zemsty', 'Naprowadzane duchy leczą cię z trafień', 0xcfeaff, 'home', 5, { d: 6, dl: 2.2, c: 2.8, cl: 0.1, n: 4, ns: 2, p: 1 }, { spd: 230 }, { steal: 0.03 }),
  fire_wisps: A('Ogniste Widma', 'Płonące widma ścigają wrogów', 0xff9a4d, 'home', 10, { d: 7, dl: 2.4, c: 3, cl: 0.1, n: 3, ns: 2, p: 1 }, { spd: 240 }, { burn: 0.5 }),
  // ---------- pułapki ----------
  mine: A('Mina Otchłani', 'Kładziesz minę; wybucha, gdy wróg podejdzie', 0xff6b81, 'trap', 4, { d: 40, dl: 13, c: 3, cl: 0.1, n: 1, ns: 4, r: 62, rl: 2 }, { delay: 0.4, life: 14 }),
  frost_trap: A('Pułapka Szronu', 'Pułapka zamraża obszar', 0x9fd8ff, 'trap', 8, { d: 28, dl: 9, c: 3.4, cl: 0.12, n: 1, ns: 4, r: 70, rl: 2 }, { delay: 0.4, life: 14 }, { slow: 2.5 }),
  spike_trap: A('Kolczasta Pułapka', 'Trzy małe pułapki naraz', 0xe8dcc0, 'trap', 13, { d: 22, dl: 7, c: 3.8, cl: 0.13, n: 3, ns: 3, r: 46, rl: 1 }, { delay: 0.4, life: 14 }),
  // ---------- linie ----------
  fissure: A('Szczelina Ziemi', 'Pęknięcie biegnie przed siebie', 0xd18b4d, 'line', 6, { d: 22, dl: 7, c: 2.8, cl: 0.1, n: 6, ns: 3, r: 34 }, { w: 40, delay: 0.12 }),
  fire_wall: A('Ściana Płomieni', 'Linia ognia podpala wrogów', 0xff5a2a, 'line', 11, { d: 14, dl: 4.5, c: 3.4, cl: 0.12, n: 7, ns: 3, r: 30 }, { w: 32, delay: 0.1 }, { burn: 0.6 }),
  ice_trail: A('Lodowy Szlak', 'Lodowe kolce na ścieżce spowalniają', 0xaee4ff, 'line', 9, { d: 22, dl: 7, c: 2.8, cl: 0.1, n: 6, ns: 3, r: 32 }, { w: 36, delay: 0.1 }, { slow: 2 }),
  // ---------- salwy dookoła ----------
  star_burst: A('Gwiezdny Wybuch', 'Pociski lecą we wszystkie strony', 0xfff2a8, 'ring', 5, { d: 12, dl: 4, c: 2.6, cl: 0.1, n: 10, ns: 2, p: 1 }, { spd: 260, life: 0.9, tex: 'bolt', sz: 0.8 }),
  bone_rain: A('Kościany Wir', 'Odłamki kości odpychają wrogów dookoła', 0xe8dcc0, 'ring', 9, { d: 9, dl: 3, c: 2.1, cl: 0.08, n: 12, ns: 2 }, { spd: 220, life: 1, tex: 'lance', sz: 0.5 }, { knock: 1 }),
  void_echo: A('Echo Otchłani', 'Powolne pociski spowalniają i przebijają', 0x9b6bff, 'ring', 15, { d: 15, dl: 5, c: 3, cl: 0.11, n: 8, ns: 2, p: 2 }, { spd: 180, life: 1.6, tex: 'orb', sz: 0.7 }, { slow: 1.5 }),
  // ---------- totemy ----------
  flame_totem: A('Totem Żaru', 'Totem ciska ogniem w pobliskich wrogów', 0xff7a3d, 'totem', 8, { d: 10, dl: 3.5, c: 9, cl: 0.3, n: 1, ns: 5, r: 230, t: 8, a: 0.8 }, {}, { burn: 0.4 }),
  frost_totem: A('Totem Szronu', 'Totem rani i spowalnia w zasięgu', 0x9fd8ff, 'totem', 11, { d: 11, dl: 3.8, c: 9, cl: 0.3, n: 1, ns: 5, r: 220, t: 8, a: 0.9 }, {}, { slow: 1.5 }),

  // ================= AURY =================
  a_vamp: { kind: 'aura', name: 'Aura Krwiopijcy', desc: 'Stała kradzież życia z trafień', color: 0xe63946, lv: 4, stats: [['steal', 'a', 0.01]], base: (lv) => ({ a: 1.2 + 0.7 * lv }) },
  a_greed: { kind: 'aura', name: 'Aura Chciwości', desc: 'Więcej złota i łupu', color: 0xffd24d, lv: 3, stats: [['gold', 'a', 0.01], ['drop', 'b', 0.01]], base: (lv) => ({ a: 6 + 3 * lv, b: 4 + 2 * lv }) },
  a_ferocity: { kind: 'aura', name: 'Aura Wściekłości', desc: 'Silniejsze trafienia krytyczne', color: 0xff6b3d, lv: 6, stats: [['critDmg', 'a', 0.01]], base: (lv) => ({ a: 8 + 4 * lv }) },
  a_vitality: { kind: 'aura', name: 'Aura Witalności', desc: 'Więcej życia i regeneracji', color: 0x6ee79a, lv: 2, stats: [['hp', 'a', 1], ['regen', 'b', 1]], base: (lv) => ({ a: 12 + 6 * lv, b: 0.3 + 0.15 * lv }) },
  a_swift: { kind: 'aura', name: 'Aura Chyżości', desc: 'Szybszy ruch i większy zasięg zbierania', color: 0x7fe8ff, lv: 2, stats: [['speed', 'a', 0.01], ['magnet', 'b', 0.01]], base: (lv) => ({ a: 4 + 2 * lv, b: 15 + 5 * lv }) },
  a_frost: { kind: 'aura', name: 'Aura Mrozu', desc: 'Wrogowie blisko ciebie są spowolnieni', color: 0x9fd8ff, lv: 7, act: { t: 'slow', R: 110, tick: 0.3 }, base: () => ({}) },
  a_embers: { kind: 'aura', name: 'Aura Żaru', desc: 'Wrogowie blisko ciebie płoną', color: 0xff7a3d, lv: 9, act: { t: 'burn', R: 95, tick: 0.8 }, base: (lv) => ({ dmg: 3 + 1.5 * lv }) },
  a_thorns: { kind: 'aura', name: 'Aura Cierni', desc: 'Rani wrogów, którzy cię dotykają', color: 0xb0e070, lv: 12, act: { t: 'thorn', R: 44, tick: 0.5 }, base: (lv) => ({ dmg: 5 + 2 * lv }) },
  // ================= WZMOCNIENIA =================
  b_berserk: { kind: 'buff', name: 'Szał Mordercy', desc: 'Co kilka sekund: duża szansa na krytyk', color: 0xff3b6b, lv: 6, buff: 'crit', base: (lv) => ({ cd: 12, dur: 5, a: 15 + 3 * lv }) },
  b_freeze: { kind: 'buff', name: 'Zatrzymanie Czasu', desc: 'Co kilka sekund: zamraża pobliskich wrogów', color: 0xaee4ff, lv: 10, buff: 'freeze', base: (lv) => ({ cd: 16, dur: 1.5 + 0.2 * lv, range: 190 }) },
  b_phase: { kind: 'buff', name: 'Mgła Cienia', desc: 'Co kilka sekund: chwilowa nietykalność', color: 0xa77bff, lv: 8, buff: 'phase', base: (lv) => ({ cd: 14, dur: 0.8 + 0.1 * lv }) },
  b_lifeline: { kind: 'buff', name: 'Krwawa Komunia', desc: 'Co kilka sekund: duże leczenie', color: 0xe63946, lv: 5, buff: 'lifeline', base: (lv) => ({ cd: 18, a: 18 + 3 * lv }) },
  b_blink: { kind: 'buff', name: 'Skok w Cień', desc: 'Co kilka sekund: odskakujesz od wrogów', color: 0x6b5bd6, lv: 4, buff: 'blink', base: (lv) => ({ cd: 8 - 0.3 * lv, dur: 0.4 }) },
  b_magnet: { kind: 'buff', name: 'Wir Łupu', desc: 'Co kilka sekund: przyciąga cały łup', color: 0x4ff0d2, lv: 3, buff: 'magnet', base: (lv) => ({ cd: 10 - 0.3 * lv, range: 520 }) },
  // ================= SŁUDZY =================
  m_wisp: { kind: 'minion', name: 'Widmowy Łucznik', desc: 'Szybki duch strzela w pobliskich wrogów', color: 0x9fd8ff, lv: 4, mn: 'shoot', base: (lv) => ({ dmg: 5 + 2 * lv, cd: 0.6, count: 1 + Math.floor(lv / 2) }) },
  m_golem: { kind: 'minion', name: 'Kamienny Strażnik', desc: 'Wolny golem uderza mocno i szeroko', color: 0xb9ad98, lv: 8, mn: 'melee', base: (lv) => ({ dmg: 18 + 7 * lv, cd: 0.9, count: 1 + Math.floor(lv / 4) }) },
  m_bat: { kind: 'minion', name: 'Rój Nietoperzy', desc: 'Wiele szybkich nietoperzy gryzie wrogów', color: 0xd36bff, lv: 6, mn: 'swarm', base: (lv) => ({ dmg: 4 + 1.5 * lv, cd: 0.4, count: 3 + Math.floor(lv / 2) }) },
  m_turret: { kind: 'minion', name: 'Żywa Wieża', desc: 'Nieruchoma wieża przy tobie strzela mocnymi pociskami', color: 0xff9a4d, lv: 10, mn: 'turret', base: (lv) => ({ dmg: 22 + 8 * lv, cd: 1.5, count: 1 + Math.floor(lv / 4) }) },
  m_bomber: { kind: 'minion', name: 'Wybuchowy Sługa', desc: 'Leci do wroga i wybucha, po chwili wraca', color: 0xff6b3d, lv: 12, mn: 'bomber', base: (lv) => ({ dmg: 30 + 10 * lv, cd: 2, count: 1 + Math.floor(lv / 3), range: 60 }) },
  m_healer: { kind: 'minion', name: 'Duch Opiekun', desc: 'Co kilka sekund leczy cię', color: 0x6ee79a, lv: 7, mn: 'heal', base: (lv) => ({ cd: 4, a: 2 + 0.6 * lv, count: 1 }) },
};
