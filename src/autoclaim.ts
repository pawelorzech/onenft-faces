/**
 * The keeper. Two jobs from the deployer wallet, so nobody has to sign twice
 * and the treasury never misses a day: reveal every commit that is due (anyone
 * may, the contract allows it) and commit the author's daily roll.
 *
 * Every transaction it sends is tracked until the chain settles it. A send is
 * "sent", not "done": done is a receipt with status success and a Rolled event
 * naming the wallet. A receipt that does not come is "unknown", and unknown is
 * never a reason to send again: first the contract is asked whether the commit
 * is still there, and the node whether the transaction is still known. Sends
 * go one at a time, so the shared account's nonces never race. Runs only when
 * DEPLOYER_KEY is set; the pure decisions are testable without a chain.
 */
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ABI, CONTRACT, chain, chainState, canRoll, unrevealed, publicClient, rolledTokenOf, tokenRolledBy, scrubError, type ChainState, type RollCheck } from "./contract.ts";

/** Pure decision, so it can be tested without a chain. */
export function shouldCommitTreasury(state: ChainState | null, authorCanRoll: boolean): boolean {
  if (!state) return false;
  return authorCanRoll && state.totalSupply + state.pending < 10000;
}
export function revealDue(revealBlock: number, head: number): boolean {
  return revealBlock > 0 && head >= revealBlock;
}

export type Receipt = { status: "success" | "reverted"; logs: { address: Address; data: Hex; topics: [Hex, ...Hex[]] | [] }[]; blockNumber: bigint };

/** What the keeper needs from the world. The real one wraps viem; tests hand in a fake. */
export type KeeperDeps = {
  canRoll(who: Address): Promise<RollCheck>;
  sendReveal(who: Address): Promise<Hex>;
  sendTreasuryCommit(): Promise<Hex>;
  getReceipt(hash: Hex): Promise<Receipt | null>;
  /** Whether the node still knows the transaction (pending or mined). False means it was dropped. */
  transactionKnown(hash: Hex): Promise<boolean>;
  tokenOf(receipt: Receipt, who: Address): number | null;
  /** The token the wallet rolled since a block, from the log. */
  tokenRolledBy(who: Address, sinceBlock: bigint): Promise<number | null>;
  now(): number;
  log(line: string): void;
};

export type RevealState =
  | "no-keeper"   // nothing armed on this server; the roller may reveal from their own wallet
  | "rpc-down"    // the chain did not answer; nothing was sent
  | "none"        // this wallet has no commit waiting today
  | "waiting"     // committed; the reveal block has not come yet
  | "sent"        // a reveal is on its way; waiting for its receipt
  | "confirmed"   // a receipt with status success names the token
  | "unknown"     // a reveal was sent but no receipt came in time; do not resend blindly
  | "failed";     // the send itself failed (funds, RPC, revert); the commit is untouched

export type RevealResult = {
  state: RevealState;
  address: Address;
  hash?: Hex;
  tokenId?: number;
  revealBlock?: number;
  head?: number;
  epoch?: number;
  /** The wallet spent today's roll (committed, whether or not revealed yet). */
  rolledToday?: boolean;
  soldOut?: boolean;
  /** Seconds since the transaction was sent, for "sent" and "unknown". */
  sentAgo?: number;
  reason?: string;
};

type Pending = { hash: Hex; sentAt: number; attempts: number; kind: "reveal" | "commit" };

export type KeeperOptions = {
  /** After this long without a receipt a send reads as unknown. */
  unknownAfterMs?: number;
  /** A dropped or reverted send may be repeated this many times. */
  maxAttempts?: number;
  /** Blocks back from the head the Rolled log is searched when a token must be found for a wallet. About a day on Base. */
  logWindow?: bigint;
};

export class Keeper {
  readonly pending = new Map<string, Pending>();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly inflight = new Map<string, Promise<RevealResult>>();
  private readonly o: Required<KeeperOptions>;
  constructor(private readonly deps: KeeperDeps, o: KeeperOptions = {}) {
    this.o = { unknownAfterMs: 90_000, maxAttempts: 3, logWindow: 45_000n, ...o };
  }

  /** Every send goes through here, one after another: the account's nonce is shared. */
  private send<T>(f: () => Promise<T>): Promise<T> {
    const p = this.queue.then(f, f);
    this.queue = p.catch(() => {});
    return p;
  }

