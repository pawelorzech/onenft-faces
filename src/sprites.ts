/**
 * The sprite set, drawn with the Canvas DSL. Every item is a 32x32 layer of
 * roles (see pixels.ts). Slots composite in the order listed in SLOTS.
 *
 * Tiers set the weight tables in faces.ts: common, uncommon, rare, legendary.
 * Pinnable slots are marked; a pin may name common or uncommon items only.
 */
import { Canvas, ROLE } from "./pixels.ts";
const { K, A, a, L, B, b, W } = ROLE;

export type Tier = "common" | "uncommon" | "rare" | "legendary";
export type Item = { name: string; tier: Tier; rows: string[] };
export type Slot = { slot: string; trait: string; pinnable: boolean; group: "bg" | "top" | "skin" | "eyes" | "mouth" | "hair" | "acc"; items: Item[] };

type Draw = (c: Canvas) => void;
function item(name: string, tier: Tier, draw: Draw, opts: { outline?: boolean; shade?: boolean } = {}): Item {
  const c = new Canvas();
  draw(c);
  if (opts.outline) c.outline();
  if (opts.shade) c.shadeRight();
  return { name, tier, rows: c.toRows() };
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
  item("Mask", "rare", (c) => { c.rect(10, 15, 12, 5, B); c.rect(10, 15, 12, 1, b); c.rect(8, 16, 2, 1, B); c.rect(22, 16, 2, 1, B); }),
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
export const ONE_OF_ONES: OneOfOne[] = [
  one("Robot", ["#b9c2cc", "#8a949f", "#e1e7ec"], ["#e2b13c", "#b58a2a", "#f0d27a"], (c) => { bust(c, B); c.rect(9, 5, 14, 15, A); c.rect(15, 1, 2, 4, A); c.px(15, 0, B); c.px(16, 0, B); c.rect(7, 10, 2, 4, A); c.rect(23, 10, 2, 4, A); c.outline(); c.rect(11, 9, 3, 3, B); c.rect(18, 9, 3, 3, B); c.px(12, 10, W); c.px(19, 10, W); c.rect(12, 15, 8, 2, K); for (let x = 13; x < 20; x += 2) c.px(x, 15, W); c.rect(21, 6, 1, 13, a); }, { shade: false }),
  one("Skull", ["#efe9dc", "#c9c2b2", "#ffffff"], ["#2a2320", "#171311", "#4a403b"], (c) => { bust(c, B); c.rect(9, 4, 14, 13, A); c.rect(10, 3, 12, 1, A); c.rect(11, 2, 10, 1, A); c.rect(11, 17, 10, 4, A); c.outline(); c.rect(11, 8, 4, 4, K); c.rect(17, 8, 4, 4, K); c.px(15, 13, K); c.px(16, 13, K); c.px(15, 14, K); c.px(16, 14, K); c.rect(12, 18, 8, 2, K); for (let x = 13; x < 20; x += 2) c.rect(x, 18, 1, 2, A); }),
  one("Ghost", ["#f3f1ea", "#d2cec2", "#ffffff"], ["#8fc1e8", "#6d9fc5", "#b6d8f2"], (c) => { c.ellipse(16, 11, 10, 10, A); c.rect(6, 11, 20, 16, A); for (let x = 6; x < 26; x += 4) c.rect(x, 27, 2, 3, A); c.outline(); c.rect(11, 9, 3, 4, K); c.rect(18, 9, 3, 4, K); c.px(12, 10, W); c.px(19, 10, W); c.ellipse(16, 17, 2.5, 2, K); }),
  one("Cat", ["#e8a24a", "#bd7c2f", "#f2c07a"], ["#f3f1ea", "#d2cec2", "#ffffff"], (c) => { bust(c, A); c.rect(8, 6, 16, 14, A); c.rect(9, 5, 14, 1, A); c.rows(7, 1, ["AA.....", "AAA....", "AAAA...", "AAAAA..", "AAAAAA."]); c.rows(19, 1, [".....AA", "....AAA", "...AAAA", "..AAAAA", ".AAAAAA"]); c.outline(); c.px(9, 3, B); c.px(22, 3, B); c.rect(11, 10, 3, 3, W); c.rect(18, 10, 3, 3, W); c.px(12, 11, K); c.px(19, 11, K); c.rect(12, 10, 1, 1, K); c.rect(15, 14, 2, 1, K); c.rect(13, 15, 6, 2, B); c.px(15, 16, K); c.px(16, 16, K); c.rect(9, 14, 3, 1, K); c.rect(20, 14, 3, 1, K); c.rect(4, 26, 4, 6, W); c.rect(24, 26, 4, 6, W); }),
  one("Astronaut", ["#f3f1ea", "#c9c5b8", "#ffffff"], ["#2c6fb0", "#205687", "#5b91c6"], (c) => { bust(c, A); c.rect(1, 25, 5, 5, A); c.rect(26, 25, 5, 5, A); c.ellipse(16, 11, 10.5, 10.5, A); c.outline(); c.ellipse(16, 11, 7.5, 7.5, K); c.rect(11, 6, 5, 3, B); c.rect(10, 9, 3, 4, B); c.rect(14, 27, 4, 3, B); c.px(15, 28, W); }),
];

export const SLOTS: Slot[] = [
  { slot: "background", trait: "Background", pinnable: true, group: "bg", items: BACKGROUNDS },
  { slot: "top", trait: "Top", pinnable: true, group: "top", items: TOPS },
  { slot: "head", trait: "Head", pinnable: false, group: "skin", items: HEADS },
  { slot: "eyes", trait: "Eyes", pinnable: true, group: "eyes", items: EYES },
  { slot: "mouth", trait: "Mouth", pinnable: false, group: "mouth", items: MOUTHS },
  { slot: "accessory", trait: "Accessory", pinnable: false, group: "acc", items: ACCESSORIES },
  { slot: "hair", trait: "Hair", pinnable: true, group: "hair", items: HAIR },
];
