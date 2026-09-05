import { test, expect } from "bun:test";
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { Canvas } from "./pixels.ts";
import { WEIGHTS, SKIN_WEIGHTS, SKINS, traitsOf, luckyOf, pinOk, packPins, unpackPins, face, svgOf, metadataOf, rarityOf, PINNABLE, ONE_OF_ONE_CHANCE, mix64 } from "./faces.ts";

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

test("pins pack to one byte per pinnable slot", () => {
  expect(PINNABLE.length).toBe(4);
  expect(packPins({})).toBe(0xffffffff);
  const pins = { background: 3, hair: 7 };
  expect(unpackPins(packPins(pins))).toEqual(pins);
  expect(packPins({ background: 3 })).toBe(0x03ffffff);
});

test("the 1/1 pool is hit about once in 10,000 seeds", () => {
  let hits = 0;
  for (let s = 1n; s <= 200000n; s++) if (luckyOf(s, ONE_OF_ONES.length) !== undefined) hits++;
  expect(hits).toBeGreaterThan(5);
  expect(hits).toBeLessThan(60);
  expect(luckyOf(373n, 0)).toBeUndefined();
  expect(ONE_OF_ONE_CHANCE).toBe(1);
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

test("skin tiers: human tones common, fantasy rarer", () => {
  expect(SKINS.filter((s) => s.tier === "common").length).toBe(7);
  expect(SKIN_WEIGHTS[SKINS.findIndex((s) => s.name === "Gold")]).toBeLessThan(40);
});
