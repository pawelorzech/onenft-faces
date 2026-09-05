/**
 * One face from a seed. Source of truth for the Solidity renderer.
 *
 * Traits: one item per slot (sprites.ts) plus four colour draws (skin, hair,
 * top, background). Items are drawn through weight tables built from tiers;
 * colours are uniform. Pins replace the item draw of a pinnable slot with a
 * chosen common or uncommon item. The composite is a 32x32 map of palette
 * indices; a rim-light pass lights fills that sit right of an outline; runs of
 * equal colour become SVG rects.
 */
import { Canvas, N, ROLE } from "./pixels.ts";
import { SLOTS, type Item, type Tier } from "./sprites.ts";

const U64 = (1n << 64n) - 1n;
export function mix64(x: bigint): bigint {
  let z = (x + 0x9e3779b97f4a7c15n) & U64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & U64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & U64;
  return (z ^ (z >> 31n)) & U64;
}

export const TIER_WEIGHT: Record<Tier, number> = { common: 100, uncommon: 35, rare: 8, legendary: 1 };

/** Weights per slot, scaled to sum to exactly 10,000, in item order. */
export function weightsOf(items: Item[]): number[] {
  const raw = items.map((i) => TIER_WEIGHT[i.tier]);
  const total = raw.reduce((a, b) => a + b, 0);
  const w = raw.map((r) => Math.floor((r * 10000) / total));
  let rest = 10000 - w.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % w.length) { w[i]++; rest--; }
  return w;
}
export const WEIGHTS = SLOTS.map((s) => weightsOf(s.items));

export function pickWeighted(w: number[], roll: number): number {
  let acc = 0;
  for (let i = 0; i < w.length; i++) { acc += w[i]; if (roll < acc) return i; }
  return w.length - 1;
}

