/**
 * The sprite set, drawn with the Canvas DSL. Every item is a 32x32 layer of
 * roles (see pixels.ts). Slots composite in the order listed in SLOTS.
 *
 * Tiers set the weight tables in faces.ts: common, uncommon, rare, legendary.
 * Pinnable slots are marked; a pin may name common or uncommon items only.
 */
import { Canvas, ROLE, type Role } from "./pixels.ts";
const { K, A, a, L, B, b, W } = ROLE;

export type Tier = "common" | "uncommon" | "rare" | "legendary";
export type Item = { name: string; tier: Tier; rows: string[]; /** An accessory that covers the mouth: the mouth layer is not drawn under it. */ hidesMouth?: boolean };
export type Slot = { slot: string; trait: string; pinnable: boolean; group: "bg" | "top" | "skin" | "eyes" | "mouth" | "hair" | "acc"; items: Item[] };

type Draw = (c: Canvas) => void;
function item(name: string, tier: Tier, draw: Draw, opts: { outline?: boolean; shade?: boolean; hidesMouth?: boolean } = {}): Item {
  const c = new Canvas();
  draw(c);
  if (opts.outline) c.outline();
  if (opts.shade) c.shadeRight();
  return { name, tier, rows: c.toRows(), ...(opts.hidesMouth ? { hidesMouth: true } : {}) };
}
const body = (draw: Draw) => (c: Canvas) => { draw(c); };

// ---------------------------------------------------------------- backgrounds: A ground, a ground dark, B accent, W white
const dither = (c: Canvas, from: number, step = 2) => { for (let y = from; y < 32; y++) for (let x = 0; x < 32; x++) if ((x + y) % step === 0) c.px(x, y, a); };
export const BACKGROUNDS: Item[] = [
  item("Flat", "common", (c) => c.rect(0, 0, 32, 32, A)),
  item("Dusk", "common", (c) => { c.rect(0, 0, 32, 32, A); dither(c, 16); }),
  item("Deep dusk", "common", (c) => { c.rect(0, 0, 32, 32, A); dither(c, 10); c.rect(0, 24, 32, 8, a); }),
  item("Ramp", "common", (c) => { c.rect(0, 0, 32, 32, A); for (let y = 8; y < 32; y++) for (let x = 0; x < 32; x++) { const t = (y - 8) / 24; if (((x * 7 + y * 13) % 17) / 17 < t) c.px(x, y, a); } }),
  item("Checker", "uncommon", (c) => { c.rect(0, 0, 32, 32, A); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (((x >> 2) + (y >> 2)) % 2) c.px(x, y, a); }),
  item("Stripes", "uncommon", (c) => { c.rect(0, 0, 32, 32, A); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (((x + y) >> 2) % 2) c.px(x, y, a); }),
  item("Bands", "common", (c) => { c.rect(0, 0, 32, 32, A); for (let y = 0; y < 32; y += 8) c.rect(0, y + 4, 32, 4, a); }),
  item("Split", "uncommon", (c) => { c.rect(0, 0, 16, 32, A); c.rect(16, 0, 16, 32, a); }),
  item("Halo", "uncommon", (c) => { c.rect(0, 0, 32, 32, A); c.ellipse(16, 13, 12, 12, B); c.ellipse(16, 13, 10, 10, A); }),
  item("Sun", "rare", (c) => { c.rect(0, 0, 32, 32, A); c.ellipse(16, 14, 11, 11, B); dither(c, 20); }),
  item("Rays", "rare", (c) => { c.rect(0, 0, 32, 32, A); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const ang = Math.atan2(y - 12, x - 16); if (Math.floor((ang / Math.PI) * 8 + 16) % 2) c.px(x, y, a); } }),
  item("Dots", "common", (c) => { c.rect(0, 0, 32, 32, A); for (let y = 2; y < 32; y += 4) for (let x = (y / 4) % 2 ? 0 : 2; x < 32; x += 4) c.px(x, y, a); }),
  item("Grid", "uncommon", (c) => { c.rect(0, 0, 32, 32, A); for (let i = 0; i < 32; i += 8) { c.rect(i, 0, 1, 32, a); c.rect(0, i, 32, 1, a); } }),
  item("Hills", "uncommon", (c) => { c.rect(0, 0, 32, 32, A); c.ellipse(8, 32, 14, 10, a); c.ellipse(26, 33, 14, 9, a); }),
  item("Night", "rare", (c) => { c.rect(0, 0, 32, 32, a); c.ellipse(25, 6, 3, 3, W); c.ellipse(24, 5, 2.5, 2.5, a); [[3, 3], [9, 7], [28, 14], [5, 12], [14, 2], [30, 3]].forEach(([x, y]) => c.px(x, y, W)); }),
  item("Storm", "legendary", (c) => { c.rect(0, 0, 32, 32, a); dither(c, 0, 3); c.rows(2, 1, ["..W", ".WW", ".W.", "WW.", ".W.", ".WW", "..W", ".W.", "W.."]); c.rows(27, 6, [".W", "WW", "W.", "WW", ".W"]); }),
  item("Frame", "uncommon", (c) => { c.rect(0, 0, 32, 32, a); c.rect(2, 2, 28, 28, A); }),
  item("Diamond", "rare", (c) => { c.rect(0, 0, 32, 32, a); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (Math.abs(x - 15.5) + Math.abs(y - 15.5) < 16) c.px(x, y, A); }),
];

// ---------------------------------------------------------------- tops: A cloth, B skin. Wide shoulders, neck opening at x 13..18.
const shoulders = (c: Canvas) => { c.rect(2, 27, 28, 5, A); c.rect(3, 26, 26, 1, A); c.rect(5, 25, 22, 1, A); c.rect(8, 24, 16, 1, A); c.rect(11, 23, 10, 1, A); };
const neck = (c: Canvas) => { c.rect(13, 21, 6, 4, B); };
const skinShoulders = (c: Canvas) => { c.rect(2, 27, 28, 5, B); c.rect(3, 26, 26, 1, B); c.rect(5, 25, 22, 1, B); c.rect(8, 24, 16, 1, B); c.rect(11, 23, 10, 1, B); };
export const TOPS: Item[] = [
  item("Tee", "common", (c) => { shoulders(c); neck(c); c.rect(12, 24, 8, 1, B); }, { outline: true, shade: true }),
  item("V-neck", "common", (c) => { shoulders(c); neck(c); c.rows(12, 24, ["BBBBBBBB", ".BBBBBB.", "..BBBB..", "...BB..."]); }, { outline: true, shade: true }),
  item("Hoodie", "common", (c) => { c.rect(8, 20, 16, 5, A); shoulders(c); neck(c); c.rect(12, 23, 8, 1, B); c.rect(11, 26, 1, 6, W); c.rect(20, 26, 1, 6, W); }, { outline: true, shade: true }),
  item("Collar", "common", (c) => { shoulders(c); neck(c); c.rows(10, 24, ["WWW....WWW", ".WWW..WWW.", "..WW..WW..", "...WWWW..."]); }, { outline: true, shade: true }),
  item("Tank", "uncommon", (c) => { skinShoulders(c); neck(c); c.rect(8, 28, 16, 4, A); c.rect(9, 25, 2, 3, A); c.rect(21, 25, 2, 3, A); }, { outline: true, shade: true }),
  item("Turtleneck", "uncommon", (c) => { shoulders(c); c.rect(12, 19, 8, 6, A); c.rect(12, 19, 8, 1, a); }, { outline: true, shade: true }),
  item("Suit", "uncommon", (c) => { shoulders(c); neck(c); c.rows(11, 24, ["WWW....WWW", "AWWW..WWWA", "AAWW..WWAA", "AAAWWWWAAA", "AAAAKKAAAA", "AAAAKKAAAA", "AAAAKKAAAA"]); }, { outline: true, shade: true }),
  item("Jersey", "uncommon", (c) => { shoulders(c); neck(c); c.rect(12, 24, 8, 1, B); c.rect(2, 28, 28, 1, W); c.rect(2, 30, 28, 1, W); }, { outline: true, shade: true }),
  item("Robe", "rare", (c) => { c.rect(1, 25, 30, 7, A); c.rect(3, 24, 26, 1, A); c.rect(6, 23, 20, 1, A); neck(c); c.rows(11, 23, ["BBBBBBBBBB", "W..BBBB..W", "W...BB...W", "W...BB...W", "W........W", "W........W", "W........W"]); }, { outline: true, shade: true }),
  item("Armor", "rare", (c) => { shoulders(c); c.rect(1, 25, 6, 5, A); c.rect(25, 25, 6, 5, A); neck(c); c.rect(12, 24, 8, 1, B); c.rect(14, 27, 4, 4, W); c.rect(15, 28, 2, 2, A); }, { outline: true, shade: true }),
  item("Bare", "uncommon", (c) => { skinShoulders(c); neck(c); }, { outline: true, shade: true }),
  item("Overalls", "uncommon", (c) => { skinShoulders(c); neck(c); c.rect(9, 25, 2, 7, A); c.rect(21, 25, 2, 7, A); c.rect(8, 29, 16, 3, A); c.px(10, 29, W); c.px(21, 29, W); }, { outline: true, shade: true }),
  item("Scarf", "uncommon", (c) => { shoulders(c); c.rect(10, 20, 12, 5, B); c.rect(10, 22, 12, 1, b); c.rect(19, 24, 3, 7, B); }, { outline: true, shade: true }),
  item("Stripes", "common", (c) => { shoulders(c); neck(c); c.rect(12, 24, 8, 1, B); for (let y = 26; y < 32; y += 2) c.rect(2, y, 28, 1, a); }, { outline: true }),
];

