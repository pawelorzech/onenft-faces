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

// ---------------------------------------------------------------- tops: A cloth, B skin
const shoulders = (c: Canvas) => { c.rect(4, 26, 24, 6, A); c.rect(6, 25, 20, 1, A); c.rect(8, 24, 16, 1, A); c.rect(10, 23, 12, 1, A); };
const neck = (c: Canvas) => { c.rect(13, 21, 6, 5, B); };
export const TOPS: Item[] = [
  item("Tee", "common", (c) => { shoulders(c); neck(c); c.rect(12, 23, 8, 1, B); }, { outline: true, shade: true }),
  item("V-neck", "common", (c) => { shoulders(c); neck(c); c.rows(12, 23, ["BBBBBBBB", ".BBBBBB.", "..BBBB.", "...BB..."]); }, { outline: true, shade: true }),
  item("Hoodie", "common", (c) => { c.rect(9, 20, 14, 4, A); shoulders(c); neck(c); c.rect(12, 22, 8, 1, B); c.rect(11, 26, 1, 6, W); c.rect(20, 26, 1, 6, W); }, { outline: true, shade: true }),
  item("Collar", "common", (c) => { shoulders(c); neck(c); c.rows(10, 23, ["WWW....WWW", ".WWW..WWW.", "..WW..WW..", "...WWWW..."]); }, { outline: true, shade: true }),
  item("Tank", "uncommon", (c) => { c.rect(4, 26, 24, 6, B); c.rect(6, 25, 20, 1, B); c.rect(8, 24, 16, 1, B); c.rect(10, 23, 12, 1, B); c.rect(9, 27, 14, 5, A); c.rect(10, 24, 2, 3, A); c.rect(20, 24, 2, 3, A); neck(c); }, { outline: true, shade: true }),
  item("Turtleneck", "uncommon", (c) => { shoulders(c); c.rect(12, 20, 8, 5, A); c.rect(12, 20, 8, 1, a); }, { outline: true, shade: true }),
  item("Suit", "uncommon", (c) => { shoulders(c); neck(c); c.rows(11, 23, ["WWW....WWW", "AWWW..WWWA", "AAWW..WWAA", "AAAWWWWAAA", "AAAAKKAAAA", "AAAAKKAAAA"]); }, { outline: true, shade: true }),
  item("Jersey", "uncommon", (c) => { shoulders(c); neck(c); c.rect(12, 23, 8, 1, B); c.rect(4, 28, 24, 1, W); c.rect(4, 30, 24, 1, W); }, { outline: true, shade: true }),
  item("Robe", "rare", (c) => { c.rect(3, 24, 26, 8, A); c.rect(5, 23, 22, 1, A); c.rect(8, 22, 16, 1, A); neck(c); c.rows(12, 22, ["BBBBBBBB", "W.BBBB.W", "W..BB..W", "W..BB..W", "W..BB..W", "W..BB..W"]); }, { outline: true, shade: true }),
  item("Armor", "rare", (c) => { shoulders(c); c.rect(3, 25, 5, 4, A); c.rect(24, 25, 5, 4, A); neck(c); c.rect(12, 23, 8, 1, B); c.rect(14, 26, 4, 4, W); c.rect(15, 27, 2, 2, A); }, { outline: true, shade: true }),
  item("Bare", "uncommon", (c) => { c.rect(4, 26, 24, 6, B); c.rect(6, 25, 20, 1, B); c.rect(8, 24, 16, 1, B); c.rect(10, 23, 12, 1, B); neck(c); }, { outline: true, shade: true }),
  item("Overalls", "uncommon", (c) => { c.rect(4, 26, 24, 6, B); c.rect(6, 25, 20, 1, B); c.rect(8, 24, 16, 1, B); c.rect(10, 23, 12, 1, B); neck(c); c.rect(10, 24, 2, 8, A); c.rect(20, 24, 2, 8, A); c.rect(9, 28, 14, 4, A); c.px(11, 28, W); c.px(20, 28, W); }, { outline: true, shade: true }),
];