// Colours. Each entry: name, main, shade, light.
export type Swatch = { name: string; main: string; shade: string; light: string };
const sw = (name: string, main: string, shade: string, light: string): Swatch => ({ name, main, shade, light });
export const SKINS: Swatch[] = [
  sw("Porcelain", "#f3d6bd", "#d9b092", "#fbe9d9"), sw("Peach", "#eebc94", "#cf9668", "#f6d6b8"), sw("Tan", "#d39a68", "#ad7547", "#e4b78d"),
  sw("Olive", "#b98a5c", "#93673c", "#d1a97e"), sw("Brown", "#9a6541", "#75482c", "#b5825f"), sw("Deep", "#6a4430", "#4b2d1e", "#86604a"),
  sw("Ebony", "#3e2a20", "#291a12", "#5a4235"), sw("Mint", "#9fd3a2", "#6fa874", "#c6e8c6"), sw("Sky", "#9db8e0", "#6f8fc0", "#c3d5ee"),
  sw("Lilac", "#c3a8d9", "#9a7fb5", "#dcc9e8"), sw("Ash", "#b8b6ad", "#8d8b83", "#d3d1c9"), sw("Gold", "#e3c15a", "#b8953a", "#f0da93"),
];
export const HAIRS: Swatch[] = [
  sw("Black", "#2a2320", "#171311", "#4a403b"), sw("Brown", "#5b3a22", "#3f2716", "#7f5636"), sw("Chestnut", "#8a5a2b", "#65401c", "#a97844"),
  sw("Blond", "#dcb96a", "#b8944a", "#ecd39a"), sw("Ginger", "#cc4f2c", "#9e3a1f", "#e07a5a"), sw("Silver", "#e2ddd1", "#b6b0a3", "#f2efe8"),
  sw("Blue", "#3d5fb3", "#2a4382", "#6c88cf"), sw("Green", "#2f9a63", "#217045", "#5cb888"), sw("Pink", "#d4519a", "#a33874", "#e585ba"), sw("Violet", "#7a4bc2", "#583392", "#9c76d6"),
];
export const TOPCOLORS: Swatch[] = [
  sw("White", "#f2efe6", "#c9c5b8", "#ffffff"), sw("Black", "#24211f", "#141211", "#3f3a36"), sw("Red", "#c0392b", "#8f2a20", "#d8695e"),
  sw("Blue", "#2f6db4", "#214f85", "#5f93cc"), sw("Yellow", "#e2b13c", "#b58a2a", "#edc96f"), sw("Green", "#2f7a43", "#215530", "#5a9c6a"),
  sw("Purple", "#6e2f78", "#4d2054", "#93589c"), sw("Orange", "#e07b39", "#b25d27", "#ea9d6a"), sw("Teal", "#2f8f8a", "#206662", "#5eb0ab"),
  sw("Brown", "#7b5b3a", "#583f27", "#9c7c5b"), sw("Pink", "#e28cb8", "#b96b93", "#eeb2d0"), sw("Grey", "#8a8f93", "#63676a", "#aab0b4"),
];
export const GROUNDS: Swatch[] = [
  sw("Brick", "#d94f3d", "#b43d2e", "#e57a6a"), sw("Amber", "#e2a83c", "#bb882c", "#eac06b"), sw("Moss", "#4f8f4c", "#3a6e39", "#74ab71"),
  sw("Cobalt", "#2c6fb0", "#205687", "#5b91c6"), sw("Plum", "#6a4fa3", "#4e3a7c", "#8b74bb"), sw("Rose", "#d76a9a", "#b24f7b", "#e391b5"),
  sw("Lagoon", "#2f8f8a", "#236f6b", "#5aaba6"), sw("Rust", "#c7583c", "#9e442e", "#d67f68"), sw("Lime", "#8fae3a", "#6f882b", "#aac55e"),
  sw("Slate", "#3a4a6b", "#2a3650", "#5c6c8c"), sw("Sand", "#d9c9a3", "#b7a77f", "#e6dbc0"), sw("Cream", "#efe6d2", "#cfc4ab", "#f7f2e6"),
  sw("Ink", "#1f1d1b", "#0f0e0d", "#3a3733"), sw("Sky", "#8fc1e8", "#6d9fc5", "#b6d8f2"), sw("Coral", "#f08a6a", "#c86c50", "#f5ab94"), sw("Steel", "#7f8b96", "#616b74", "#a0aab3"),
];
export const ACCENTS: Swatch[] = [
  sw("Gold", "#e2b13c", "#b58a2a", "#f0d27a"), sw("Red", "#c0392b", "#8f2a20", "#d8695e"), sw("White", "#f4f1ea", "#c9c5b8", "#ffffff"),
  sw("Black", "#1c1a19", "#0e0d0c", "#3a3734"), sw("Blue", "#2c6fb0", "#205687", "#5b91c6"), sw("Green", "#2f7a43", "#215530", "#5a9c6a"), sw("Pink", "#e0489a", "#b03676", "#ea7bb7"),
];
const OUTLINE = "#1c1a19", WHITE = "#f6f4ee", RED = "#d9534f";

export type Traits = { items: number[]; skin: number; hair: number; top: number; ground: number; accent: number };
export type Pins = Partial<Record<string, number>>;

/** Draws from the seed: one per slot then the colours, each mix64(seed + i) mod range. */
export function traitsOf(seed: bigint, pins: Pins = {}): Traits {
  let i = 0n;
  const draw = (range: number) => Number(mix64((seed + i++) & U64) % BigInt(range));
  const items = SLOTS.map((s, k) => {
    const rolled = pickWeighted(WEIGHTS[k], draw(10000));
    const pin = pins[s.slot];
    if (pin === undefined) return rolled;
    if (!s.pinnable) throw new Error(`${s.slot} is not pinnable`);
    const t = s.items[pin]?.tier;
    if (t !== "common" && t !== "uncommon") throw new Error(`${s.slot} ${pin} cannot be pinned`);
    return pin;
  });
  return { items, skin: draw(SKINS.length), hair: draw(HAIRS.length), top: draw(TOPCOLORS.length), ground: draw(GROUNDS.length), accent: draw(ACCENTS.length) };
}