// ---------------------------------------------------------------- heads: A skin. A rounded box with a jaw, ears attached, a neck, a nose.
type HeadSpec = { w: number; h: number; corner: number; jaw: number; top?: number };
function head(spec: HeadSpec): Draw {
  return (c) => {
    const { w, h, corner, jaw } = spec, x = 16 - Math.floor(w / 2), y = spec.top ?? 4;
    for (let j = 0; j < h; j++) {
      let inset = 0;
      if (j < corner) inset = corner - j;                       // top corners
      const fromBottom = h - 1 - j;
      if (fromBottom < jaw) inset = Math.max(inset, jaw - fromBottom); // jaw taper
      c.rect(x + inset, y + j, w - 2 * inset, 1, A);
    }
    c.rect(x - 2, y + 7, 2, 3, A); c.rect(x + w, y + 7, 2, 3, A);   // ears
    c.rect(13, y + h - 1, 6, 24 - (y + h - 1), A);                   // neck to the top layer
    c.outline();
    c.px(x - 1, y + 8, a); c.px(x + w, y + 8, a);                    // ear holes
    c.rect(x + w - 2, y + 6, 1, h - 8, a);                           // cheek shade, right
    c.rect(13, y + h, 6, 1, a);                                      // under the jaw
    c.px(16, y + 10, a); c.px(15, y + 10, a);                        // nose
  };
}
export const HEADS: Item[] = [
  item("Round", "common", head({ w: 14, h: 17, corner: 3, jaw: 3 })),
  item("Square", "common", head({ w: 14, h: 17, corner: 1, jaw: 1 })),
  item("Narrow", "common", head({ w: 12, h: 18, corner: 2, jaw: 2 })),
  item("Wide", "common", head({ w: 16, h: 16, corner: 3, jaw: 3 })),
  item("Chin", "uncommon", head({ w: 14, h: 18, corner: 2, jaw: 5 })),
  item("Egg", "uncommon", head({ w: 14, h: 18, corner: 4, jaw: 4 })),
  item("Tall", "rare", head({ w: 12, h: 19, corner: 2, jaw: 2, top: 3 })),
  item("Block", "rare", head({ w: 16, h: 17, corner: 0, jaw: 0 })),
];

// ---------------------------------------------------------------- eyes: K, W, B accent (frames, iris)
export const EYES: Item[] = [
  item("Dots", "common", (c) => { c.px(12, 12, K); c.px(19, 12, K); }),
  item("Wide", "common", (c) => { c.rows(11, 11, ["WW", "WK"]); c.rows(18, 11, ["WW", "KW"]); }),
  item("Sleepy", "common", (c) => { c.rows(11, 12, ["KK"]); c.rows(18, 12, ["KK"]); }),
  item("Side", "common", (c) => { c.rows(11, 11, ["WW", "KW"]); c.rows(18, 11, ["WW", "KW"]); }),
  item("Round", "common", (c) => { c.rows(10, 10, ["WWW", "WKW", "WWW"]); c.rows(18, 10, ["WWW", "WKW", "WWW"]); }),
  item("Happy", "common", (c) => { c.rows(11, 11, ["K.K", ".K."].reverse()); c.rows(18, 11, ["K.K", ".K."].reverse()); }),
  item("Angry", "uncommon", (c) => { c.rows(11, 10, ["K..", ".KK"]); c.rows(18, 10, ["..K", "KK."]); }),
  item("Wink", "uncommon", (c) => { c.rows(11, 11, ["WW", "WK"]); c.rows(18, 12, ["KK"]); }),
  item("Shades", "uncommon", (c) => { c.rows(9, 10, ["KKKKKKKKKKKKKK", "KBBBBKKKKBBBBK", "KBBBBK..KBBBBK", ".KKKK....KKKK."]); }),
  item("Glasses", "uncommon", (c) => { c.rows(9, 10, ["BBBBB..BBBBB", "BWWWBBBBWWWB", "BWKWB..BWKWB", "BBBBB..BBBBB"]); c.px(8, 11, B); c.px(23, 11, B); }),
  item("X", "rare", (c) => { c.rows(11, 10, ["K.K", ".K.", "K.K"]); c.rows(18, 10, ["K.K", ".K.", "K.K"]); }),
  item("Hearts", "rare", (c) => { c.rows(10, 10, ["B.B", "BBB", ".B."]); c.rows(18, 10, ["B.B", "BBB", ".B."]); }),
  item("Stars", "rare", (c) => { c.rows(10, 10, [".B.", "BBB", ".B."]); c.rows(18, 10, [".B.", "BBB", ".B."]); }),
  item("Cyclops", "legendary", (c) => { c.rows(13, 9, ["KWWWWK", "KWWKWK", "KWWKWK", "KWWWWK", ".KKKK."]); }),
  item("Laser", "legendary", (c) => { c.rows(11, 12, ["BB"]); c.rows(18, 12, ["BB"]); c.rect(0, 12, 11, 1, B); c.rect(20, 12, 12, 1, B); }),
  item("Visor", "rare", (c) => { c.rect(8, 10, 16, 4, K); c.rect(9, 11, 14, 2, B); c.rect(10, 11, 3, 1, W); }),
];

// ---------------------------------------------------------------- mouths: K, W, B red
export const MOUTHS: Item[] = [
  item("Flat", "common", (c) => c.rect(14, 17, 4, 1, K)),
  item("Smile", "common", (c) => c.rows(13, 16, ["K....K", ".KKKK."])),
  item("Grin", "common", (c) => c.rows(12, 16, ["K......K", ".KKKKKK.", "..WWWW.."])),
  item("Frown", "common", (c) => c.rows(13, 16, [".KKKK.", "K....K"])),
  item("O", "common", (c) => c.rows(14, 16, [".KK.", "KBBK", ".KK."])),
  item("Teeth", "uncommon", (c) => c.rows(12, 16, ["KKKKKKKK", "KWKWKWKW", "KKKKKKKK"])),
  item("Tongue", "uncommon", (c) => c.rows(13, 16, ["KKKKKK", ".KBBK.", "..BB.."])),
  item("Smirk", "common", (c) => c.rows(13, 17, ["KKKK.", "....K"])),
  item("Cigarette", "uncommon", (c) => { c.rect(14, 17, 4, 1, K); c.rows(18, 17, ["WWWWB"]); }),
  item("Mustache", "uncommon", (c) => c.rows(11, 15, ["KK......KK", "KKKK..KKKK", "..KKKKKK..", "....KK...."])),
  item("Beard", "rare", (c) => c.rows(9, 15, ["K............K", "KK..........KK", "KKK........KKK", "KKKKKKKKKKKKKK", ".KKKKKKKKKKKK.", "..KKKKKKKKKK..", "...KKKKKKKK..."])),
  item("Whistle", "uncommon", (c) => { c.rows(15, 16, [".K.", "K.K", ".K."]); c.rows(19, 14, ["W", ".W"]); c.rows(19, 18, [".W", "W"]); }),
  item("Joint", "uncommon", (c) => { c.rect(14, 17, 4, 1, K); c.rows(18, 16, ["....W", "..WWW", "WWWB."]); c.rows(21, 13, ["W", ".W", "W"]); }),
  item("Pipe", "rare", (c) => { c.rect(14, 17, 4, 1, K); c.rows(18, 17, ["KKKK", "...KK", "..KKK"]); c.rows(22, 14, ["W", ".W"]); }),
  item("Lollipop", "uncommon", (c) => { c.rect(14, 17, 4, 1, K); c.rows(18, 15, [".BB", "BBB", ".BB", ".W", ".W"]); }),
  item("Gum", "uncommon", (c) => { c.rect(14, 17, 4, 1, K); c.rows(16, 18, [".BB.", "BBBB", "BBBB", ".BB."]); }),
  item("Gold tooth", "rare", (c) => c.rows(12, 16, ["KKKKKKKK", "KWKWKBKW", "KKKKKKKK"])),
];

