/**
 * Reads state from the OneNFT contract. Without CONTRACT_ADDRESS the site
 * runs as a plain renderer with no chain.
 */
import { createPublicClient, http, parseAbi, parseAbiItem, toFunctionSelector, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";

export const CONTRACT = (process.env.CONTRACT_ADDRESS ?? "") as Address | "";
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? (CONTRACT ? 84532 : 0));
export const chain = CHAIN_ID === 8453 ? base : baseSepolia;
export const EPOCH_SECONDS = 86400;

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
  "function priceOf(uint64 pins) view returns (uint256)",
  "function faces(uint256 tokenId) view returns (uint64 seed, uint64 pins, uint8 one, address renderer)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function roll(uint64 pins) payable returns (uint256)",
  "function rollForTreasury() returns (uint256)",
]);
export const ROLL_SELECTOR = toFunctionSelector("function roll(uint64 pins)");
const ROLLED = parseAbiItem("event Rolled(uint256 indexed tokenId, address indexed to, uint64 seed, uint64 pins, uint8 one, uint256 paid)");

export type FaceRecord = { id: number; seed: bigint; pins: bigint; one: number; renderer: Address };
export type Roll = { id: number; to: Address; tx: Hex; block: bigint; at: number; paid: bigint };

export type ChainState = {
  address: Address;
  chainId: number;
  author: Address;
  renderer: Address;
  rendererLocked: boolean;
  totalSupply: number;
  poolLeft: number;
  secondsLeft: number;
  epoch: number;
  /** id → seed, pins, 1/1; immutable once rolled, cached forever. */
  faces: Map<number, FaceRecord>;
  /** id → current owner. */
  owners: Map<number, Address>;
  /** id → the roll transaction, once the log scan has reached it. */
  rolls: Map<number, Roll>;
};

const client = CONTRACT ? createPublicClient({ chain, transport: http(process.env.BASE_RPC_URL) }) : null;
export function contractEnabled(): boolean {
  return Boolean(client && CONTRACT);
}

let cache: { at: number; state: ChainState } | null = null;
const TTL_MS = 12_000;
const faces = new Map<number, FaceRecord>();
const owners = new Map<number, Address>();
let ownersAt = 0;
const OWNERS_TTL_MS = 10 * 60_000;
const RECENT = 120;

async function multicallBatch<T>(ids: number[], fn: "faces" | "ownerOf"): Promise<(T | null)[]> {
  if (!client || !ids.length) return [];
  const c = { address: CONTRACT as Address, abi: ABI } as const;
  const out: (T | null)[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const res = await client.multicall({ contracts: chunk.map((id) => ({ ...c, functionName: fn, args: [BigInt(id)] as const })), allowFailure: true });
    for (const r of res) out.push(r.status === "success" ? (r.result as T) : null);
  }
  return out;
}

async function refreshFaces(total: number): Promise<void> {
  const missing: number[] = [];
  for (let id = 1; id <= total; id++) if (!faces.has(id)) missing.push(id);
  const res = await multicallBatch<readonly [bigint, bigint, number, Address]>(missing, "faces");
  res.forEach((r, i) => { if (r) faces.set(missing[i], { id: missing[i], seed: r[0], pins: r[1], one: Number(r[2]), renderer: r[3] }); });
}

/** Recent tokens refresh every call; the rest every 10 minutes. */
async function refreshOwners(total: number): Promise<void> {
  const all = Date.now() - ownersAt > OWNERS_TTL_MS;
  const from = all ? 1 : Math.max(1, total - RECENT);
  const ids = Array.from({ length: total - from + 1 }, (_, i) => from + i);
  const res = await multicallBatch<Address>(ids, "ownerOf");
  res.forEach((r, i) => { if (r) owners.set(ids[i], r); });
  if (all) ownersAt = Date.now();
}

export async function chainState(): Promise<ChainState | null> {
  if (!client || !CONTRACT) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.state;
  const c = { address: CONTRACT, abi: ABI } as const;
  const [author, renderer, rendererLocked, total, poolLeft, secondsLeft, epoch] = await client.multicall({
    contracts: [
      { ...c, functionName: "author" }, { ...c, functionName: "renderer" }, { ...c, functionName: "rendererLocked" },
      { ...c, functionName: "totalSupply" }, { ...c, functionName: "poolLeft" }, { ...c, functionName: "secondsLeft" }, { ...c, functionName: "currentEpoch" },
    ],
    allowFailure: false,
  });
  const totalSupply = Number(total);
  await refreshFaces(totalSupply);
  await refreshOwners(totalSupply);
  const state: ChainState = { address: CONTRACT, chainId: CHAIN_ID, author, renderer, rendererLocked, totalSupply, poolLeft: Number(poolLeft), secondsLeft: Number(secondsLeft), epoch: Number(epoch), faces, owners, rolls };
  cache = { at: Date.now(), state };
  return state;
}

export async function canRoll(wallet: Address): Promise<{ canRoll: boolean; lastRollEpoch: number }> {
  if (!client || !CONTRACT) return { canRoll: false, lastRollEpoch: 0 };
  const c = { address: CONTRACT, abi: ABI } as const;
  const [ok, last] = await client.multicall({ contracts: [{ ...c, functionName: "canRoll", args: [wallet] }, { ...c, functionName: "lastRollEpoch", args: [wallet] }], allowFailure: false });
  return { canRoll: ok, lastRollEpoch: Number(last) };
}

// ---- roll log ----
const rolls = new Map<number, Roll>();
const CHUNK = BigInt(process.env.LOG_CHUNK ?? "10000");
/** First block to scan: the contract's deploy block from CONTRACT_BLOCK, else the last 200,000 blocks (about five days on Base). */
let scanned = process.env.CONTRACT_BLOCK ? BigInt(process.env.CONTRACT_BLOCK) : -1n;
let scanning = false;

export async function scanRolls(): Promise<void> {
  if (!client || scanning) return;
  scanning = true;
  try {
    const head = await client.getBlockNumber();
    if (scanned < 0n) scanned = head > 200_000n ? head - 200_000n : 0n;
    while (scanned < head) {
      const to = scanned + CHUNK > head ? head : scanned + CHUNK;
      const logs = await client.getLogs({ address: CONTRACT as Address, event: ROLLED, fromBlock: scanned, toBlock: to });
      for (const l of logs) {
        const block = await client.getBlock({ blockNumber: l.blockNumber });
        rolls.set(Number(l.args.tokenId), { id: Number(l.args.tokenId), to: l.args.to!, tx: l.transactionHash, block: l.blockNumber, at: Number(block.timestamp), paid: l.args.paid! });
      }
      scanned = to + 1n;
    }
  } catch (e) {
    console.error("roll scan:", (e as Error).message);
  } finally {
    scanning = false;
  }
}
export function startRollScan(everyMs = 60_000): void {
  void scanRolls();
  setInterval(() => void scanRolls(), everyMs);
}
