import { test, expect } from "bun:test";
import { shouldCommitTreasury, revealDue, Keeper, type KeeperDeps, type Receipt } from "./autoclaim.ts";
import type { RollCheck } from "./contract.ts";
import type { Address, Hex } from "viem";

test("treasury commits only when the author can and supply remains, counting pending commits", () => {
  expect(shouldCommitTreasury({ totalSupply: 10, pending: 0 } as any, true)).toBe(true);
  expect(shouldCommitTreasury({ totalSupply: 10, pending: 0 } as any, false)).toBe(false);
  expect(shouldCommitTreasury({ totalSupply: 10000, pending: 0 } as any, true)).toBe(false);
  expect(shouldCommitTreasury({ totalSupply: 9990, pending: 10 } as any, true)).toBe(false);
  expect(shouldCommitTreasury(null, true)).toBe(false);
});
test("a reveal is due from its block on", () => {
  expect(revealDue(0, 100)).toBe(false);
  expect(revealDue(101, 100)).toBe(false);
  expect(revealDue(101, 101)).toBe(true);
});

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const CONTRACT = "0x3333333333333333333333333333333333333333";
const ROLLED_TOPIC = "0x" + "11".repeat(32) as Hex;

/** A fake chain the keeper talks to: one wallet's commit, a head that moves, receipts that arrive when told. */
function world(o: { revealBlock?: number; head?: number; epoch?: number; lastRollEpoch?: number } = {}) {
  const w = {
    revealBlock: o.revealBlock ?? 101, head: o.head ?? 101, epoch: o.epoch ?? 20701, lastRollEpoch: o.lastRollEpoch ?? 20701,
    sends: [] as Address[], receipts: new Map<Hex, Receipt | null>(), known: new Set<Hex>(), now: 1_000_000, logToken: null as number | null, canRollFails: false, sendFails: false,
    log: [] as string[],
  };
  let n = 0;
  const deps: KeeperDeps = {
    canRoll: async (): Promise<RollCheck> => { if (w.canRollFails) throw new Error("rpc dead http://x/key"); return { canRoll: false, lastRollEpoch: w.lastRollEpoch, revealBlock: w.revealBlock, head: w.head, epoch: w.epoch, soldOut: false }; },
    sendReveal: async (who) => { if (w.sendFails) throw new Error("insufficient funds"); await new Promise((r) => setTimeout(r, 2)); w.sends.push(who); const h = ("0x" + (++n).toString(16).padStart(64, "0")) as Hex; w.known.add(h); return h; },
    sendTreasuryCommit: async () => ("0x" + "ee".repeat(32)) as Hex,
    getReceipt: async (h) => w.receipts.get(h) ?? null,
    transactionKnown: async (h) => w.known.has(h),
    tokenOf: (r) => { const l = r.logs.find((x) => x.topics[0] === ROLLED_TOPIC); return l ? Number(l.topics[1]) : null; },
    tokenRolledBy: async () => w.logToken,
    now: () => w.now,
    log: (s) => w.log.push(s),
  };
  const mined = (h: Hex, tokenId: number | null, status: "success" | "reverted" = "success") => {
    w.receipts.set(h, { status, blockNumber: 102n, logs: tokenId === null ? [] : [{ address: CONTRACT as Address, data: "0x", topics: [ROLLED_TOPIC, ("0x" + tokenId.toString(16).padStart(64, "0")) as Hex] }] });
  };
  return { w, deps, mined };
}

test("waiting before the reveal block; one send when due; twenty concurrent POSTs share it; sent until the receipt; confirmed names the token from the event", async () => {
  const { w, deps, mined } = world({ revealBlock: 105, head: 103 });
  const k = new Keeper(deps, { unknownAfterMs: 1000 });
  expect((await k.revealFor(A)).state).toBe("waiting");
  expect(w.sends.length).toBe(0);
  w.head = 105;
  const results = await Promise.all(Array.from({ length: 20 }, () => k.revealFor(A)));
  expect(results.every((r) => r.state === "sent")).toBe(true);
  expect(w.sends.length).toBe(1);
  const hash = results[0].hash!;
  // Repeated POSTs later do not send again either.
  expect((await k.revealFor(A)).state).toBe("sent");
  expect(w.sends.length).toBe(1);
  mined(hash, 42);
  const r = await k.revealFor(A);
  expect(r.state).toBe("confirmed");
  expect(r.tokenId).toBe(42);
  expect(k.pending.size).toBe(0);
});