// ---------------------------------------------------------------- hair or hat: A hair, B hat accent. The head box is x 9..22, top y 4.
const cap = (c: Canvas) => { c.rect(9, 3, 14, 5, B); c.rect(10, 2, 12, 1, B); c.rect(11, 1, 10, 1, B); };
const crownOfHair = (c: Canvas) => { c.rect(8, 3, 16, 5, A); c.rect(9, 2, 14, 1, A); c.rect(10, 1, 12, 1, A); };
export const HAIR: Item[] = [
  item("Bald", "common", () => {}),
  item("Short", "common", (c) => { crownOfHair(c); c.rect(8, 8, 2, 3, A); c.rect(22, 8, 2, 3, A); }, { outline: true, shade: true }),
  item("Part", "common", (c) => { crownOfHair(c); c.rect(7, 6, 3, 6, A); c.rect(22, 8, 2, 2, A); c.rect(13, 2, 1, 4, a); }, { outline: true, shade: true }),
  item("Long", "common", (c) => { crownOfHair(c); c.rect(6, 6, 3, 17, A); c.rect(23, 6, 3, 17, A); c.rect(7, 4, 18, 4, A); }, { outline: true, shade: true }),
  item("Curly", "common", (c) => { crownOfHair(c); for (const [x, y] of [[8, 5], [11, 2], [16, 1], [21, 2], [24, 5], [7, 9], [25, 9]]) c.ellipse(x, y, 3, 3, A); c.rect(7, 8, 3, 4, A); c.rect(22, 8, 3, 4, A); }, { outline: true, shade: true }),
  item("Afro", "uncommon", (c) => { c.ellipse(16, 7, 12, 8.5, A); c.rect(6, 7, 20, 5, A); }, { outline: true, shade: true }),
  item("Mohawk", "uncommon", (c) => { c.rect(14, 0, 4, 5, A); c.rect(13, 2, 6, 3, A); c.rect(12, 4, 8, 2, A); }, { outline: true, shade: true }),
  item("Bun", "uncommon", (c) => { crownOfHair(c); c.rect(13, 0, 6, 3, A); c.rect(14, -1, 4, 1, A); }, { outline: true, shade: true }),
  item("Bob", "common", (c) => { crownOfHair(c); c.rect(7, 5, 3, 12, A); c.rect(22, 5, 3, 12, A); c.rect(9, 4, 14, 2, A); }, { outline: true, shade: true }),
  item("Spiky", "uncommon", (c) => { crownOfHair(c); c.rows(8, 0, ["..A....A....A...", ".AA...AA....AA..", "AAAA.AAAA.AAAAA."]); c.rect(8, 8, 2, 2, A); c.rect(22, 8, 2, 2, A); }, { outline: true, shade: true }),
  item("Beanie", "common", (c) => { c.rect(8, 3, 16, 6, B); c.rect(9, 2, 14, 1, B); c.rect(10, 1, 12, 1, B); c.rect(8, 7, 16, 2, b); }, { outline: true, shade: true }),
  item("Cap", "common", (c) => { cap(c); c.rect(9, 7, 20, 2, B); c.rect(23, 7, 6, 2, b); }, { outline: true, shade: true }),
  item("Backwards cap", "uncommon", (c) => { cap(c); c.rect(3, 6, 7, 2, b); c.rect(9, 7, 14, 1, B); }, { outline: true, shade: true }),
  item("Top hat", "uncommon", (c) => { c.rect(10, -1, 12, 8, B); c.rect(6, 6, 20, 2, B); c.rect(10, 5, 12, 1, b); }, { outline: true, shade: true }),
  item("Crown", "rare", (c) => { c.rows(9, 0, ["B...B...B...B.", "B...B...B...B.", "BB.BBB.BBB.BBB", "BBBBBBBBBBBBBB", "BBBBBBBBBBBBBB", "BBBBBBBBBBBBBB", "BBBBBBBBBBBBBB"]); c.px(11, 4, W); c.px(15, 4, W); c.px(19, 4, W); }, { outline: true }),
  item("Bandana", "common", (c) => { c.rect(8, 3, 16, 5, B); c.rect(9, 2, 14, 1, B); c.rect(10, 1, 12, 1, B); c.rows(23, 5, ["BB.", "BBB", ".BB", "..B"]); }, { outline: true, shade: true }),
  item("Headband", "common", (c) => { c.rect(8, 5, 16, 2, B); c.rect(7, 6, 18, 1, B); c.rect(24, 6, 3, 1, B); }, { outline: true }),
  item("Horns", "rare", (c) => { c.rows(4, 0, ["BB....", "BBB...", ".BBB..", "..BBB.", "...BBB", "....BB"]); c.rows(22, 0, ["....BB", "...BBB", "..BBB.", ".BBB..", "BBB...", "BB...."]); }, { outline: true }),
  item("Halo", "legendary", (c) => { c.ellipse(16, 1.5, 8, 2.2, B); c.ellipse(16, 1.5, 5.5, 1.1, ROLE.none); }, { outline: true }),
  item("Wizard", "legendary", (c) => { for (let y = 0; y < 8; y++) c.rect(16 - y - 1, y - 1, 2 + y * 2, 1, B); c.rect(6, 7, 20, 2, B); c.rect(9, 6, 14, 1, b); c.px(16, 1, W); c.px(14, 4, W); }, { outline: true, shade: true }),
  item("Beret", "uncommon", (c) => { c.ellipse(15, 4, 9.5, 3.6, B); c.rect(8, 5, 16, 2, B); c.px(14, -1, B); c.px(14, 0, B); }, { outline: true, shade: true }),
  item("Bucket", "uncommon", (c) => { c.rect(9, 1, 14, 6, B); c.rect(6, 6, 20, 2, B); c.rect(9, 5, 14, 1, b); }, { outline: true, shade: true }),
  item("Helmet", "rare", (c) => { c.rect(8, 3, 16, 8, B); c.rect(9, 2, 14, 1, B); c.rect(10, 1, 12, 1, B); c.rect(7, 5, 18, 6, B); c.rect(7, 9, 18, 1, b); }, { outline: true, shade: true }),
  item("Pigtails", "uncommon", (c) => { crownOfHair(c); c.rect(5, 8, 3, 9, A); c.rect(24, 8, 3, 9, A); c.rect(4, 10, 1, 5, A); c.rect(27, 10, 1, 5, A); }, { outline: true, shade: true }),
  item("Ponytail", "common", (c) => { crownOfHair(c); c.rect(21, 6, 4, 4, A); c.rect(23, 9, 3, 10, A); }, { outline: true, shade: true }),
  item("Cowboy", "rare", (c) => { c.rect(10, 0, 12, 7, B); c.rect(4, 6, 24, 2, B); c.rect(3, 5, 2, 2, B); c.rect(27, 5, 2, 2, B); c.rect(10, 5, 12, 1, b); }, { outline: true, shade: true }),
];

