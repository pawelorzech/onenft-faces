import { test, expect } from "bun:test";
import { homePage, facePage, howPage, notFound, goTarget, ethOf, pinRule, cssVars, contrast, heldBy, rolledBy } from "./site.ts";
import { rarityPage, onesPage, assetsPage, holderPage, yoursPage } from "./pages.ts";
import { specJson, stateJson, rollJson } from "./api.ts";
import { previewSvg, itemSvg, unpackPins, PIN_PRICES_WEI, MAX_PINS, GROUNDS } from "./faces.ts";
import type { ChainState, ChainStatus } from "./contract.ts";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;
const C = "0x5555555555555555555555555555555555555555" as const;
export function fakeChain(extra: Partial<ChainState> = {}): ChainState {
  return {
    address: "0x3333333333333333333333333333333333333333", chainId: 84532, author: A, renderer: "0x4444444444444444444444444444444444444444", rendererLocked: false,
    totalSupply: 3, pending: 2, poolLeft: 5, secondsLeft: 3600, epoch: 20701, readAt: Date.now(),
    faces: new Map([[1, { id: 1, seed: 11n, pins: (1n << 128n) - 1n, one: 255, renderer: "0x44" as any }], [2, { id: 2, seed: 12n, pins: 0x0301ffffffffffffffffffffffffffffn, one: 255, renderer: "0x44" as any }], [3, { id: 3, seed: 13n, pins: (1n << 128n) - 1n, one: 0, renderer: "0x44" as any }]]),
    owners: new Map([[1, A], [2, B], [3, B]]),
    // face 2 was rolled by C and is now held by B
    rolls: new Map([[2, { id: 2, to: C, tx: "0xabc", block: 5n, at: 20701 * 86400 + 100, paid: 1_000_000_000_000_000n }]]),
    ...extra,
  };
}
const DOWN: ChainStatus = { configured: true, known: false, stale: false, readAt: null, ageSeconds: null, error: "no answer", errorAt: 1, scannedBlock: "0", scanned: false };
const STALE: ChainStatus = { configured: true, known: true, stale: true, readAt: Date.parse("2026-09-05T12:04:00Z"), ageSeconds: 600, error: "no answer", errorAt: 1, scannedBlock: "0", scanned: true };

test("home without a contract renders the builder and says rolling opens later", () => {
  const h = homePage(null, 20701);
  expect(h).toContain("Rolling opens with the contract");
  for (const s of ["hair", "skin", "ground", "hairColour", "mouth", "accent"]) expect(h).toContain(`data-slot="${s}"`);
  expect(h).not.toContain('id="roll"');
});

test("home with a chain that never answered says so, shows no zero supply and no roll button", () => {
  const h = homePage(null, 20701, undefined, DOWN);
  expect(h).toContain("the chain did not answer");
  expect(h).toContain("Collection status is unavailable");
  expect(h).toContain("<b>?</b>");
  expect(h).not.toContain("<b>0</b><span class=\"small\">of 10,000 rolled");
  expect(h).not.toContain('id="roll"');
  expect(h).not.toContain("Nobody has rolled yet");
});

test("home with a contract lists faces newest first, rolled by from the log, held by otherwise, and the counts from the contract", () => {
  const h = homePage(fakeChain(), 20701);
  expect(h).toContain('id="roll"');
  expect(h.indexOf("#3</span>")).toBeLessThan(h.indexOf("#2</span>"));
  expect(h).toContain("rolled by 0x5555…5555, 2 pins");
  expect(h).toContain("held by the treasury");
  expect(h).toContain("held by 0x2222…2222");
  expect(h).toContain("one of one");
  expect(h).toContain("<b>2</b><span class=\"small\">being revealed");
  expect(h).toContain("Roll a face");
  expect(h).toContain("0 ETH mint fee. You pay network gas.");
  expect(h).not.toContain("Roll for free");
  expect(h).not.toContain("Rare things cannot be bought");
  expect(h).toContain("Rare and legendary traits cannot be pinned");
  expect(h).not.toContain("Collection status could not be refreshed");
  expect(homePage(fakeChain(), 20701, undefined, STALE)).toContain("Showing data from 12:04 UTC");
});