// ---------------------------------------------------------------- heads: A skin
const ears = (c: Canvas) => { c.ellipse(7, 13.5, 2.4, 2.8, A); c.ellipse(25, 13.5, 2.4, 2.8, A); };
const neckSkin = (c: Canvas) => c.rect(13, 19, 6, 5, A);
export const HEADS: Item[] = [
  item("Round", "common", (c) => { neckSkin(c); ears(c); c.ellipse(16, 12.5, 8.2, 9.2, A); }, { outline: true, shade: true }),
  item("Square", "common", (c) => { neckSkin(c); ears(c); c.rect(8, 4, 16, 17, A); c.rect(9, 3, 14, 1, A); c.rect(9, 21, 14, 1, A); }, { outline: true, shade: true }),
  item("Long", "common", (c) => { neckSkin(c); ears(c); c.ellipse(16, 12.5, 7.2, 10.2, A); }, { outline: true, shade: true }),
  item("Wide", "common", (c) => { neckSkin(c); ears(c); c.ellipse(16, 13, 9.2, 8.4, A); }, { outline: true, shade: true }),
  item("Chin", "uncommon", (c) => { neckSkin(c); ears(c); c.ellipse(16, 11, 8.2, 8, A); c.rows(9, 16, ["AAAAAAAAAAAAAA", ".AAAAAAAAAAAA.", "..AAAAAAAAAA..", "...AAAAAAAA...", "....AAAAAA...."]); }, { outline: true, shade: true }),
  item("Egg", "uncommon", (c) => { neckSkin(c); ears(c); c.ellipse(16, 10, 7.5, 8, A); c.ellipse(16, 14, 8.2, 8, A); }, { outline: true, shade: true }),
  item("Heart", "rare", (c) => { neckSkin(c); ears(c); c.ellipse(12, 9, 5.2, 5.2, A); c.ellipse(20, 9, 5.2, 5.2, A); c.rows(7, 9, ["AAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAA", ".AAAAAAAAAAAAAAAA.", ".AAAAAAAAAAAAAAAA.", "..AAAAAAAAAAAAAA..", "...AAAAAAAAAAAA...", "....AAAAAAAAAA....", ".....AAAAAAAA.....", "......AAAAAA......", ".......AAAA......."]); }, { outline: true, shade: true }),
  item("Block", "rare", (c) => { neckSkin(c); c.rect(7, 3, 18, 19, A); }, { outline: true, shade: true }),
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
];