test("a reverted receipt is not a success, and the contract decides whether to try again", async () => {
  const { w, deps, mined } = world();
  const k = new Keeper(deps, { unknownAfterMs: 1000, maxAttempts: 2 });
  const r1 = await k.revealFor(A);
  mined(r1.hash!, null, "reverted");
  // The commit is still there (someone else did not reveal): one more attempt.
  const r2 = await k.revealFor(A);
  expect(r2.state).toBe("sent");
  expect(w.sends.length).toBe(2);
  mined(r2.hash!, null, "reverted");
  const r3 = await k.revealFor(A);
  expect(r3.state).toBe("failed");
  expect(w.sends.length).toBe(2);
});

test("no receipt in time is unknown, never a resend, while the node still knows the transaction; a dropped transaction may be sent again", async () => {
  const { w, deps } = world();
  const k = new Keeper(deps, { unknownAfterMs: 1000 });
  const r1 = await k.revealFor(A);
  w.now += 5000;
  const r2 = await k.revealFor(A);
  expect(r2.state).toBe("unknown");
  expect(r2.hash).toBe(r1.hash);
  expect(w.sends.length).toBe(1);
  w.known.delete(r1.hash!);
  const r3 = await k.revealFor(A);
  expect(r3.state).toBe("sent");
  expect(r3.hash).not.toBe(r1.hash);
  expect(w.sends.length).toBe(2);
});

test("someone else revealed first: the contract shows no commit, the token is found in the log, never the wallet's newest face", async () => {
  const { w, deps } = world();
  const k = new Keeper(deps);
  const r1 = await k.revealFor(A);
  expect(r1.state).toBe("sent");
  w.revealBlock = 0;
  w.logToken = 7;
  const r2 = await k.revealFor(A);
  expect(r2.state).toBe("confirmed");
  expect(r2.tokenId).toBe(7);
  // Index lag: rolled today, no token in the log yet. Not a success, not an error.
  w.logToken = null;
  const r3 = await k.revealFor(A);
  expect(r3.state).toBe("none");
  expect(r3.rolledToday).toBe(true);
});

test("restart: a fresh keeper with an empty table recovers from the contract alone", async () => {
  const { w, deps, mined } = world();
  const k1 = new Keeper(deps);
  const r1 = await k1.revealFor(A);
  const k2 = new Keeper(deps);
  // The old send is still in flight; the new process sees a due commit and sends once. The contract, not the keeper, prevents a double mint.
  const r2 = await k2.revealFor(A);
  expect(r2.state).toBe("sent");
  mined(r1.hash!, 9);
  w.revealBlock = 0;
  w.logToken = 9;
  expect((await k2.revealFor(A)).tokenId).toBe(9);
});

test("a dead RPC is rpc-down with nothing sent and no secret in the reason; a send failure is failed with the commit untouched", async () => {
  const { w, deps } = world();
  const k = new Keeper(deps);
  w.canRollFails = true;
  const r = await k.revealFor(A);
  expect(r.state).toBe("rpc-down");
  expect(r.reason).not.toContain("http://x/key");
  expect(w.sends.length).toBe(0);
  w.canRollFails = false;
  w.sendFails = true;
  const f = await k.revealFor(A);
  expect(f.state).toBe("failed");
  expect(f.reason).toContain("insufficient funds");
  expect(k.pending.size).toBe(0);
});

test("a GET (send false) reports without sending; no commit today is none", async () => {
  const { w, deps } = world({ revealBlock: 0, lastRollEpoch: 20700 });
  const k = new Keeper(deps);
  expect((await k.revealFor(A, false)).state).toBe("none");
  w.revealBlock = 101;
  expect((await k.revealFor(A, false)).state).toBe("waiting");
  expect(w.sends.length).toBe(0);
});

test("sends go one at a time through the shared account", async () => {
  const { w, deps } = world();
  let inFlight = 0, peak = 0;
  deps.sendReveal = async (who) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 3)); inFlight--; w.sends.push(who); return ("0x" + w.sends.length.toString(16).padStart(64, "0")) as Hex; };
  const k = new Keeper(deps);
  const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
  const C = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
  await Promise.all([k.revealFor(A), k.revealFor(B), k.revealFor(C)]);
  expect(w.sends.length).toBe(3);
  expect(peak).toBe(1);
});
