import { applyCommitEvents } from "./commit-log.ts";
/**
 * Reads state from the OneNFT contract. Without CONTRACT_ADDRESS the site
 * runs as a plain renderer with no chain.
 *
 * The cache rule is the one every collection follows (see swr.ts): a page
 * never waits on the RPC when a last good state exists; a refresh runs behind
 * it, shared by every request; failures back off; the age of the last good
 * read is public. A read is one snapshot: when any part of it fails, the
 * whole read fails and the last good state stays, so a half-read never shows
 * as a complete history.
 */
import { createPublicClient, http, parseAbi, parseAbiItem, toFunctionSelector, decodeEventLog, type Address, type Hex, type TransactionReceipt } from "viem";
import { base, baseSepolia } from "viem/chains";
import { Swr, type SwrStatus } from "./swr.ts";

export const CONTRACT = (process.env.CONTRACT_ADDRESS ?? "") as Address | "";
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? (CONTRACT ? 84532 : 0));
export const chain = CHAIN_ID === 8453 ? base : baseSepolia;
export const EPOCH_SECONDS = 86400;
export const MAX_SUPPLY = 10000;

export const ABI = parseAbi([
  "function author() view returns (address)",
  "function renderer() view returns (address)",
  "function rendererLocked() view returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function poolLeft() view returns (uint256)",
  "function secondsLeft() view returns (uint256)",
  "function currentEpoch() view returns (uint256)",
  "function canRoll(address wallet) view returns (bool)",
  "function lastRollEpoch(address wallet) view returns (uint256)",
  "function priceOf(uint128 pins) view returns (uint256)",
  "function faces(uint256 tokenId) view returns (uint64 seed, uint128 pins, uint8 one, address renderer)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function pending() view returns (uint256)",
  "function commits(address wallet) view returns (uint128 pins, uint64 blockNumber, uint64 paid)",
  "function revealBlockOf(address wallet) view returns (uint256)",
  "function lastRevealBlockOf(address wallet) view returns (uint256)",
  "function renew(address wallet)",
  "function commit(uint128 pins) payable",
  "function commitForTreasury()",
  "function reveal(address wallet) returns (uint256)",
]);
export const COMMITS_SELECTOR = toFunctionSelector("function commits(address)");
export const COMMIT_SELECTOR = toFunctionSelector("function commit(uint128 pins)");
export const COMMITTED = parseAbiItem("event Committed(address indexed wallet, uint128 pins, uint256 blockNumber, uint256 paid)");
export const ROLLED = parseAbiItem("event Rolled(uint256 indexed tokenId, address indexed to, uint64 seed, uint128 pins, uint8 one, uint256 paid)");

export type FaceRecord = { id: number; seed: bigint; pins: bigint; one: number; renderer: Address };
export type Roll = { id: number; to: Address; tx: Hex; block: bigint; at: number; paid: bigint };

export type ChainState = {
  address: Address;
  chainId: number;
  author: Address;
  renderer: Address;
  rendererLocked: boolean;
  totalSupply: number;
  /** Commits not yet revealed, from the contract. They hold a place in the supply. */
  pending: number;
  poolLeft: number;
  secondsLeft: number;
  epoch: number;
  /** id → seed, pins, 1/1; immutable once rolled, cached forever. */
  faces: Map<number, FaceRecord>;
  /** id → current owner. */
  owners: Map<number, Address>;
  /** id → the roll transaction, once the log scan has reached it. */
  rolls: Map<number, Roll>;
  /** Unix milliseconds of the read this state came from. */
  readAt: number;
  ownersReadAt?: number;
  ownerReadAt?: Map<number, number>;
};

export type ChainStatus = {
  configured: boolean;
  known: boolean;
  stale: boolean;
  readAt: number | null;
  ageSeconds: number | null;
  error: string | null;
  errorAt: number | null;
  /** The block the roll log scan has reached, as a string. */
  scannedBlock: string;
  /** Whether the scan has finished at least one pass, so `unrevealed` means something. */
  scanned: boolean;
};

