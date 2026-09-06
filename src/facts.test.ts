import { expect, test } from "bun:test";
import { holderFacts } from "./facts.ts";
import type { ChainState } from "./contract.ts";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;
const C = "0x5555555555555555555555555555555555555555" as const;
function fakeChain(extra: Partial<ChainState> = {}): ChainState {
  return {
    address: "0x3333333333333333333333333333333333333333", chainId: 84532, author: A, renderer: "0x4444444444444444444444444444444444444444", rendererLocked: false,
    totalSupply: 3, pending: 2, poolLeft: 5, secondsLeft: 3600, epoch: 20701, readAt: Date.now(),
    faces: new Map([[1, { id: 1, seed: 11n, pins: (1n << 128n) - 1n, one: 255, renderer: "0x44" as any }], [2, { id: 2, seed: 12n, pins: 0x0301ffffffffffffffffffffffffffffn, one: 255, renderer: "0x44" as any }], [3, { id: 3, seed: 13n, pins: (1n << 128n) - 1n, one: 0, renderer: "0x44" as any }]]),
    owners: new Map([[1, A], [2, B], [3, B]]),
    rolls: new Map([[2, { id: 2, to: C, tx: "0xabc", block: 5n, at: 20701 * 86400 + 100, paid: 1_000_000_000_000_000n }]]),
    ...extra,
  };
}

test("no faces, no facts", () => {
  expect(holderFacts("0x9999999999999999999999999999999999999999", fakeChain())).toEqual([]);
});

test("face 1, faces from earlier holders, one of ones", () => {
  const c = fakeChain();
  const b = holderFacts(B, c);
  expect(b.find((x) => x.kind === "first")).toBeUndefined();
  expect(b.find((x) => x.kind === "later")!.text).toBe("Took 1 face from earlier holders.");
  expect(b.find((x) => x.kind === "ones")!.label).toBe("one of one, #3");
  expect(b.find((x) => x.kind === "rare")!.ids).toContain(3);
  const a = holderFacts(c.author, c);
  expect(a[0]).toMatchObject({ kind: "first", figure: "#1" });
});

test("a streak counts days in a row rolled by this wallet", () => {
  const c = fakeChain({
    owners: new Map([[1, B], [2, B], [3, B]]),
    rolls: new Map([[1, { id: 1, to: B, tx: "0xa", block: 1n, at: 20701 * 86400 + 5, paid: 0n }], [2, { id: 2, to: B, tx: "0xb", block: 2n, at: 20702 * 86400 + 5, paid: 0n }], [3, { id: 3, to: B, tx: "0xc", block: 3n, at: 20704 * 86400 + 5, paid: 0n }]]),
  });
  const f = holderFacts(B, c);
  expect(f.find((x) => x.kind === "rolled")!.figure).toBe("3");
  expect(f.find((x) => x.kind === "streak")!.figure).toBe("2");
});
