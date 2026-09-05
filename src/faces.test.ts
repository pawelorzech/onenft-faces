import { test, expect } from "bun:test";
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { Canvas } from "./pixels.ts";
import { WEIGHTS, SKIN_WEIGHTS, SKINS, traitsOf, luckyOf, pinOk, packPins, unpackPins, face, svgOf, metadataOf, rarityOf, PINNABLE, mix64 } from "./faces.ts";

test("every weight table sums to 10,000 and follows the tiers", () => {
  for (const w of [...WEIGHTS, SKIN_WEIGHTS]) expect(w.reduce((a, b) => a + b, 0)).toBe(10000);
  SLOTS.forEach((s, k) => s.items.forEach((it, i) => { if (it.tier === "legendary") expect(WEIGHTS[k][i]).toBeLessThan(40); if (it.tier === "common") expect(WEIGHTS[k][i]).toBeGreaterThan(200); }));
});

test("sprites round-trip through the 3-bit chain format", () => {
  for (const s of SLOTS) for (const it of s.items) {
    const c = Canvas.fromRows(it.rows);
    expect(Canvas.decode(c.encode()).toRows()).toEqual(c.toRows());
    expect(c.encode().length).toBe(384);
  }
});

test("mix64 matches the known splitmix64 finalizer", () => {
  expect(mix64(0n)).toBe(0xe220a8397b1dcdafn);
  expect(mix64(1n)).toBe(0x910a2dec89025cc1n);
});

test("a seed always gives the same traits; pins replace pinnable slots only", () => {
  const a = traitsOf(42n), b = traitsOf(42n);
  expect(a).toEqual(b);
  const p = traitsOf(42n, { hair: 1, background: 0 });
  expect(p.items[SLOTS.findIndex((s) => s.slot === "hair")]).toBe(1);
  expect(p.items[0]).toBe(0);
  expect(p.skin).toBe(a.skin);
  expect(() => traitsOf(42n, { head: 0 })).toThrow();
  expect(() => traitsOf(42n, { mouth: 0 })).toThrow();
});

test("rare and legendary items cannot be pinned", () => {
  SLOTS.forEach((s, k) => s.items.forEach((it, i) => expect(pinOk(k, i)).toBe(s.pinnable && (it.tier === "common" || it.tier === "uncommon"))));
  expect(pinOk(0, 999)).toBe(false);
});

test("pins pack to one byte per key: four slots, skin, hair colour, ground, one spare", () => {
  expect(PINNABLE.length).toBe(4);
  expect(packPins({})).toBe(0xffffffffffffffffn);
  const pins = { background: 3, hair: 7, skin: 2, hairColour: 4, ground: 9 };
  expect(unpackPins(packPins(pins))).toEqual(pins);
  expect(packPins({ background: 3 })).toBe(0x03ffffffffffffffn);
  expect(packPins({ skin: 1 })).toBe(0xffffffff01ffffffn);
  expect(packPins({ hairColour: 2, ground: 5 })).toBe(0xffffffffff0205ffn);
  const t = traitsOf(42n, { hairColour: 2, ground: 5 });
  expect(t.hair).toBe(2);
  expect(t.ground).toBe(5);
  expect(traitsOf(42n, { skin: 2 }).skin).toBe(2);
  expect(() => traitsOf(42n, { skin: SKINS.findIndex((s) => s.name === "Gold") })).toThrow();
});

test("the 1/1 odds are pool over tokens left", () => {
  let hits = 0;
  for (let s = 1n; s <= 20000n; s++) if (luckyOf(s, 50, 10000) !== undefined) hits++;
  expect(hits).toBeGreaterThan(60); // 1 in 200: about 100
  expect(hits).toBeLessThan(140);
  let late = 0;
  for (let s = 1n; s <= 2000n; s++) if (luckyOf(s, 3, 6) !== undefined) late++;
  expect(late).toBeGreaterThan(800); // 1 in 2
  expect(luckyOf(373n, 0, 100)).toBeUndefined();
  expect(luckyOf(373n, 5, 0)).toBeUndefined();
});

test("a 1/1 renders its own colours over the token's ground and reads legendary", () => {
  const f = face(5n, {}, 0);
  expect(f.attributes[0]).toEqual({ trait_type: "One of one", value: ONE_OF_ONES[0].name, tier: "legendary" });
  expect(f.svg).toContain(ONE_OF_ONES[0].main[0]);
  expect(rarityOf(f.traits)).toBe("legendary");
});

test("svg is 32x32 rects only and metadata is one JSON line", () => {
  const f = face(9n);
  expect(f.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" shape-rendering="crispEdges"><rect')).toBe(true);
  expect(f.svg).not.toContain("\n");
  const j = JSON.parse(metadataOf(7, f.traits));
  expect(j.name).toBe("Face #7");
  expect(j.attributes.find((a: any) => a.trait_type === "Rarity").value).toBe(rarityOf(f.traits));
  expect(j.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
});

test("skin tiers: human tones common or uncommon and pinnable, fantasy rarer", () => {
  expect(SKINS.filter((s) => s.tier === "common").length).toBe(7);
  expect(SKINS.filter((s) => s.tier === "rare").length).toBeGreaterThan(5);
  expect(SKIN_WEIGHTS[SKINS.findIndex((s) => s.name === "Gold")]).toBeLessThan(40);
});