const TTL_MS = 12_000;
export const STALE_AFTER_MS = Number(process.env.STALE_AFTER_MS ?? 90_000);
const DEADLINE_MS = Number(process.env.CHAIN_DEADLINE_MS ?? 2_500);
const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS ?? 8_000);

const client = CONTRACT ? createPublicClient({ chain, transport: http(process.env.BASE_RPC_URL, { timeout: RPC_TIMEOUT_MS, retryCount: 1 }) }) : null;
export function contractEnabled(): boolean {
  return Boolean(client && CONTRACT);
}
export function publicClient() {
  return client;
}

/** Errors from the RPC can quote the URL it was sent to, which may carry a key. Keep the first line, without URLs. */
export function scrubError(e: unknown): string {
  const m = ((e as any)?.shortMessage ?? (e as Error)?.message ?? String(e)).split("\n")[0];
  return m.replace(/https?:\/\/\S+/g, "[rpc]").slice(0, 200);
}

export function createFacesReader(client: Pick<NonNullable<ReturnType<typeof publicClient>>, "multicall" | "getBlockNumber">, address: Address, now = Date.now) {
let faces = new Map<number, FaceRecord>();
let owners = new Map<number, Address>();
let ownerReadAt = new Map<number, number>();
let ownersAt = 0;
let forceOwners = false;
const OWNERS_TTL_MS = 10 * 60_000;
const RECENT = 120;

/** One multicall in chunks. Existing Faces cannot be burned: every failure rejects the whole snapshot. */
async function multicallBatch<T>(ids: number[], fn: "faces" | "ownerOf", blockNumber: bigint): Promise<T[]> {
  if (!ids.length) return [];
  const c = { address, abi: ABI } as const;
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const res = await client.multicall({ contracts: chunk.map((id) => ({ ...c, functionName: fn, args: [BigInt(id)] as const })), allowFailure: true, blockNumber });
    res.forEach((r, j) => {
      if (r.status === "success") out.push(r.result as T);
      else throw new Error(`${fn}(${chunk[j]}) failed: ${scrubError(r.error)}`);
    });
  }
  return out;
}

async function refreshFaces(total: number, blockNumber: bigint): Promise<Map<number, FaceRecord>> {
  const missing: number[] = [];
  for (let id = 1; id <= total; id++) if (!faces.has(id)) missing.push(id);
  const res = await multicallBatch<readonly [bigint, bigint, number, Address]>(missing, "faces", blockNumber);
  const next = new Map([...faces].filter(([id]) => id <= total));
  res.forEach((r, i) => {
    if (r[3] === "0x0000000000000000000000000000000000000000") throw new Error("missing face in supply");
    next.set(missing[i], { id: missing[i], seed: r[0], pins: r[1], one: Number(r[2]), renderer: r[3] });
  });
  return next;
}

/** Recent tokens refresh every read; the rest every 10 minutes. Written only when every chunk answered. */
async function refreshOwners(total: number, blockNumber: bigint) {
  const all = !ownersAt || total < owners.size || now() - ownersAt > OWNERS_TTL_MS || (forceOwners && now() - ownersAt >= TTL_MS);
  const from = all ? 1 : Math.max(1, total - RECENT);
  const wanted = new Set(Array.from({ length: Math.max(0, total - from + 1) }, (_, i) => from + i));
  for (let id = 1; id <= total; id++) if (!owners.has(id)) wanted.add(id);
  const ids = [...wanted];
  const res = await multicallBatch<Address>(ids, "ownerOf", blockNumber);
  const next = new Map([...owners].filter(([id]) => id <= total));
  const ages = new Map([...ownerReadAt].filter(([id]) => id <= total));
  res.forEach((r, i) => { next.set(ids[i], r); ages.set(ids[i], now()); });
  return { next, ages, all };
}

