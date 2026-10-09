/** rodzaje wrogów i ich przypisanie do biomów */
export type Arch = 'melee' | 'swarm' | 'dash' | 'spit' | 'volley' | 'slam' | 'boom' | 'caster' | 'totem';
export type Shape = 'grunt' | 'fast' | 'spit' | 'tank' | 'caster' | 'bat' | 'bomb' | 'totem' | 'elite';
export interface ArchDef {
  name: string; shape: Shape; r: number; hp: number; speed: number; dmg: number; xp: number;
  w0: number; w1: number; // waga losowania przy starcie i w głębi mapy
  pack: [number, number];
}
export const ARCHS: Record<Arch, ArchDef> = {
  melee: { name: 'Wędrowiec', shape: 'grunt', r: 11, hp: 12, speed: 55, dmg: 8, xp: 1, w0: 6, w1: 3, pack: [3, 5] },
  swarm: { name: 'Rój', shape: 'bat', r: 7, hp: 5, speed: 88, dmg: 5, xp: 0.6, w0: 1.2, w1: 2.2, pack: [6, 9] },
  dash: { name: 'Szarżownik', shape: 'fast', r: 9, hp: 8, speed: 78, dmg: 7, xp: 1, w0: 1.5, w1: 2.5, pack: [3, 4] },
  spit: { name: 'Pluciel', shape: 'spit', r: 10, hp: 9, speed: 60, dmg: 8, xp: 1.2, w0: 1, w1: 2.5, pack: [3, 4] },
  volley: { name: 'Łucznik', shape: 'spit', r: 10, hp: 10, speed: 55, dmg: 7, xp: 1.4, w0: 0.6, w1: 2, pack: [2, 4] },
  slam: { name: 'Osiłek', shape: 'tank', r: 18, hp: 60, speed: 38, dmg: 14, xp: 3, w0: 0.5, w1: 2, pack: [1, 2] },
  boom: { name: 'Kamikadze', shape: 'bomb', r: 10, hp: 7, speed: 82, dmg: 9, xp: 1, w0: 1, w1: 2, pack: [3, 5] },
  caster: { name: 'Szaman', shape: 'caster', r: 10, hp: 14, speed: 52, dmg: 9, xp: 2, w0: 0.4, w1: 2, pack: [1, 2] },
  totem: { name: 'Totem', shape: 'totem', r: 16, hp: 45, speed: 0, dmg: 8, xp: 3, w0: 0.2, w1: 1.2, pack: [1, 1] },
};

/** które rodzaje występują w którym biomie */
export const ROSTER: Record<string, Arch[]> = {
  void: ['melee', 'dash', 'spit', 'caster', 'totem'],
  flesh: ['melee', 'swarm', 'boom', 'volley', 'slam'],
  bone: ['melee', 'volley', 'caster', 'totem', 'dash'],
  deep: ['melee', 'swarm', 'dash', 'spit', 'slam'],
  ash: ['melee', 'boom', 'dash', 'totem', 'slam'],
  frost: ['melee', 'volley', 'dash', 'slam', 'caster'],
};

/** barwy wrogów danego biomu: korpus, akcent, elita */
export const PALETTE: Record<string, { body: number; accent: number; elite: number }> = {
  void: { body: 0xa86be0, accent: 0xe6c9ff, elite: 0xff9f1a },
  flesh: { body: 0xd9435f, accent: 0xffb3c1, elite: 0xffb347 },
  bone: { body: 0xcfc7b0, accent: 0x8a7f66, elite: 0xe8c15a },
  deep: { body: 0x3fb8a0, accent: 0xb7fff0, elite: 0xffd24d },
  ash: { body: 0xe0742e, accent: 0xffd36b, elite: 0xff4d4d },
  frost: { body: 0x7fb8e8, accent: 0xffffff, elite: 0xffa64d },
};