test("sold out counts pending commits and is not 'you rolled today'", () => {
  const h = homePage(fakeChain({ totalSupply: 9998, pending: 2 }), 20701);
  expect(h).toContain("Sold out");
  expect(h).not.toContain('id="roll"');
});

test("the builder is accessible: groups with names, pressed state, visible pick, categories, and the clear button is hidden by an attribute the CSS honours", () => {
  const h = homePage(fakeChain(), 20701);
  expect(h).toContain('role="group" aria-labelledby="h-hair"');
  expect(h).toContain('aria-pressed="false" aria-label="Pin ');
  expect(h).toContain('<p class="pick" aria-live="polite">Luck decides</p>');
  expect(h).toContain('<nav class="cats" aria-label="Pin categories">');
  expect(h).toContain('<details class="gallery" id="g-background" data-slot="background" open>');
  expect(h).toContain("[hidden]{display:none!important}");
  expect(h).toContain('id="clear" type="button" hidden');
  expect(h).toContain('class="skip"');
});

test("the roll script freezes pins at the click, keeps the commit per chain, contract and account, takes the token from the reveal event, and offers a manual reveal only when the keeper cannot", () => {
  const h = homePage(fakeChain(), 20701);
  for (const s of ["snapPins=packed()", "onenft_roll:", "onenft_pins:", "tokenId", "/api/reveal/", "/api/roll/", 'id="manual"', "revealSelector", "We cannot confirm the reveal yet", "Your roll is committed. Waiting for the reveal.", "Transaction sent. Waiting for confirmation.", "the reveal service is not running here", "accountsChanged", "Sold out. Every face", "lock(true)"]) expect(h).toContain(s);
  expect(h).not.toContain("s.faces[s.faces.length-1]");
  expect(h).not.toContain("location.reload();return}");
  expect(h).toContain('id="newday"');
});

test("face page: held by links the full address, rolled by comes from the log, a one of one explains the pins", () => {
  const c = fakeChain();
  const h = facePage(2, c.faces.get(2)!, c);
  expect(h).toContain(`held by <a href="/${B}">0x2222…2222</a>`);
  expect(h).toContain(`Rolled by <a href="/${C}">0x5555…5555</a>`);
  expect(h).toContain("2 pins (background, top)");
  expect(h).toContain("pin fee 0.001 ETH");
  expect(h).toContain('data-dl="png"');
  expect(h).toContain("/face/2-1024.png");
  expect(unpackPins(0x0301ffffffffffffffffffffffffffffn)).toEqual({ background: 3, top: 1 });
  const o = facePage(3, c.faces.get(3)!, c);
  expect(o).toContain("A one of one is a full drawing");
  expect(heldBy(c, 1, new Map())).toBe("held by the treasury");
  expect(rolledBy(c, 1, new Map())).toBe("");
});

test("hostile names cannot break the title, the heading or an attribute", () => {
  const c = fakeChain();
  const names = new Map([[B, '</title><script>alert(1)</script>"']]);
  for (const h of [homePage(c, 20701, names), facePage(2, c.faces.get(2)!, c, names), holderPage(B, B, c, names), onesPage(c, 20701, names)]) {
    expect(h).not.toContain("<script>alert(1)</script>");
    expect(h).not.toContain('</title><script>');
  }
});

test("prices are exact and every number in the copy comes from the constants", () => {
  expect(ethOf(0n)).toBe("0");
  expect(ethOf(PIN_PRICES_WEI[1])).toBe("0.0005");
  expect(ethOf(PIN_PRICES_WEI[2])).toBe("0.001");
  expect(ethOf(PIN_PRICES_WEI[12])).toBe("1.024");
  expect(MAX_PINS).toBe(12);
  expect(pinRule()).toContain("0.0005 ETH");
  expect(pinRule()).toContain("1.024 ETH for 12");
  const s = specJson();
  expect(s.rule).toContain("1.024 ETH for 12");
  expect(s.rule).not.toContain("three pins");
  expect(s.maxPins).toBe(12);
  expect(s.oneOfOneOdds).toContain("with or without pins");
  const how = howPage(fakeChain(), 20701);
  expect(how).toContain("0.0005, 0.001, 0.002 ETH");
  expect(how).toContain("Any roll, pinned or not");
  expect(how).toContain("reads that hash as zero");
  expect(how).not.toContain("so nobody can peek");
});

