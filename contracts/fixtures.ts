/**
 * Generates the data blobs the deploy script writes into DataStore contracts and
 * the fixtures for the TS ↔ Solidity byte-equality tests. TypeScript is the
 * source of truth.
 *
 * Sprites: 384 bytes each, slot items in SLOTS order then the 1/1s, PER_STORE
 * per store. Meta, in order: u8 slot count; per slot u8 item count, u8 pinnable,
 * u8 group; per slot u16 weights then u8 tiers (low nibble tier, bit 4 hides the mouth); skins u8 count then per skin u16
 * weight, u8 tier, 9 bytes rgb (main, shade, light); hair, top, ground and
 * accent colours as u8 count then 9 bytes each; 1/1s as u8 count then 18 bytes
 * each; then length-prefixed names: slot traits, every item in order, skins,
 * hair colours, top colours, grounds, accents, 1/1s.
 */
import { Canvas } from "../src/pixels.ts";
import { SLOTS, ONE_OF_ONES } from "../src/sprites.ts";
import { WEIGHTS, SKIN_WEIGHTS, SKINS, HAIRS, TOPCOLORS, GROUNDS, ACCENTS, face, packPins, luckyOf, metadataOf, traitsOf, type Pins } from "../src/faces.ts";

export const PER_STORE = 63;
const TIER = { common: 0, uncommon: 1, rare: 2, legendary: 3 } as const;
const GROUP = { bg: 0, top: 1, skin: 2, eyes: 3, mouth: 4, hair: 5, acc: 6 } as const;

const sprites: Uint8Array[] = [];
for (const s of SLOTS) for (const it of s.items) sprites.push(Canvas.fromRows(it.rows).encode());
for (const o of ONE_OF_ONES) sprites.push(Canvas.fromRows(o.rows).encode());
const hexOf = (b: Uint8Array | number[]) => "0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
const stores: string[] = [];
for (let i = 0; i < sprites.length; i += PER_STORE) stores.push(hexOf(sprites.slice(i, i + PER_STORE).flatMap((b) => Array.from(b))));

const meta: number[] = [];
const u8 = (v: number) => { if (v < 0 || v > 255) throw new Error(`u8 ${v}`); meta.push(v); };
const u16 = (v: number) => meta.push(v >> 8, v & 255);
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); meta.push(n >> 16, (n >> 8) & 255, n & 255); };
const swatch = (s: { main: string; shade: string; light: string }) => { rgb(s.main); rgb(s.shade); rgb(s.light); };
const name = (n: string) => { const b = Buffer.from(n, "utf8"); u8(b.length); meta.push(...b); };
u8(SLOTS.length);
for (const s of SLOTS) { u8(s.items.length); u8(s.pinnable ? 1 : 0); u8(GROUP[s.group]); }
// tier byte: low nibble the tier, bit 4 set when the item hides the mouth
SLOTS.forEach((s, k) => { for (const w of WEIGHTS[k]) u16(w); for (const it of s.items) u8(TIER[it.tier] | (it.hidesMouth ? 0x10 : 0)); });
u8(SKINS.length); SKINS.forEach((s, i) => { u16(SKIN_WEIGHTS[i]); u8(TIER[s.tier]); swatch(s); });
for (const list of [HAIRS, TOPCOLORS, GROUNDS, ACCENTS]) { u8(list.length); for (const s of list) swatch(s); }
u8(ONE_OF_ONES.length); for (const o of ONE_OF_ONES) { for (const h of o.main) rgb(h); for (const h of o.second) rgb(h); }
for (const s of SLOTS) name(s.trait);
for (const s of SLOTS) for (const it of s.items) name(it.name);
for (const list of [SKINS, HAIRS, TOPCOLORS, GROUNDS, ACCENTS]) for (const s of list) name(s.name);
for (const o of ONE_OF_ONES) name(o.name);

await Bun.write(new URL("./test/fixtures/faces_data.json", import.meta.url).pathname, JSON.stringify({ stores, meta: hexOf(meta), sprites: sprites.length, perStore: PER_STORE }));