// ---------------------------------------------------------------- accessories: K, W, B gold or accent
export const ACCESSORIES: Item[] = [
  item("None", "common", () => {}),
  item("Earring", "common", (c) => { c.rect(7, 15, 1, 2, B); }),
  item("Hoops", "uncommon", (c) => { c.rows(6, 15, ["BB", "B.B".slice(0, 2), "BB"]); c.rows(24, 15, ["BB", "BB", "BB"]); }),
  item("Chain", "uncommon", (c) => { c.rows(11, 25, ["B........B", ".B......B.", "..BBBBBB.."]); }),
  item("Eyepatch", "rare", (c) => { c.rect(17, 10, 5, 4, K); c.rect(9, 9, 8, 1, K); c.rect(22, 9, 2, 1, K); }),
  item("Blush", "common", (c) => { c.rect(9, 14, 2, 1, B); c.rect(21, 14, 2, 1, B); }),
  item("Mole", "common", (c) => c.px(20, 15, K)),
  item("Scar", "uncommon", (c) => c.rows(19, 7, ["K", ".K", "..K", ".K.K".slice(0, 3)])),
  item("Mask", "rare", (c) => { c.rect(10, 15, 12, 5, B); c.rect(10, 15, 12, 1, b); c.rect(8, 16, 2, 1, B); c.rect(22, 16, 2, 1, B); }, { hidesMouth: true }),
  item("Monocle", "rare", (c) => { c.rows(17, 9, ["BBBB", "B..B", "B..B", "BBBB", "...B", "...B"]); }),
  item("Bandaid", "uncommon", (c) => { c.rect(9, 14, 3, 1, W); c.rect(10, 14, 1, 1, B); }),
  item("Tear", "uncommon", (c) => { c.rows(12, 13, ["B", "B", "B"]); }),
  item("Freckles", "common", (c) => { for (const [x, y] of [[10, 14], [12, 15], [11, 16], [20, 14], [19, 15], [21, 16]]) c.px(x, y, ROLE.a); }),
  item("Nose ring", "uncommon", (c) => { c.rows(16, 15, ["B", "B"]); c.px(17, 16, B); }),
  item("Headphones", "uncommon", (c) => { c.rect(6, 12, 3, 4, K); c.rect(23, 12, 3, 4, K); c.rect(7, 13, 1, 2, B); c.rect(24, 13, 1, 2, B); c.rows(8, 4, ["...KKKKKKKKKK...", "..K..........K..", ".K............K.", "K..............K"]); }),
  item("Pearls", "uncommon", (c) => { c.rows(11, 25, ["W........W", ".W......W.", "..WWWWWW.."]); }),
  item("Choker", "uncommon", (c) => { c.rect(13, 21, 6, 1, K); c.px(16, 22, B); }),
  item("Bindi", "uncommon", (c) => c.px(16, 9, B)),
  item("Piercing", "uncommon", (c) => { c.px(21, 8, B); c.px(22, 9, B); }),
  item("Bow tie", "uncommon", (c) => { c.rows(12, 24, ["BB....BB", "BBBKKBBB", "BB....BB"]); }),
  item("Sticker", "rare", (c) => { c.rect(20, 14, 3, 3, W); c.px(21, 15, B); }),
  item("Face paint", "rare", (c) => { c.rect(9, 8, 14, 1, B); c.rect(9, 9, 14, 1, B); c.rows(9, 10, ["B.B.B.B.B.B.B."]); }),
  item("Third eye", "legendary", (c) => { c.rows(15, 6, ["WW", "WK"]); }),
  item("Halo dot", "rare", (c) => { c.px(24, 17, B); c.px(24, 18, B); c.px(25, 17, B); }),
];