  /**
   * The standing of one wallet's roll, and, when `send` is true and a reveal is
   * due and nothing is in flight, one reveal transaction. Concurrent calls for
   * the same wallet share one run. Never throws.
   */
  revealFor(who: Address, send = true): Promise<RevealResult> {
    const key = who.toLowerCase();
    const running = this.inflight.get(key);
    if (running) return running;
    const p = this.run(who, send).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async run(who: Address, send: boolean): Promise<RevealResult> {
    const key = who.toLowerCase();
    let check: RollCheck;
    try {
      check = await this.deps.canRoll(who);
    } catch (e) {
      return { state: "rpc-down", address: who, reason: scrubError(e) };
    }
    const base = { address: who, revealBlock: check.revealBlock, head: check.head, epoch: check.epoch, rolledToday: check.lastRollEpoch === check.epoch, soldOut: check.soldOut };
    const p = this.pending.get(key);

    // No commit waiting: either never committed today, or already revealed (by us, by the roller, by anyone).
    if (check.revealBlock === 0) {
      if (p) {
        const r = await this.receipt(p.hash);
        this.pending.delete(key);
        if (r?.status === "success") {
          const id = this.deps.tokenOf(r, who);
          if (id !== null) return { ...base, state: "confirmed", hash: p.hash, tokenId: id };
        }
      }
      if (base.rolledToday) {
        const id = await this.find(who, check.head);
        if (id !== null) return { ...base, state: "confirmed", tokenId: id, hash: p?.hash };
        return { ...base, state: "none", reason: "rolled today; the token is not in the log yet" };
      }
      return { ...base, state: "none" };
    }

    if (!revealDue(check.revealBlock, check.head)) return { ...base, state: "waiting" };

    if (p) {
      const r = await this.receipt(p.hash);
      const age = this.deps.now() - p.sentAt;
      if (r?.status === "success") {
        // The contract still shows the commit only because this read raced the block; the receipt wins.
        this.pending.delete(key);
        const id = this.deps.tokenOf(r, who);
        return id === null ? { ...base, state: "none", hash: p.hash } : { ...base, state: "confirmed", hash: p.hash, tokenId: id };
      }
      if (r?.status === "reverted") {
        this.pending.delete(key);
        this.deps.log(`keeper: reveal for ${who} reverted, tx ${p.hash}`);
        if (p.attempts >= this.o.maxAttempts) return { ...base, state: "failed", hash: p.hash, reason: "the reveal reverted repeatedly" };
        // fall through: the commit is still there, so try once more
      } else {
        if (age < this.o.unknownAfterMs) return { ...base, state: "sent", hash: p.hash, sentAgo: Math.floor(age / 1000) };
        let known = true;
        try { known = await this.deps.transactionKnown(p.hash); } catch {}
        if (known) return { ...base, state: "unknown", hash: p.hash, sentAgo: Math.floor(age / 1000) };
        this.deps.log(`keeper: reveal for ${who} was dropped by the node, tx ${p.hash}`);
        this.pending.delete(key);
        if (p.attempts >= this.o.maxAttempts) return { ...base, state: "failed", hash: p.hash, reason: "the reveal was dropped repeatedly" };
      }
    }

    if (!send) return { ...base, state: "waiting", reason: "due; not sent by this call" };
    const attempts = (p?.attempts ?? 0) + 1;
    try {
      const hash = await this.send(() => this.deps.sendReveal(who));
      this.pending.set(key, { hash, sentAt: this.deps.now(), attempts, kind: "reveal" });
      unrevealed.delete(who);
      this.deps.log(`keeper: revealed for ${who}, tx ${hash}, attempt ${attempts}`);
      return { ...base, state: "sent", hash, sentAgo: 0 };
    } catch (e) {
      const reason = scrubError(e);
      this.deps.log(`keeper: reveal for ${who} failed to send: ${reason}`);
      return { ...base, state: "failed", reason };
    }
  }

  private async receipt(hash: Hex): Promise<Receipt | null> {
    try { return await this.deps.getReceipt(hash); } catch { return null; }
  }
  private async find(who: Address, head: number): Promise<number | null> {
    try { return await this.deps.tokenRolledBy(who, BigInt(head) - this.o.logWindow); } catch { return null; }
  }

  /** The treasury's daily commit, at most one in flight, never while the last one is unsettled. */
  async treasury(state: ChainState): Promise<void> {
    const p = this.pending.get("treasury");
    if (p) {
      const r = await this.receipt(p.hash);
      if (!r) {
        if (this.deps.now() - p.sentAt < this.o.unknownAfterMs) return;
        let known = true;
        try { known = await this.deps.transactionKnown(p.hash); } catch {}
        if (known) return;
      }
      this.pending.delete("treasury");
    }
    let ok: RollCheck;
    try { ok = await this.deps.canRoll(state.author); } catch { return; }
    if (!shouldCommitTreasury(state, ok.canRoll)) return;
    try {
      const hash = await this.send(() => this.deps.sendTreasuryCommit());
      this.pending.set("treasury", { hash, sentAt: this.deps.now(), attempts: (p?.attempts ?? 0) + 1, kind: "commit" });
      unrevealed.add(state.author);
      this.deps.log(`keeper: treasury commit, tx ${hash}`);
    } catch (e) {
      this.deps.log(`keeper: treasury commit failed to send: ${scrubError(e)}`);
    }
  }

  /** What a status page may show: counts only, never hashes with keys. */
  summary() {
    return { pending: this.pending.size, reveals: [...this.pending.values()].filter((p) => p.kind === "reveal").length };
  }
}

// ---- the real keeper, wired to viem ----

let keeper: Keeper | null = null;
let keeperAddress: Address | null = null;
export function activeKeeper(): Keeper | null {
  return keeper;
}
export function keeperInfo(): { armed: boolean; address: Address | null; pending: number } {
  return { armed: Boolean(keeper), address: keeperAddress, pending: keeper?.pending.size ?? 0 };
}

/** The standing of a wallet's roll. With a keeper it may send the reveal; without one it only reports. Never throws. */
export async function revealFor(who: Address, send = true): Promise<RevealResult> {
  if (keeper) return keeper.revealFor(who, send);
  try {
    const c = await canRoll(who);
    const base = { address: who, revealBlock: c.revealBlock, head: c.head, epoch: c.epoch, rolledToday: c.lastRollEpoch === c.epoch, soldOut: c.soldOut };
    if (c.revealBlock === 0 && base.rolledToday) {
      let id: number | null = null;
      try { id = await tokenRolledBy(who, BigInt(c.head) - 45_000n); } catch {}
      return id === null ? { ...base, state: "none" } : { ...base, state: "confirmed", tokenId: id };
    }
    return { ...base, state: c.revealBlock === 0 ? "none" : "no-keeper" };
  } catch (e) {
    return { state: "rpc-down", address: who, reason: scrubError(e) };
  }
}

export function startAutoclaim(key: Hex, everyMs = 60_000): void {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(process.env.BASE_RPC_URL) });
  const client = publicClient()!;
  keeperAddress = account.address;
  keeper = new Keeper({
    canRoll,
    sendReveal: (who) => wallet.writeContract({ address: CONTRACT as Address, abi: ABI, functionName: "reveal", args: [who], chain, account }),
    sendTreasuryCommit: () => wallet.writeContract({ address: CONTRACT as Address, abi: ABI, functionName: "commitForTreasury", chain, account }),
    getReceipt: async (hash) => {
      try {
        const r = await client.getTransactionReceipt({ hash });
        return { status: r.status, logs: r.logs as Receipt["logs"], blockNumber: r.blockNumber };
      } catch (e) {
        if (/not (be )?found|could not be found/i.test((e as Error).message)) return null;
        throw e;
      }
    },
    transactionKnown: async (hash) => {
      try { await client.getTransaction({ hash }); return true; } catch (e) { if (/not (be )?found|could not be found/i.test((e as Error).message)) return false; throw e; }
    },
    tokenOf: (r, who) => rolledTokenOf(r as any, who),
    tokenRolledBy,
    now: () => Date.now(),
    log: (line) => console.log(line),
  });
  const k = keeper;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const st = await chainState();
      if (!st) return;
      await k.treasury(st);
      for (const who of [...unrevealed]) {
        const r = await k.revealFor(who);
        if (r.state === "none" || r.state === "confirmed") unrevealed.delete(who);
      }
    } catch (e) {
      console.error("keeper:", scrubError(e));
    } finally {
      busy = false;
    }
  };
  void tick();
  setInterval(tick, everyMs);
  console.log(`keeper armed from ${account.address}, every ${everyMs / 1000} s`);
}