// Fixtures: seeds with no pins, with pins, and forced 1/1s.
const cases: { seed: bigint; pins: Pins; one?: number }[] = [];
for (let i = 1; i <= 12; i++) cases.push({ seed: BigInt(i) * 0x9e3779b97f4a7c15n % (1n << 64n), pins: {} });
cases.push({ seed: 77n, pins: { background: 4 } }, { seed: 78n, pins: { hair: 12, eyes: 8 } }, { seed: 79n, pins: { background: 0, top: 2, eyes: 1 } }, { seed: 80n, pins: { skin: 2, hair: 5 } }, { seed: 81n, pins: { hairColour: 3, ground: 7 } }, { seed: 82n, pins: { background: 1, eyes: 2, skin: 0, ground: 12 } }, { seed: 83n, pins: { head: 1, mouth: 2, accessory: 3, topColour: 4, accent: 5 } }, { seed: 84n, pins: { background: 0, top: 0, head: 0, eyes: 0, mouth: 0, accessory: 0, hair: 1, skin: 0, hairColour: 0, ground: 0, topColour: 0, accent: 0 } });
for (let i = 0; i < ONE_OF_ONES.length; i++) cases.push({ seed: 1000n + BigInt(i), pins: {}, one: i });
// A seed whose accessory is the mask, so the mouth-hiding rule is covered.
{ const acc = SLOTS.findIndex((x) => x.slot === "accessory"); const mask = SLOTS[acc].items.findIndex((i) => i.name === "Mask"); for (let s = 1n; s < 100000n; s++) { const t = traitsOf(s); if (t.items[acc] === mask) { cases.push({ seed: s, pins: { mouth: 3 } }); break; } } }
// Find a naturally lucky seed so the contract path is covered too.
let lucky = 0n; for (let s = 1n; s < 200000n; s++) if (luckyOf(s, ONE_OF_ONES.length, 10000) !== undefined) { lucky = s; break; }
if (lucky) cases.push({ seed: lucky, pins: {}, one: luckyOf(lucky, ONE_OF_ONES.length, 10000) });
const fixtures = cases.map((c) => {
  const f = face(c.seed, c.pins, c.one);
  return { seed: c.seed.toString(), pins: packPins(c.pins).toString(), one: c.one ?? 255, svg: f.svg, json: metadataOf(1, f.traits), attributes: f.attributes.map((a) => ({ type: a.trait_type, value: a.value, tier: a.tier ?? "" })), items: f.traits.items, colours: [f.traits.skin, f.traits.hair, f.traits.top, f.traits.ground, f.traits.accent] };
});
await Bun.write(new URL("./test/fixtures/faces_cases.json", import.meta.url).pathname, JSON.stringify(fixtures, null, 1));

// Coverage: for every slot item and every colour, a seed that draws it (found by search), plus every 1/1 index.
// The Solidity test renders each through tokenURI so no index of the meta blob is left unreached.
const cover: { seed: string; pins: string; one: number; what: string }[] = [];
const need = new Map<string, boolean>();
SLOTS.forEach((sl, k) => sl.items.forEach((_, i) => need.set(`${k}:${i}`, false)));
SKINS.forEach((_, i) => need.set(`skin:${i}`, false)); HAIRS.forEach((_, i) => need.set(`hair:${i}`, false)); TOPCOLORS.forEach((_, i) => need.set(`top:${i}`, false)); GROUNDS.forEach((_, i) => need.set(`ground:${i}`, false)); ACCENTS.forEach((_, i) => need.set(`accent:${i}`, false));
for (let seed = 1n; seed < 2_000_000n && [...need.values()].some((v) => !v); seed++) {
  const t = traitsOf(seed);
  const keys = [...t.items.map((it, k) => `${k}:${it}`), `skin:${t.skin}`, `hair:${t.hair}`, `top:${t.top}`, `ground:${t.ground}`, `accent:${t.accent}`];
  const fresh = keys.filter((k) => need.get(k) === false);
  if (fresh.length) { fresh.forEach((k) => need.set(k, true)); cover.push({ seed: seed.toString(), pins: packPins({}).toString(), one: 255, what: fresh.join(" ") }); }
}
const missing = [...need].filter(([, v]) => !v).map(([k]) => k);
for (let i = 0; i < ONE_OF_ONES.length; i++) cover.push({ seed: "5", pins: packPins({}).toString(), one: i, what: `one:${i}` });
await Bun.write(new URL("./test/fixtures/faces_coverage.json", import.meta.url).pathname, JSON.stringify(cover));
console.log(`${cover.length} coverage cases${missing.length ? ", UNREACHED: " + missing.join(" ") : ", every index reached"}`);
console.log(`${sprites.length} sprites in ${stores.length} stores, meta ${meta.length} bytes, ${fixtures.length} cases, lucky seed ${lucky}`);