// ---------------------------------------------------------------- hair or hat: A hair, B hat accent
export const HAIR: Item[] = [
  item("Bald", "common", () => {}),
  item("Short", "common", (c) => { c.ellipse(16, 8, 8.5, 5.5, A); c.rect(8, 8, 16, 3, A); }, { outline: true, shade: true }),
  item("Part", "common", (c) => { c.ellipse(16, 8, 8.5, 5.5, A); c.rect(8, 8, 16, 3, A); c.rect(7, 9, 3, 5, A); c.px(15, 4, a); c.px(16, 5, a); }, { outline: true, shade: true }),
  item("Long", "common", (c) => { c.ellipse(16, 8, 8.8, 5.8, A); c.rect(7, 8, 3, 14, A); c.rect(22, 8, 3, 14, A); c.rect(8, 8, 16, 2, A); }, { outline: true, shade: true }),
  item("Curly", "common", (c) => { for (const [x, y] of [[9, 8], [12, 5], [16, 4], [20, 5], [23, 8], [8, 12], [24, 12]]) c.ellipse(x, y, 3.2, 3.2, A); c.rect(9, 6, 14, 5, A); }, { outline: true, shade: true }),
  item("Afro", "uncommon", (c) => { c.ellipse(16, 9, 11.5, 9.5, A); c.rect(9, 12, 14, 3, A); }, { outline: true, shade: true }),
  item("Mohawk", "uncommon", (c) => { c.rect(14, 0, 4, 7, A); c.rect(13, 3, 6, 4, A); }, { outline: true, shade: true }),
  item("Bun", "uncommon", (c) => { c.ellipse(16, 8, 8.5, 5.5, A); c.rect(8, 8, 16, 3, A); c.ellipse(16, 2.5, 3.2, 2.6, A); }, { outline: true, shade: true }),
  item("Bob", "common", (c) => { c.ellipse(16, 8, 9, 6, A); c.rect(7, 8, 18, 8, A); c.rect(9, 12, 14, 4, ROLE.none); c.rect(8, 8, 16, 3, A); }, { outline: true, shade: true }),
  item("Spiky", "uncommon", (c) => { c.rows(8, 1, ["...A..A..A.A....", "..AA.AAA.AAAA...", ".AAAAAAAAAAAAA..", "AAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAA", ".AAAAAAAAAAAAAA."]); }, { outline: true, shade: true }),
  item("Beanie", "common", (c) => { c.ellipse(16, 8, 9.2, 6.4, B); c.rect(7, 8, 18, 3, B); c.rect(7, 9, 18, 2, b); }, { outline: true, shade: true }),
  item("Cap", "common", (c) => { c.ellipse(16, 7, 8.6, 5, B); c.rect(8, 7, 16, 3, B); c.rect(6, 9, 20, 2, B); c.rect(20, 9, 8, 2, b); }, { outline: true, shade: true }),
  item("Backwards cap", "uncommon", (c) => { c.ellipse(16, 7, 8.6, 5, B); c.rect(8, 7, 16, 3, B); c.rect(4, 8, 6, 2, b); }, { outline: true, shade: true }),
  item("Top hat", "uncommon", (c) => { c.rect(10, 0, 12, 9, B); c.rect(6, 8, 20, 2, B); c.rect(10, 6, 12, 2, b); }, { outline: true, shade: true }),
  item("Crown", "rare", (c) => { c.rows(8, 2, ["B...B...B...B..B", "B...B...B...B..B", "BB.BBB.BBB.BBB.B", "BBBBBBBBBBBBBBBB", "BBBBBBBBBBBBBBBB", "BBBBBBBBBBBBBBBB"]); c.px(11, 6, W); c.px(16, 6, W); c.px(21, 6, W); }, { outline: true }),
  item("Bandana", "common", (c) => { c.ellipse(16, 7.5, 8.6, 5.2, B); c.rect(8, 7, 16, 3, B); c.rows(23, 8, ["BB", ".BB", "..BB", "...B"]); }, { outline: true, shade: true }),
  item("Headband", "common", (c) => { c.rect(8, 6, 16, 2, B); c.rect(7, 7, 18, 1, B); }, { outline: true }),
  item("Horns", "rare", (c) => { c.rows(4, 0, ["BB....", "BBB...", ".BBB..", "..BBB.", "...BBB", "....BB"]); c.rows(22, 0, ["....BB", "...BBB", "..BBB.", ".BBB..", "BBB...", "BB...."]); }, { outline: true }),
  item("Halo", "legendary", (c) => { c.ellipse(16, 2.5, 8, 2.4, B); c.ellipse(16, 2.5, 5.5, 1.2, ROLE.none); }, { outline: true }),
  item("Wizard", "legendary", (c) => { for (let y = 0; y < 9; y++) c.rect(16 - Math.floor(y * 0.9) - 1, y, 2 + Math.floor(y * 0.9) * 2, 1, B); c.rect(5, 9, 22, 2, B); c.rect(9, 8, 14, 1, b); c.px(16, 2, W); c.px(14, 5, W); }, { outline: true, shade: true }),
  item("Beret", "uncommon", (c) => { c.ellipse(15, 6, 9.5, 4, B); c.rect(8, 7, 16, 2, B); c.px(14, 1, B); }, { outline: true, shade: true }),
  item("Bucket", "uncommon", (c) => { c.rect(9, 3, 14, 6, B); c.rect(6, 8, 20, 2, B); c.rect(9, 7, 14, 1, b); }, { outline: true, shade: true }),
  item("Helmet", "rare", (c) => { c.ellipse(16, 8, 9.5, 7, B); c.rect(6, 8, 20, 4, B); c.rect(9, 12, 14, 2, B); c.rect(6, 11, 20, 1, b); }, { outline: true, shade: true }),
  item("Pigtails", "uncommon", (c) => { c.ellipse(16, 8, 8.5, 5.5, A); c.rect(8, 8, 16, 3, A); c.ellipse(6, 14, 2.5, 5, A); c.ellipse(26, 14, 2.5, 5, A); }, { outline: true, shade: true }),
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