test("state json: null counts when the chain never answered, pending from the contract, left counts pending", () => {
  const down = stateJson(null, undefined, DOWN);
  expect(down.totalSupply).toBeNull();
  expect(down.pending).toBeNull();
  expect(down.chain.known).toBe(false);
  const s = stateJson(fakeChain(), undefined, { ...STALE, stale: false });
  expect(s.pending).toBe(2);
  expect(s.left).toBe(10000 - 3 - 2);
  expect(s.recent.length).toBe(3);
  expect(s.recent[0].oneOfOne).toBe("Robot");
  expect(s.recent[1].roll?.to).toBe(C);
  expect(rollJson({ state: "sent", address: A, hash: "0x1", revealBlock: 5, head: 5, sentAgo: 3 }, { armed: true, address: A, pending: 1 }, null).state).toBe("sent");
});

test("yours page: label, view wallet, a bad input stays with a reason, honest wallet copy", () => {
  const h = yoursPage(fakeChain(), 20701, null, "junk");
  expect(h).toContain('<label for="who">');
  expect(h).toContain("View wallet");
  expect(h).toContain("is not a wallet address or an ENS name");
  expect(h).toContain("Viewing a wallet needs no transaction");
  expect(h).toContain('id="connect"');
  expect(yoursPage(null, 20701, DOWN)).toContain("The chain did not answer");
  expect(goTarget("junk")).toBe("/yours?bad=junk");
  expect(goTarget(B)).toBe(`/${B}`);
});

test("holder page: one row per face with traits and a download bar, faces-face-N names, the hub link uses the full address", () => {
  const h = holderPage(B, B, fakeChain());
  expect((h.match(/data-dl="png"/g) ?? []).length).toBe(2);
  expect(h).toContain('download="faces-face-2.svg"');
  expect(h).toContain('href="/face/2-1024.png" download="faces-face-2-1024.png"');
  expect(h).toContain(`https://onenft.click/wallet/${B}`);
  expect(h).toContain('class="sizes"');
  expect(h).toContain("rolled by 0x5555…5555");
});

test("every page carries the breadcrumb and the same menu labels", () => {
  const c = fakeChain();
  for (const h of [howPage(c, 20701), rarityPage(c, 20701), onesPage(c, 20701), assetsPage(c, 20701), notFound(c, 20701), yoursPage(c, 20701), holderPage(B, B, c), facePage(1, c.faces.get(1)!, c)]) {
    expect(h).toContain("<!doctype html>");
    expect(h).toContain('<nav class="crumb" aria-label="Breadcrumb"><ol>');
    expect(h).toContain('aria-current="page"');
    expect(h).toContain('href="https://onenft.click">All collections</a>');
    expect(h).toContain('href="/yours">Your wallet</a>');
  }
  expect(homePage(c, 20701)).toContain('class="mark syne hub" href="https://onenft.click"');
});

test("muted text keeps 4.5:1 and control edges keep 3:1 on every ground", () => {
  for (const g of GROUNDS) {
    const fg = (parseInt(g.main.slice(1), 16) >> 16) > 128 ? "#1c1a19" : "#f6f4ee";
    const v = cssVars(fg, g.main);
    const bg = v.match(/--bg:(#[0-9a-f]{6})/)![1], muted = v.match(/--muted:(#[0-9a-f]{6})/)![1], edge = v.match(/--edge:(#[0-9a-f]{6})/)![1], ink = v.match(/--fg:(#[0-9a-f]{6})/)![1];
    expect(contrast(ink, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(edge, bg)).toBeGreaterThanOrEqual(3);
  }
});

test("preview and item images are 32x32 svgs", () => {
  expect(previewSvg({ hair: 2 })).toContain('viewBox="0 0 32 32"');
  expect(itemSvg(0, 1)).toContain("<rect");
});