async function readChainState(): Promise<ChainState> {
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const c = { address, abi: ABI } as const;
  const [author, renderer, rendererLocked, total, pending, poolLeft, secondsLeft, epoch] = await client.multicall({
    contracts: [
      { ...c, functionName: "author" }, { ...c, functionName: "renderer" }, { ...c, functionName: "rendererLocked" },
      { ...c, functionName: "totalSupply" }, { ...c, functionName: "pending" }, { ...c, functionName: "poolLeft" }, { ...c, functionName: "secondsLeft" }, { ...c, functionName: "currentEpoch" },
    ],
    allowFailure: false,
    blockNumber,
  });
  const totalSupply = Number(total);
  const nextFaces = await refreshFaces(totalSupply, blockNumber);
  const nextOwners = await refreshOwners(totalSupply, blockNumber);
  faces = nextFaces; owners = nextOwners.next; ownerReadAt = nextOwners.ages;
  if (nextOwners.all) ownersAt = now();
  forceOwners = false;
  return { address, chainId: CHAIN_ID, author, renderer, rendererLocked, totalSupply, pending: Number(pending), poolLeft: Number(poolLeft), secondsLeft: Number(secondsLeft), epoch: Number(epoch), faces, owners, rolls, readAt: now(), ownersReadAt: ownersAt, ownerReadAt };
}
return { read: readChainState, requestAll: () => { forceOwners = true; } };
}

const reader = client && CONTRACT ? createFacesReader(client, CONTRACT) : null;

const store = new Swr<ChainState>({
  load: () => reader ? reader.read() : Promise.reject(new Error("no contract configured")),
  ttlMs: TTL_MS,
  staleAfterMs: STALE_AFTER_MS,
  deadlineMs: DEADLINE_MS,
  describe: scrubError,
  onError: (m, n) => console.error(`chain read failed (${n}):`, m),
});

/** The last good state at once, or null before the first read answers (see swr.ts). Never throws. */
export async function chainState(): Promise<ChainState | null> {
  if (!client || !CONTRACT) return null;
  return store.get();
}
export function readNow(): Promise<ChainState> {
  return store.refresh();
}

/** Explicit refreshes respect the same failure backoff as background reads. */
export function refreshAllowed(status: Pick<SwrStatus, "error" | "errorAt" | "failures">, now = Date.now()): boolean {
  return !status.error || status.errorAt === null || now - status.errorAt >= Math.min(60_000, 3_000 * 2 ** (status.failures - 1));
}

let holdingsRun: Promise<ChainState | null> | null = null;
export async function refreshHoldings(): Promise<ChainState | null> {
  if (!reader) return null;
  if (holdingsRun) return holdingsRun;
  if (!refreshAllowed(store.status())) return store.peek();
  const hit = store.peek();
  if (hit && Date.now() - (hit.ownersReadAt ?? 0) < TTL_MS) return hit;
  holdingsRun = (async () => {
    try { if (store.status().inflight) await store.refresh(); reader.requestAll(); await store.refresh(); } catch {}
    return store.peek();
  })().finally(() => { holdingsRun = null; });
  return holdingsRun;
}

export function dataFreshness(chain: ChainState, id?: number) {
  const readAt = id === undefined ? chain.ownersReadAt ?? chain.readAt : chain.ownerReadAt?.get(id) ?? chain.readAt;
  return { readAt: new Date(readAt).toISOString(), ageSeconds: Math.max(0, Math.floor((Date.now() - readAt) / 1000)), stale: Date.now() - readAt > STALE_AFTER_MS };
}
export function chainStatus(): ChainStatus {
  const s = store.status();
  return { configured: contractEnabled(), known: s.known, stale: s.stale, readAt: s.readAt, ageSeconds: s.ageSeconds, error: s.error, errorAt: s.errorAt, scannedBlock: scanned.toString(), scanned: scannedOnce };
}

export type RollCheck = { canRoll: boolean; lastRollEpoch: number; revealBlock: number; lastRevealBlock: number; head: number; epoch: number; soldOut: boolean };