/** Palette indices: 0 none, 1 outline, 2 white, 3 red, then 3 per group (main, shade, light): skin 4, hair 7, top 10, ground 13, accent 16. */
export function paletteOf(t: Traits): string[] {
  const g = (s: Swatch) => [s.main, s.shade, s.light];
  return ["", OUTLINE, WHITE, RED, ...g(SKINS[t.skin]), ...g(HAIRS[t.hair]), ...g(TOPCOLORS[t.top]), ...g(GROUNDS[t.ground]), ...g(ACCENTS[t.accent])];
}
const GROUP_BASE = { skin: 4, hair: 7, top: 10, bg: 13, acc: 16 } as const;

/** Role to palette index for a slot group. A/a/L are the group's colours; B/b are the second group. */
function roleMap(group: string): number[] {
  const m = new Array(8).fill(0);
  m[ROLE.K] = 1; m[ROLE.W] = 2;
  const second = (base: number) => { m[ROLE.B] = base; m[ROLE.b] = base + 1; };
  switch (group) {
    case "bg": m[ROLE.A] = 13; m[ROLE.a] = 14; m[ROLE.L] = 15; second(16); break;
    case "top": m[ROLE.A] = 10; m[ROLE.a] = 11; m[ROLE.L] = 12; m[ROLE.B] = 4; m[ROLE.b] = 5; break;
    case "skin": m[ROLE.A] = 4; m[ROLE.a] = 5; m[ROLE.L] = 6; second(16); break;
    case "eyes": m[ROLE.A] = 4; m[ROLE.a] = 5; second(16); break;
    case "mouth": m[ROLE.A] = 4; m[ROLE.a] = 5; m[ROLE.B] = 3; m[ROLE.b] = 3; break;
    case "hair": m[ROLE.A] = 7; m[ROLE.a] = 8; m[ROLE.L] = 9; second(16); break;
    case "acc": m[ROLE.A] = 4; m[ROLE.a] = 5; second(16); break;
  }
  return m;
}
export const ROLE_MAPS = SLOTS.map((s) => roleMap(s.group));

/** Composite to palette indices, then rim light: a main fill right of an outline takes its light. */
export function composite(t: Traits): Uint8Array {
  const out = new Uint8Array(N * N);
  SLOTS.forEach((s, k) => {
    const c = Canvas.fromRows(s.items[t.items[k]].rows);
    const m = ROLE_MAPS[k];
    for (let i = 0; i < N * N; i++) if (c.g[i]) out[i] = m[c.g[i]];
  });
  for (let y = 0; y < N; y++) for (let x = 1; x < N; x++) {
    const v = out[y * N + x];
    if ((v === 4 || v === 7 || v === 10) && out[y * N + x - 1] === 1) out[y * N + x] = v + 2;
  }
  return out;
}

export function svgOf(t: Traits, px = 320): string {
  const pal = paletteOf(t), map = composite(t);
  let rects = "";
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const v = map[y * N + x];
      if (!v) { x++; continue; }
      let w = 1; while (x + w < N && map[y * N + x + w] === v) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${pal[v]}"/>`;
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${px}" height="${px}" shape-rendering="crispEdges">${rects}</svg>`;
}

export function attributesOf(t: Traits): { trait_type: string; value: string; tier?: Tier }[] {
  const a = SLOTS.map((s, k) => ({ trait_type: s.trait, value: s.items[t.items[k]].name, tier: s.items[t.items[k]].tier }));
  a.push({ trait_type: "Skin", value: SKINS[t.skin].name }, { trait_type: "Hair colour", value: HAIRS[t.hair].name }, { trait_type: "Top colour", value: TOPCOLORS[t.top].name }, { trait_type: "Ground", value: GROUNDS[t.ground].name }, { trait_type: "Accent", value: ACCENTS[t.accent].name });
  return a;
}

export function face(seed: bigint, pins: Pins = {}) {
  const t = traitsOf(seed, pins);
  return { traits: t, svg: svgOf(t), attributes: attributesOf(t) };
}

export function combinations(): bigint {
  let n = 1n;
  for (const s of SLOTS) n *= BigInt(s.items.length);
  return n * BigInt(SKINS.length * HAIRS.length * TOPCOLORS.length * GROUNDS.length * ACCENTS.length);
}