// ---------------------------------------------------------------- 1/1s: a full figure on one layer, its own two swatches. Background comes from the token.
export type OneOfOne = { name: string; rows: string[]; main: [string, string, string]; second: [string, string, string] };
function one(name: string, main: [string, string, string], second: [string, string, string], draw: Draw, opts: { outline?: boolean; shade?: boolean } = {}): OneOfOne {
  const c = new Canvas(); draw(c); if (opts.outline) c.outline(); if (opts.shade) c.shadeRight();
  return { name, rows: c.toRows(), main, second };
}
const bust = (c: Canvas, r: Role = A) => { c.rect(2, 27, 28, 5, r); c.rect(3, 26, 26, 1, r); c.rect(5, 25, 22, 1, r); c.rect(8, 24, 16, 1, r); c.rect(11, 23, 10, 1, r); c.rect(13, 19, 6, 5, r); };
const headBox = (c: Canvas, r: Role = A, x = 9, y = 4, w = 14, h = 17) => { c.rect(x + 2, y, w - 4, h, r); c.rect(x + 1, y + 1, w - 2, h - 2, r); c.rect(x, y + 2, w, h - 4, r); c.rect(x + 1, y + h - 2, w - 2, 1, r); c.rect(x + 2, y + h - 1, w - 4, 1, r); };
const eyesK = (c: Canvas, y = 11) => { c.rect(12, y, 2, 2, K); c.rect(19, y, 2, 2, K); };
const eyesW = (c: Canvas, y = 10) => { c.rect(11, y, 3, 3, W); c.rect(18, y, 3, 3, W); c.px(12, y + 1, K); c.px(19, y + 1, K); };
const mouthK = (c: Canvas, y = 16) => c.rect(14, y, 4, 1, K);
export const ONE_OF_ONES: OneOfOne[] = [
  one("Robot", ["#b9c2cc", "#8a949f", "#e1e7ec"], ["#e2b13c", "#b58a2a", "#f0d27a"], (c) => { bust(c, B); c.rect(9, 5, 14, 15, A); c.rect(15, 1, 2, 4, A); c.px(15, 0, B); c.px(16, 0, B); c.rect(7, 10, 2, 4, A); c.rect(23, 10, 2, 4, A); c.outline(); c.rect(11, 9, 3, 3, B); c.rect(18, 9, 3, 3, B); c.px(12, 10, W); c.px(19, 10, W); c.rect(12, 15, 8, 2, K); for (let x = 13; x < 20; x += 2) c.px(x, 15, W); c.rect(21, 6, 1, 13, a); }, { shade: false }),
  one("Skull", ["#efe9dc", "#c9c2b2", "#ffffff"], ["#2a2320", "#171311", "#4a403b"], (c) => { bust(c, B); c.rect(9, 4, 14, 13, A); c.rect(10, 3, 12, 1, A); c.rect(11, 2, 10, 1, A); c.rect(11, 17, 10, 4, A); c.outline(); c.rect(11, 8, 4, 4, K); c.rect(17, 8, 4, 4, K); c.px(15, 13, K); c.px(16, 13, K); c.px(15, 14, K); c.px(16, 14, K); c.rect(12, 18, 8, 2, K); for (let x = 13; x < 20; x += 2) c.rect(x, 18, 1, 2, A); }),
  one("Ghost", ["#f3f1ea", "#d2cec2", "#ffffff"], ["#8fc1e8", "#6d9fc5", "#b6d8f2"], (c) => { c.ellipse(16, 11, 10, 10, A); c.rect(6, 11, 20, 16, A); for (let x = 6; x < 26; x += 4) c.rect(x, 27, 2, 3, A); c.outline(); c.rect(11, 9, 3, 4, K); c.rect(18, 9, 3, 4, K); c.px(12, 10, W); c.px(19, 10, W); c.ellipse(16, 17, 2.5, 2, K); }),
  one("Cat", ["#e8a24a", "#bd7c2f", "#f2c07a"], ["#f3f1ea", "#d2cec2", "#ffffff"], (c) => { bust(c, A); c.rect(8, 6, 16, 14, A); c.rect(9, 5, 14, 1, A); c.rows(7, 1, ["AA.....", "AAA....", "AAAA...", "AAAAA..", "AAAAAA."]); c.rows(19, 1, [".....AA", "....AAA", "...AAAA", "..AAAAA", ".AAAAAA"]); c.outline(); c.px(9, 3, B); c.px(22, 3, B); c.rect(11, 10, 3, 3, W); c.rect(18, 10, 3, 3, W); c.px(12, 11, K); c.px(19, 11, K); c.rect(12, 10, 1, 1, K); c.rect(15, 14, 2, 1, K); c.rect(13, 15, 6, 2, B); c.px(15, 16, K); c.px(16, 16, K); c.rect(9, 14, 3, 1, K); c.rect(20, 14, 3, 1, K); c.rect(4, 26, 4, 6, W); c.rect(24, 26, 4, 6, W); }),
  one("Astronaut", ["#f3f1ea", "#c9c5b8", "#ffffff"], ["#2c6fb0", "#205687", "#5b91c6"], (c) => { bust(c, A); c.rect(1, 25, 5, 5, A); c.rect(26, 25, 5, 5, A); c.ellipse(16, 11, 10.5, 10.5, A); c.outline(); c.ellipse(16, 11, 7.5, 7.5, K); c.rect(11, 6, 5, 3, B); c.rect(10, 9, 3, 4, B); c.rect(14, 27, 4, 3, B); c.px(15, 28, W); }),
  one("Alien", ["#9fd3a2", "#6fa874", "#c6e8c6"], ["#3b3b3b", "#232323", "#5a5a5a"], (c) => { bust(c, B); c.ellipse(16, 10, 10, 8, A); c.rect(10, 12, 12, 6, A); c.rows(12, 17, ["AAAAAAAA", ".AAAAAA.", "..AAAA.", "...AA..."]); c.rect(14, 20, 4, 4, A); c.outline(); c.ellipse(12, 11, 2.6, 3.4, K); c.ellipse(20, 11, 2.6, 3.4, K); c.px(11, 10, W); c.px(19, 10, W); c.rect(15, 17, 2, 1, K); }),
  one("Knight", ["#c0c7cf", "#8f98a3", "#e4e8ec"], ["#b7282e", "#8a1e23", "#d4555a"], (c) => { bust(c, B); c.rect(9, 4, 14, 17, A); c.rect(10, 3, 12, 1, A); c.rect(11, 2, 10, 1, A); c.rect(15, 0, 2, 3, B); c.rect(14, 0, 4, 1, B); c.outline(); c.rect(10, 9, 12, 3, K); c.rect(11, 10, 3, 1, W); c.rect(18, 10, 3, 1, W); c.rect(15, 12, 2, 7, a); for (let y = 13; y < 19; y += 2) c.rect(11, y, 10, 1, a); c.rect(13, 25, 6, 5, A); c.px(15, 26, B); c.px(16, 26, B); c.px(15, 27, B); c.px(16, 27, B); }, { shade: false }),
  one("Diver", ["#c9a25a", "#9c7a3f", "#e0c186"], ["#2f6f7a", "#214f57", "#5c9aa4"], (c) => { bust(c, B); c.ellipse(16, 11, 10, 10, A); c.rect(14, 0, 4, 2, A); c.rect(6, 10, 2, 4, A); c.rect(24, 10, 2, 4, A); c.outline(); c.ellipse(16, 11, 6.5, 6.5, K); c.ellipse(16, 11, 5.5, 5.5, B); c.rect(12, 8, 2, 2, W); c.rect(11, 9, 1, 2, W); c.rect(14, 26, 4, 4, A); c.rect(15, 27, 2, 2, K); }),
  one("Pumpkin", ["#e8792f", "#b85a1e", "#f2a163"], ["#4f8f4c", "#3a6e39", "#74ab71"], (c) => { bust(c, B); c.ellipse(16, 12, 11, 9, A); c.rect(15, 1, 2, 3, B); c.rect(16, 0, 3, 2, B); c.outline(); c.rect(9, 6, 1, 12, a); c.rect(13, 4, 1, 16, a); c.rect(18, 4, 1, 16, a); c.rect(22, 6, 1, 12, a); c.rows(10, 8, ["K..", "KK.", "KKK"]); c.rows(19, 8, ["..K", ".KK", "KKK"]); c.rows(10, 14, ["K.KKKK.K", "KKK..KKK", ".KKKKKK."]); }, { shade: false }),
  one("Mummy", ["#e8e0c8", "#bfb59a", "#f5f0e0"], ["#7a6a4a", "#574a32", "#a08c66"], (c) => { bust(c, A); headBox(c, A); c.outline(); for (let y = 5; y < 20; y += 3) c.rect(10, y, 12, 1, a); for (let y = 25; y < 31; y += 3) c.rect(3, y, 26, 1, a); c.rect(10, 9, 12, 4, B); c.rect(10, 9, 12, 1, K); c.rect(10, 12, 12, 1, K); c.rect(11, 10, 3, 2, K); c.rect(18, 10, 3, 2, K); c.px(12, 10, W); c.px(19, 10, W); c.rect(14, 15, 4, 1, K); }, { shade: false }),
  one("Vampire", ["#e9e2ea", "#c2b8c4", "#f6f2f7"], ["#4a1b3d", "#30112a", "#6d2b5a"], (c) => { bust(c, B); c.rect(2, 22, 6, 6, B); c.rect(24, 22, 6, 6, B); headBox(c, A); c.rows(9, 2, ["AAA.........AAA", "AAAAA.....AAAAA"]); c.rect(9, 2, 14, 3, K); c.rows(9, 5, ["KKKKKKKKKKKKKK", "K.KKKKKKKKKK.K", "...KKK.KKK...."]); c.outline(); c.rect(9, 2, 14, 3, K); c.rect(11, 5, 3, 1, K); c.rect(18, 5, 3, 1, K); c.px(15, 5, K); c.px(16, 5, K); c.px(16, 6, K); c.px(15, 6, K); c.rect(11, 10, 3, 2, K); c.rect(18, 10, 3, 2, K); c.px(12, 10, B); c.px(19, 10, B); c.rect(13, 15, 6, 1, K); c.px(13, 16, W); c.px(18, 16, W); c.rect(12, 21, 8, 3, W); }),
  one("Frog", ["#5faa4a", "#438235", "#8cc97a"], ["#f2e9b0", "#c9c08c", "#f9f4d2"], (c) => { bust(c, A); c.rect(8, 8, 16, 12, A); c.rect(9, 7, 14, 1, A); c.ellipse(11, 6, 3, 3, A); c.ellipse(21, 6, 3, 3, A); c.rect(10, 15, 12, 4, B); c.outline(); c.rect(10, 5, 2, 2, W); c.rect(20, 5, 2, 2, W); c.px(11, 6, K); c.px(21, 6, K); c.rect(11, 14, 10, 1, K); c.px(12, 15, K); c.px(19, 15, K); c.rect(8, 24, 16, 5, B); }),
  one("Owl", ["#8a6a48", "#65492f", "#a9885f"], ["#f2c94c", "#c9a232", "#f6dc85"], (c) => { bust(c, A); c.ellipse(16, 12, 10, 10, A); c.rect(6, 6, 20, 8, A); c.rows(7, 2, ["AA.........", "AAA........"]); c.rows(21, 2, [".........AA", "........AAA"]); c.outline(); c.ellipse(12, 11, 3.6, 3.6, W); c.ellipse(20, 11, 3.6, 3.6, W); c.ellipse(12, 11, 1.6, 1.6, K); c.ellipse(20, 11, 1.6, 1.6, K); c.rows(15, 14, [".BB.", "BBBB", ".BB.", "..B."]); for (let y = 25; y < 31; y += 2) c.rect(10 + (y % 4 === 1 ? 0 : 1), y, 12, 1, a); }),
  one("Bear", ["#7a4b2a", "#59361d", "#9c6a44"], ["#d9b28a", "#b08d68", "#e8cdae"], (c) => { bust(c, A); c.ellipse(16, 12, 9.5, 9, A); c.ellipse(8, 5, 3, 3, A); c.ellipse(24, 5, 3, 3, A); c.outline(); c.ellipse(8, 5, 1.4, 1.4, B); c.ellipse(24, 5, 1.4, 1.4, B); c.ellipse(16, 15, 4, 3, B); c.rect(15, 13, 2, 2, K); c.rect(12, 9, 2, 2, K); c.rect(19, 9, 2, 2, K); c.rect(14, 16, 4, 1, K); }),
  one("Fox", ["#e07a39", "#b25d27", "#ea9d6a"], ["#f4efe6", "#c9c3b8", "#ffffff"], (c) => { bust(c, A); c.rows(8, 2, ["A......", "AA.....", "AAA....", "AAAA...", "AAAAA..", "AAAAAA."]); c.rows(19, 2, ["......A", ".....AA", "....AAA", "...AAAA", "..AAAAA", ".AAAAAA"]); c.rect(8, 8, 16, 11, A); c.rows(9, 19, ["AAAAAAAAAAAAAA", ".AAAAAAAAAAAA.", "..AAAAAAAAAA..", "...AAAAAAAA...", "....AAAAAA...."]); c.rect(11, 15, 10, 6, B); c.outline(); c.rect(12, 11, 2, 2, K); c.rect(19, 11, 2, 2, K); c.rect(15, 17, 2, 2, K); c.rect(10, 24, 12, 6, B); }),
  one("Panda", ["#f4f1ea", "#c9c5b8", "#ffffff"], ["#1c1a19", "#0e0d0c", "#3a3734"], (c) => { bust(c, B); c.ellipse(16, 12, 9.5, 9, A); c.ellipse(8, 5, 3, 3, B); c.ellipse(24, 5, 3, 3, B); c.outline(); c.ellipse(12, 11, 2.8, 3.2, B); c.ellipse(20, 11, 2.8, 3.2, B); c.px(12, 11, W); c.px(20, 11, W); c.rect(15, 15, 2, 1, B); c.rect(14, 17, 4, 1, K); }),
  one("Zombie", ["#a9c98a", "#7f9c63", "#c8dfb0"], ["#6e5a3a", "#4e3f28", "#8f7a55"], (c) => { bust(c, B); headBox(c, A); c.rect(9, 3, 14, 3, ROLE.none); c.rows(9, 3, ["A.AAA..AA.AAA.", "AAAAAAAAAAAAAA", "AAAAAAAAAAAAAA"]); c.outline(); c.rect(11, 10, 3, 2, K); c.px(12, 10, W); c.rect(18, 11, 3, 3, K); c.px(19, 12, W); c.rows(12, 15, ["KKKKKKKK", "K.K.K.K."]); c.rows(19, 6, ["a", "a", "a"]); c.rect(2, 26, 10, 3, ROLE.none); c.rect(2, 26, 10, 3, B); c.rect(2, 27, 4, 1, a); }, { shade: false }),
  one("Clown", ["#f3d6bd", "#d9b092", "#fbe9d9"], ["#d1262f", "#9c1b22", "#e2606a"], (c) => { bust(c, ROLE.a); headBox(c, A); for (const [x, y] of [[8, 5], [11, 2], [16, 1], [21, 2], [24, 5], [7, 9], [25, 9]]) c.ellipse(x, y, 3, 3, B); c.outline(); c.ellipse(16, 15, 2.2, 2.2, B); c.rect(11, 10, 3, 3, W); c.rect(18, 10, 3, 3, W); c.px(12, 11, K); c.px(19, 11, K); c.rows(11, 17, ["K........K", ".KBBBBBBK.", "..KKKKKK.."]); c.rows(12, 23, ["B.B.B.B.", "BBBBBBBB"]); }, { shade: false }),
  one("Pirate", ["#e0a978", "#b98a5c", "#eec5a0"], ["#1c1a19", "#0e0d0c", "#3a3734"], (c) => { bust(c, B); headBox(c, A); c.rect(6, 1, 20, 6, B); c.rect(8, 0, 16, 1, B); c.rect(4, 5, 24, 2, B); c.outline(); c.rows(13, 2, ["W.W", "WWW", ".W.", "W.W"]); c.rect(18, 10, 5, 3, K); c.rect(9, 9, 9, 1, K); c.rect(11, 10, 3, 2, K); c.px(12, 10, W); c.rows(11, 15, ["KKKKKKKK", "KWKWKWKW"]); c.rect(12, 21, 8, 3, W); c.rect(2, 26, 28, 1, B); c.rect(2, 28, 28, 1, W); }),
  one("Samurai", ["#e6b08a", "#bd8b66", "#f1c9ac"], ["#b7282e", "#8a1e23", "#d4555a"], (c) => { bust(c, B); headBox(c, A); c.rect(8, 2, 16, 5, K); c.rect(7, 5, 18, 2, K); c.rows(11, 0, ["B........B", "BB......BB", ".BB....BB.", "..BBBBBB.."]); c.rect(14, 1, 4, 1, W); c.outline(); c.rect(8, 2, 16, 5, K); c.rows(11, 0, ["B........B", "BB......BB", ".BB....BB.", "..BBBBBB.."]); c.rect(14, 1, 4, 1, W); c.rect(11, 10, 3, 1, K); c.rect(18, 10, 3, 1, K); c.rect(10, 13, 12, 5, K); c.rect(11, 14, 10, 3, B); c.rect(12, 15, 8, 1, W); c.rect(12, 21, 8, 3, W); c.rect(2, 26, 28, 2, K); }, { shade: false }),
  one("Viking", ["#e6b08a", "#bd8b66", "#f1c9ac"], ["#8a6a48", "#65492f", "#a9885f"], (c) => { bust(c, B); headBox(c, A); c.rect(8, 3, 16, 6, ROLE.a); c.rows(4, 0, ["W.", "WW", ".WW", "..W"]); c.rows(26, 0, [".W", "WW", "WW.", "W.."]); c.rect(9, 17, 14, 8, ROLE.a); c.rect(12, 17, 8, 3, A); c.outline(); c.rect(8, 3, 16, 6, K); c.rect(9, 4, 14, 4, ROLE.a); c.rect(12, 10, 2, 2, K); c.rect(19, 10, 2, 2, K); c.rect(9, 15, 14, 9, ROLE.a); c.rect(13, 16, 6, 1, K); }, { shade: false }),
  one("Ninja", ["#1c1a19", "#0e0d0c", "#3a3734"], ["#e0a978", "#b98a5c", "#eec5a0"], (c) => { bust(c, A); headBox(c, A); c.rect(9, 9, 14, 4, B); c.outline(); c.rect(9, 9, 14, 4, B); c.rect(11, 10, 3, 2, K); c.rect(18, 10, 3, 2, K); c.px(12, 10, W); c.px(19, 10, W); c.rect(23, 6, 6, 2, A); c.rect(26, 8, 4, 2, A); c.rect(2, 27, 28, 1, ROLE.a); }, { shade: false }),
  one("Chef", ["#f3d6bd", "#d9b092", "#fbe9d9"], ["#f6f4ee", "#cfccc5", "#ffffff"], (c) => { bust(c, B); headBox(c, A); c.rect(9, 3, 14, 4, B); c.ellipse(11, 2, 4, 3, B); c.ellipse(16, 1, 4, 3, B); c.ellipse(21, 2, 4, 3, B); c.outline(); c.rect(12, 11, 2, 2, K); c.rect(19, 11, 2, 2, K); c.rows(11, 15, ["KK......KK", "KKKK..KKKK", "..KKKKKK.."]); c.rect(12, 21, 8, 3, B); c.px(14, 26, K); c.px(17, 26, K); c.px(14, 29, K); c.px(17, 29, K); }),
  one("Cyborg", ["#d39a68", "#ad7547", "#e4b78d"], ["#b9c2cc", "#8a949f", "#e1e7ec"], (c) => { bust(c, ROLE.a); headBox(c, A); c.outline(); c.rect(16, 4, 6, 17, B); c.rect(22, 5, 1, 15, ROLE.b); c.rect(12, 11, 2, 2, K); c.rect(17, 10, 4, 3, K); c.rect(18, 11, 2, 1, ROLE.L); c.rect(14, 16, 4, 1, K); c.rect(17, 16, 1, 1, ROLE.b); c.rect(18, 6, 3, 1, ROLE.b); c.rect(12, 21, 8, 3, A); }, { shade: false }),
  one("Jester", ["#e6b08a", "#bd8b66", "#f1c9ac"], ["#6e2f78", "#4d2054", "#93589c"], (c) => { bust(c, B); headBox(c, A); c.rows(4, 0, ["B.......B.......B", "BB.....BBB.....BB", "BBB...BBBBB...BBB", ".BBBBBBBBBBBBBBB.", "..BBBBBBBBBBBBB.."]); c.outline(); c.px(4, 0, W); c.px(12, 0, W); c.px(20, 0, W); c.rect(11, 10, 3, 3, W); c.rect(18, 10, 3, 3, W); c.px(12, 11, K); c.px(19, 11, K); c.rows(12, 15, ["K......K", ".KKKKKK."]); c.rect(12, 21, 8, 3, W); for (let y = 25; y < 31; y += 2) c.rect(2 + (y % 4 === 1 ? 0 : 3), y, 26, 1, ROLE.a); }),
  one("Pharaoh", ["#c98a5a", "#a06a40", "#d9a97e"], ["#e2b13c", "#b58a2a", "#f0d27a"], (c) => { bust(c, B); headBox(c, A); c.rect(6, 3, 20, 6, B); c.rect(6, 9, 4, 12, B); c.rect(22, 9, 4, 12, B); c.rect(6, 5, 20, 1, ROLE.b); c.rect(6, 12, 4, 1, ROLE.b); c.rect(22, 12, 4, 1, ROLE.b); c.rect(6, 16, 4, 1, ROLE.b); c.rect(22, 16, 4, 1, ROLE.b); c.outline(); c.rect(11, 10, 3, 2, K); c.rect(18, 10, 3, 2, K); c.rect(10, 9, 5, 1, K); c.rect(17, 9, 5, 1, K); c.rect(14, 16, 4, 1, K); c.rect(12, 21, 8, 3, A); c.rect(2, 26, 28, 2, ROLE.b); }),
  one("Lich", ["#efe9dc", "#c9c2b2", "#ffffff"], ["#2f9a63", "#217045", "#5cb888"], (c) => { bust(c, K); c.rect(9, 4, 14, 13, A); c.rect(10, 3, 12, 1, A); c.rect(11, 17, 10, 4, A); c.rows(9, 0, ["B..B......B..B", "BB.BB....BB.BB", "BBBBBBBBBBBBBB", "BBBBBBBBBBBBBB"]); c.outline(); c.rows(9, 0, ["B..B......B..B", "BB.BB....BB.BB", "BBBBBBBBBBBBBB"]); c.rect(11, 8, 4, 4, K); c.rect(17, 8, 4, 4, K); c.rect(12, 9, 2, 2, B); c.rect(18, 9, 2, 2, B); c.rect(15, 13, 2, 2, K); c.rect(12, 18, 8, 2, K); for (let x = 13; x < 20; x += 2) c.rect(x, 18, 1, 2, A); c.rect(2, 26, 28, 6, K); }),
  one("Jellyfish", ["#e0489a", "#b03676", "#ea7bb7"], ["#f6f4ee", "#cfccc5", "#ffffff"], (c) => { c.ellipse(16, 12, 11, 9, A); c.rect(5, 12, 22, 5, A); for (let x = 6; x < 26; x += 4) { c.rect(x, 17, 2, 8 + (x % 8 === 2 ? 4 : 0), A); } c.outline(); c.rect(11, 10, 3, 3, W); c.rect(18, 10, 3, 3, W); c.px(12, 11, K); c.px(19, 11, K); c.rows(13, 14, ["K....K", ".KKKK."]); c.ellipse(11, 6, 2, 1.5, ROLE.L); }),
  one("Octopus", ["#7a4bc2", "#583392", "#9c76d6"], ["#f6f4ee", "#cfccc5", "#ffffff"], (c) => { c.ellipse(16, 11, 10.5, 9.5, A); c.rect(6, 11, 20, 8, A); for (let x = 4; x < 28; x += 4) c.ellipse(x + 1, 24, 2, 6, A); c.outline(); c.rect(11, 9, 3, 4, W); c.rect(18, 9, 3, 4, W); c.px(12, 10, K); c.px(19, 10, K); c.rect(14, 15, 4, 1, K); for (let x = 4; x < 28; x += 4) c.px(x + 1, 27, ROLE.a); }),
  one("Lion", ["#d9a24a", "#ad7f35", "#e8be7a"], ["#8a5a2b", "#65401c", "#a97844"], (c) => { bust(c, A); c.ellipse(16, 12, 12, 11, B); c.ellipse(16, 12, 8.5, 8, A); c.outline(); c.ellipse(16, 12, 8.5, 8, A); c.rect(12, 10, 2, 2, K); c.rect(19, 10, 2, 2, K); c.ellipse(16, 15, 3, 2, ROLE.L); c.rect(15, 14, 2, 1, K); c.px(14, 16, K); c.px(17, 16, K); c.ellipse(8, 5, 2, 2, A); c.ellipse(24, 5, 2, 2, A); }),
  one("Tiger", ["#e8792f", "#b85a1e", "#f2a163"], ["#f6f4ee", "#cfccc5", "#ffffff"], (c) => { bust(c, A); c.ellipse(16, 12, 9.5, 9, A); c.ellipse(8, 5, 3, 3, A); c.ellipse(24, 5, 3, 3, A); c.outline(); for (const [x, y, w] of [[10, 6, 3], [19, 6, 3], [9, 9, 2], [21, 9, 2], [9, 13, 2], [21, 13, 2], [14, 5, 4]]) c.rect(x, y, w, 1, K); c.ellipse(16, 15, 4, 3, B); c.rect(12, 10, 2, 2, K); c.rect(19, 10, 2, 2, K); c.rect(15, 13, 2, 2, K); c.rect(14, 16, 4, 1, K); }),
  one("Rabbit", ["#f4f1ea", "#c9c5b8", "#ffffff"], ["#f0bfb0", "#d19787", "#f8dcd3"], (c) => { bust(c, A); c.ellipse(16, 13, 9, 8.5, A); c.ellipse(11, 2, 2.6, 6, A); c.ellipse(21, 2, 2.6, 6, A); c.outline(); c.ellipse(11, 2, 1.2, 4, B); c.ellipse(21, 2, 1.2, 4, B); c.rect(12, 11, 2, 2, K); c.rect(19, 11, 2, 2, K); c.rect(15, 14, 2, 1, B); c.rows(14, 15, ["K.K", ".K."]); c.rect(15, 17, 2, 2, W); c.px(15, 17, K); c.px(16, 17, K); }),
  one("Devil", ["#c0392b", "#8f2a20", "#d8695e"], ["#1c1a19", "#0e0d0c", "#3a3734"], (c) => { bust(c, B); headBox(c, A); c.rows(7, 0, ["A", "AA", "AAA"]); c.rows(22, 0, ["..A", ".AA", "AAA"]); c.outline(); c.rows(11, 9, ["KK..", ".KK."]); c.rows(18, 9, ["..KK", ".KK."]); c.rect(12, 11, 2, 1, K); c.rect(19, 11, 2, 1, K); c.rows(11, 15, ["K........K", ".KKKKKKKK.", "..W.W.W.W."]); c.rect(15, 3, 2, 1, ROLE.L); }),
  one("Angel", ["#f3d6bd", "#d9b092", "#fbe9d9"], ["#f6f4ee", "#cfccc5", "#ffffff"], (c) => { bust(c, B); headBox(c, A); c.ellipse(16, 1, 7, 1.6, ROLE.L); c.ellipse(16, 1, 5, 0.8, ROLE.none); c.rows(0, 20, ["BB......", "BBBB....", "BBBBBB..", ".BBBBBBB", "..BBBBBB", "...BBBB.", "....BB.."]); c.rows(24, 20, ["......BB", "....BBBB", "..BBBBBB", "BBBBBBB.", "BBBBBB..", ".BBBB...", "..BB...."]); c.outline(); c.ellipse(16, 1, 7, 1.6, ROLE.L); c.ellipse(16, 1, 5, 0.8, ROLE.none); c.rows(11, 11, ["K.K", ".K."].reverse()); c.rows(18, 11, ["K.K", ".K."].reverse()); c.rows(13, 15, ["K....K", ".KKKK."]); }),
  one("Snowman", ["#f6f4ee", "#cfccc5", "#ffffff"], ["#e8792f", "#b85a1e", "#f2a163"], (c) => { c.ellipse(16, 11, 9, 9, A); c.ellipse(16, 27, 13, 10, A); c.rect(10, 0, 12, 5, K); c.rect(8, 4, 16, 2, K); c.outline(); c.rect(10, 0, 12, 5, K); c.rect(8, 4, 16, 2, K); c.rect(12, 9, 2, 2, K); c.rect(19, 9, 2, 2, K); c.rect(15, 12, 5, 1, B); c.rect(15, 13, 3, 1, B); c.rows(12, 14, ["K.K.K.K.", ".K.K.K.K"]); c.rect(9, 19, 14, 2, B); c.rect(20, 19, 4, 6, B); c.px(15, 24, K); c.px(15, 27, K); c.px(15, 30, K); }),
  one("Sun", ["#f2b41c", "#c48f12", "#f7cf66"], ["#e8792f", "#b85a1e", "#f2a163"], (c) => { for (let i = 0; i < 12; i++) { const ang = (i / 12) * Math.PI * 2; c.rect(Math.round(16 + Math.cos(ang) * 13) - 1, Math.round(15 + Math.sin(ang) * 13) - 1, 3, 3, B); } c.ellipse(16, 15, 10, 10, A); c.outline(); c.ellipse(16, 15, 10, 10, A); c.rows(11, 12, ["K.K", ".K."].reverse()); c.rows(18, 12, ["K.K", ".K."].reverse()); c.rows(12, 17, ["K......K", ".KKKKKK."]); c.rect(9, 15, 2, 1, B); c.rect(21, 15, 2, 1, B); }),
  one("Moon", ["#e8e4d6", "#bcb8aa", "#f6f4ee"], ["#3a4a6b", "#2a3650", "#5c6c8c"], (c) => { c.rect(0, 0, 32, 32, ROLE.none); c.ellipse(16, 15, 11, 11, A); c.ellipse(22, 12, 8.5, 9, ROLE.none); c.outline(); for (const [x, y] of [[9, 9], [7, 17], [11, 22]]) c.ellipse(x, y, 1.6, 1.6, ROLE.a); c.rect(9, 13, 2, 2, K); c.rect(14, 15, 2, 2, K); c.rows(10, 19, ["K....K", ".KKKK."]); for (const [x, y] of [[26, 4], [28, 20], [24, 27], [3, 3]]) c.px(x, y, B); }),
  one("Cactus", ["#4f8f4c", "#3a6e39", "#74ab71"], ["#d9c9a3", "#b7a77f", "#e6dbc0"], (c) => { c.rect(12, 3, 8, 26, A); c.rect(4, 10, 4, 10, A); c.rect(4, 18, 8, 3, A); c.rect(24, 6, 4, 12, A); c.rect(20, 16, 8, 3, A); c.rect(2, 28, 28, 4, B); c.outline(); c.rect(2, 28, 28, 4, B); for (let y = 5; y < 27; y += 4) { c.px(13, y, ROLE.a); c.px(18, y + 2, ROLE.a); } c.rect(14, 9, 1, 2, K); c.rect(17, 9, 1, 2, K); c.rows(14, 13, ["K..K", ".KK."]); c.ellipse(16, 2, 2.5, 1.6, ROLE.L); c.px(16, 1, B); }),
  one("Toast", ["#e6c07a", "#b8944e", "#f0d8a6"], ["#b8763a", "#8a5527", "#cc9a63"], (c) => { c.rect(6, 8, 20, 22, B); c.ellipse(11, 8, 6, 5, B); c.ellipse(21, 8, 6, 5, B); c.outline(); c.rect(8, 11, 16, 17, A); c.rect(12, 16, 2, 2, K); c.rect(18, 16, 2, 2, K); c.rows(14, 21, ["K....K", ".KKKK."]); c.rect(12, 13, 8, 1, ROLE.L); }),
  one("Coffee", ["#f6f4ee", "#cfccc5", "#ffffff"], ["#5b3a22", "#3f2716", "#7f5636"], (c) => { c.rect(6, 9, 18, 18, A); c.rect(7, 27, 16, 2, A); c.rect(24, 12, 5, 9, A); c.rect(6, 9, 18, 3, B); c.outline(); c.rect(26, 14, 1, 5, ROLE.none); c.rect(6, 9, 18, 3, B); c.rect(12, 16, 2, 2, K); c.rect(18, 16, 2, 2, K); c.rows(14, 21, ["K....K", ".KKKK."]); c.rows(9, 2, ["W", ".W", "W", ".W"]); c.rows(19, 1, [".W", "W", ".W", "W"]); }),
  one("Tree", ["#2f7a43", "#215530", "#5a9c6a"], ["#7b5b3a", "#583f27", "#9c7c5b"], (c) => { c.ellipse(16, 8, 9, 7, A); c.ellipse(11, 14, 8, 6, A); c.ellipse(21, 14, 8, 6, A); c.rect(13, 20, 6, 12, B); c.outline(); c.rect(13, 20, 6, 12, B); c.rect(12, 21, 8, 1, K); c.rect(12, 10, 2, 2, K); c.rect(18, 10, 2, 2, K); c.rows(13, 14, ["K....K", ".KKKK."]); c.px(9, 6, ROLE.L); c.px(22, 7, ROLE.L); }),
  one("Cloud", ["#f6f4ee", "#cfccc5", "#ffffff"], ["#8fc1e8", "#6d9fc5", "#b6d8f2"], (c) => { c.ellipse(11, 14, 7, 6, A); c.ellipse(19, 10, 8, 7, A); c.ellipse(23, 16, 7, 6, A); c.rect(6, 14, 22, 7, A); c.outline(); c.rect(13, 11, 2, 2, K); c.rect(20, 11, 2, 2, K); c.rows(14, 15, ["K....K", ".KKKK."]); c.rect(12, 24, 1, 3, B); c.rect(17, 25, 1, 3, B); c.rect(22, 24, 1, 3, B); }),
  one("Mushroom", ["#c0392b", "#8f2a20", "#d8695e"], ["#f0e6d2", "#c9bfa9", "#f8f2e6"], (c) => { c.ellipse(16, 11, 13, 9, A); c.rect(3, 11, 26, 4, A); c.rect(11, 15, 10, 16, B); c.outline(); c.rect(11, 15, 10, 16, B); c.rect(10, 15, 12, 1, K); for (const [x, y] of [[7, 8], [13, 4], [21, 5], [25, 10], [16, 11]]) c.ellipse(x, y, 2, 2, W); c.rect(13, 20, 2, 2, K); c.rect(18, 20, 2, 2, K); c.rows(14, 24, ["K....K", ".KKKK."]); }),
  one("TV", ["#7b5b3a", "#583f27", "#9c7c5b"], ["#8fc1e8", "#6d9fc5", "#b6d8f2"], (c) => { c.rect(4, 8, 24, 20, A); c.rect(10, 4, 1, 4, K); c.rect(21, 4, 1, 4, K); c.px(9, 3, K); c.px(22, 3, K); c.rect(8, 28, 4, 3, A); c.rect(20, 28, 4, 3, A); c.outline(); c.rect(6, 10, 15, 16, B); c.rect(23, 11, 3, 3, K); c.rect(23, 16, 3, 3, K); c.rect(9, 14, 2, 2, K); c.rect(15, 14, 2, 2, K); c.rows(10, 19, ["K....K", ".KKKK."]); c.rect(7, 11, 13, 1, ROLE.L); }),
  one("Dice", ["#f6f4ee", "#cfccc5", "#ffffff"], ["#d1262f", "#9c1b22", "#e2606a"], (c) => { c.rect(5, 5, 22, 22, A); c.rect(6, 4, 20, 1, A); c.rect(6, 27, 20, 1, A); c.rect(4, 6, 1, 20, A); c.rect(27, 6, 1, 20, A); c.outline(); c.rect(8, 8, 3, 3, B); c.rect(21, 8, 3, 3, B); c.rect(8, 21, 3, 3, B); c.rect(21, 21, 3, 3, B); c.rect(11, 13, 2, 2, K); c.rect(19, 13, 2, 2, K); c.rows(13, 17, ["K....K", ".KKKK."]); }),
  one("Planet", ["#e07b39", "#b25d27", "#ea9d6a"], ["#f6f4ee", "#cfccc5", "#ffffff"], (c) => { c.ellipse(16, 15, 10, 10, A); c.outline(); for (let x = 0; x < 32; x++) { const y = Math.round(20 - (x - 16) * 0.25); c.px(x, y, B); c.px(x, y + 1, B); } c.ellipse(16, 15, 9, 9, A); c.rect(12, 12, 2, 2, K); c.rect(19, 12, 2, 2, K); c.rows(13, 16, ["K....K", ".KKKK."]); c.ellipse(11, 9, 2, 1.4, ROLE.a); c.ellipse(20, 20, 2.5, 1.6, ROLE.a); for (let x = 0; x < 32; x++) { const y = Math.round(20 - (x - 16) * 0.25); if (x < 7 || x > 25) { c.px(x, y, B); c.px(x, y + 1, B); } } }),
  one("Cassette", ["#1c1a19", "#0e0d0c", "#3a3734"], ["#e2b13c", "#b58a2a", "#f0d27a"], (c) => { c.rect(3, 8, 26, 18, A); c.outline(); c.rect(6, 11, 20, 8, B); c.ellipse(11, 15, 2.8, 2.8, W); c.ellipse(21, 15, 2.8, 2.8, W); c.px(11, 15, K); c.px(21, 15, K); c.rect(8, 21, 16, 3, ROLE.a); c.rect(12, 22, 2, 1, W); c.rect(18, 22, 2, 1, W); c.rows(14, 22, ["KKKK"]); }),
  one("Penguin", ["#1c1a19", "#0e0d0c", "#3a3734"], ["#f6f4ee", "#cfccc5", "#ffffff"], (c) => { c.ellipse(16, 18, 11, 13, A); c.ellipse(16, 9, 8, 7, A); c.outline(); c.ellipse(16, 20, 7, 9, B); c.rect(11, 8, 3, 3, W); c.rect(18, 8, 3, 3, W); c.px(12, 9, K); c.px(19, 9, K); c.rows(14, 11, ["AAAA", ".AA."].map((r) => r.replace(/A/g, "B"))); c.rect(14, 11, 4, 1, ROLE.a); c.rect(14, 12, 4, 2, ROLE.none); c.rows(14, 11, ["BBBB", ".BB."]); }),
  one("Sushi", ["#f6f4ee", "#cfccc5", "#ffffff"], ["#e8792f", "#b85a1e", "#f2a163"], (c) => { c.rect(4, 12, 24, 14, A); c.rect(5, 11, 22, 1, A); c.rect(5, 26, 22, 1, A); c.ellipse(16, 10, 12, 4.5, B); c.rect(12, 6, 8, 20, K); c.outline(); c.rect(12, 6, 8, 20, K); c.ellipse(16, 10, 11, 4, B); c.rect(9, 17, 2, 2, K); c.rect(21, 17, 2, 2, K); c.rows(14, 20, ["K..K", ".KK."]); c.rect(6, 22, 20, 1, ROLE.a); }),
  one("Bot mk2", ["#3a4a6b", "#2a3650", "#5c6c8c"], ["#2fa06a", "#217045", "#5cb888"], (c) => { bust(c, A); c.rect(8, 4, 16, 16, A); c.rect(6, 9, 2, 6, A); c.rect(24, 9, 2, 6, A); c.rect(14, 1, 4, 3, A); c.outline(); c.rect(10, 8, 12, 5, K); c.rect(11, 9, 10, 3, B); c.rect(12, 10, 2, 1, W); c.rect(18, 10, 2, 1, W); c.rect(12, 15, 8, 2, K); c.rect(13, 16, 6, 1, B); c.px(15, 0, B); c.rect(13, 25, 6, 5, K); c.rect(14, 26, 4, 3, B); }, { shade: false }),
];

export const SLOTS: Slot[] = [
  { slot: "background", trait: "Background", pinnable: true, group: "bg", items: BACKGROUNDS },
  { slot: "top", trait: "Top", pinnable: true, group: "top", items: TOPS },
  { slot: "head", trait: "Head", pinnable: true, group: "skin", items: HEADS },
  { slot: "eyes", trait: "Eyes", pinnable: true, group: "eyes", items: EYES },
  { slot: "mouth", trait: "Mouth", pinnable: true, group: "mouth", items: MOUTHS },
  { slot: "accessory", trait: "Accessory", pinnable: true, group: "acc", items: ACCESSORIES },
  { slot: "hair", trait: "Hair", pinnable: true, group: "hair", items: HAIR },
];
