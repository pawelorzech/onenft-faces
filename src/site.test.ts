import { test, expect } from "bun:test";
import { homePage, facePage, howPage, notFound } from "./site.ts";
import { rarityPage, onesPage, assetsPage } from "./pages.ts";
import { specJson, stateJson } from "./api.ts";
import { previewSvg, itemSvg, unpackPins } from "./faces.ts";
import type { ChainState } from "./contract.ts";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;
function fakeChain(): ChainState {
  return {
    address: "0x3333333333333333333333333333333333333333", chainId: 84532, author: A, renderer: "0x4444444444444444444444444444444444444444", rendererLocked: false,
    totalSupply: 3, poolLeft: 5, secondsLeft: 3600, epoch: 20701,
    faces: new Map([[1, { id: 1, seed: 11n, pins: 0xffffffffffffffffn, one: 255, renderer: "0x44" as any }], [2, { id: 2, seed: 12n, pins: 0x0301ffffffffffffn, one: 255, renderer: "0x44" as any }], [3, { id: 3, seed: 13n, pins: 0xffffffffffffffffn, one: 0, renderer: "0x44" as any }]]),
    owners: new Map([[1, A], [2, B], [3, B]]), rolls: new Map(),
  };
}

test("home without a contract renders the builder and says rolling opens later", () => {
  const h = homePage(null, 20701);
  expect(h).toContain("Rolling opens with the contract");
  expect(h).toContain('data-slot="hair"');
  expect(h).toContain('data-slot="skin"');
  expect(h).toContain('data-slot="ground"');
  expect(h).toContain('data-slot="hairColour"');
  expect(h).not.toContain('id="roll"');
});

test("home with a contract lists faces newest first with pins and one of one marks", () => {
  const h = homePage(fakeChain(), 20701);
  expect(h).toContain('id="roll"');
  expect(h.indexOf("#3</span>")).toBeLessThan(h.indexOf("#2</span>"));
  expect(h).toContain("2 pins");
  expect(h).toContain("one of one");
  expect(h).toContain("the treasury");
});

test("face page shows pins, rarity and links", () => {
  const c = fakeChain();
  const h = facePage(2, c.faces.get(2)!, c);
  expect(h).toContain("2 pins (background, top)");
  expect(h).toContain("/face/2.svg");
  expect(unpackPins(0x0301ffffffffffffn)).toEqual({ background: 3, top: 1 });
});

test("preview and item images are 32x32 svgs", () => {
  expect(previewSvg({ hair: 2 })).toContain('viewBox="0 0 32 32"');
  expect(itemSvg(0, 1)).toContain("<rect");
});

test("inner pages and json render", () => {
  const c = fakeChain();
  for (const h of [howPage(c, 20701), rarityPage(c, 20701), onesPage(c, 20701), assetsPage(c, 20701), notFound(c, 20701)]) expect(h).toContain("<!doctype html>");
  const s = specJson();
  expect(s.slots.length).toBe(7);
  expect(stateJson(c).recent.length).toBe(3);
  expect(stateJson(c).recent[0].oneOfOne).toBe("Robot");
});