/** One wallet's standing, read live: never from the cache, because a roll in progress changes it block by block. Throws when the RPC does not answer. */
export async function canRoll(wallet: Address): Promise<RollCheck> {
  if (!client || !CONTRACT) throw new Error("no contract configured");
  const c = { address: CONTRACT, abi: ABI } as const;
  const head = await client.getBlockNumber({ cacheTime: 0 });
  const [ok, last, rb, lrb, epoch, total, pending] = await client.multicall({ blockNumber: head, contracts: [{ ...c, functionName: "canRoll", args: [wallet] }, { ...c, functionName: "lastRollEpoch", args: [wallet] }, { ...c, functionName: "revealBlockOf", args: [wallet] }, { ...c, functionName: "lastRevealBlockOf", args: [wallet] }, { ...c, functionName: "currentEpoch" }, { ...c, functionName: "totalSupply" }, { ...c, functionName: "pending" }], allowFailure: false });
  return { canRoll: ok && Number(rb) === 0, lastRollEpoch: Number(last), revealBlock: Number(rb), lastRevealBlock: Number(lrb), head: Number(head), epoch: Number(epoch), soldOut: Number(total) + Number(pending) >= MAX_SUPPLY };
}

/** The token the Rolled event of a receipt minted for `wallet`, or null when the receipt carries none. */
export function rolledTokenOf(receipt: Pick<TransactionReceipt, "logs">, wallet: Address): number | null {
  for (const l of receipt.logs) {
    if (l.address.toLowerCase() !== (CONTRACT as string).toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: [ROLLED], data: l.data, topics: l.topics });
      if (ev.eventName === "Rolled" && ev.args.to.toLowerCase() === wallet.toLowerCase()) return Number(ev.args.tokenId);
    } catch {}
  }
  return null;
}

/** The token a wallet rolled in the epoch given, from the Rolled log over the last day of blocks. Null when none is found; throws when the RPC does not answer. */
export async function tokenRolledBy(wallet: Address, sinceBlock: bigint): Promise<number | null> {
  if (!client) return null;
  const head = await client.getBlockNumber();
  const from = sinceBlock < 0n ? 0n : sinceBlock;
  const logs = await client.getLogs({ address: CONTRACT as Address, event: ROLLED, args: { to: wallet }, fromBlock: from, toBlock: head });
  if (!logs.length) return null;
  return Number(logs[logs.length - 1].args.tokenId);
}

// ---- roll log ----
const rolls = new Map<number, Roll>();
/** Wallets with a commit not yet revealed, from the Committed log since the last scan. A scanner's view, not the contract's `pending()`. */
export const unrevealed = new Set<Address>();
const CHUNK = BigInt(process.env.LOG_CHUNK ?? "10000");
/** First block to scan: the contract's deploy block from CONTRACT_BLOCK, else the last 200,000 blocks (about five days on Base). */
let scanned = process.env.CONTRACT_BLOCK ? BigInt(process.env.CONTRACT_BLOCK) : -1n;
let scanning = false;
let scannedOnce = false;

export async function scanRolls(): Promise<void> {
  if (!client || scanning) return;
  scanning = true;
  try {
    const head = await client.getBlockNumber();
    if (scanned < 0n) scanned = head > 200_000n ? head - 200_000n : 0n;
    while (scanned < head) {
      const to = scanned + CHUNK > head ? head : scanned + CHUNK;
      const committed = await client.getLogs({ address: CONTRACT as Address, event: COMMITTED, fromBlock: scanned, toBlock: to });
      const logs = await client.getLogs({ address: CONTRACT as Address, event: ROLLED, fromBlock: scanned, toBlock: to });
      for (const l of logs) {
        const block = await client.getBlock({ blockNumber: l.blockNumber });
        rolls.set(Number(l.args.tokenId), { id: Number(l.args.tokenId), to: l.args.to!, tx: l.transactionHash, block: l.blockNumber, at: Number(block.timestamp), paid: l.args.paid! });
      }
      applyCommitEvents(unrevealed, [
        ...committed.map(l => ({ wallet: l.args.wallet!, kind: "commit" as const, blockNumber: l.blockNumber, logIndex: l.logIndex })),
        ...logs.map(l => ({ wallet: l.args.to!, kind: "reveal" as const, blockNumber: l.blockNumber, logIndex: l.logIndex })),
      ]);
      scanned = to + 1n;
    }
    scannedOnce = true;
  } catch (e) {
    console.error("roll scan:", scrubError(e));
  } finally {
    scanning = false;
  }
}
export function startRollScan(everyMs = 60_000): void {
  void scanRolls();
  setInterval(() => void scanRolls(), everyMs);
}
