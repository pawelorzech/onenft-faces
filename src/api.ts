/** JSON for other people's code and the spec. Everything here is derived; nothing is stored. */
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { WEIGHTS, SKIN_WEIGHTS, SKINS, HAIRS, TOPCOLORS, GROUNDS, ACCENTS, attributesOf, rarityOf, unpackPins, PIN_PRICES_WEI, PIN_KEYS, MAX_PINS, TIER_WEIGHT } from "./faces.ts";
import { SITE, traitsOfRecord, isAuthor, opensea, explorer, MAX_SUPPLY, pinRule, ethOf, type Names, NO_NAMES } from "./site.ts";
import { unrevealed, type ChainState, type ChainStatus, type FaceRecord } from "./contract.ts";
import type { RevealResult } from "./autoclaim.ts";
import type { Address } from "viem";

/** How old the data in an answer is. `known` false means no chain read ever succeeded, so counts are null, never zero. */
export function chainBlock(status: ChainStatus | null) {
  if (!status?.configured) return { configured: false, known: false, stale: false, readAt: null, ageSeconds: null, error: null, scanned: false };
  return { configured: true, known: status.known, stale: status.stale, readAt: status.readAt === null ? null : new Date(status.readAt).toISOString(), ageSeconds: status.ageSeconds, error: status.error, scanned: status.scanned };
}

export function faceJson(f: FaceRecord, chain: ChainState, names: Names = NO_NAMES, status: ChainStatus | null = null) {
  const t = traitsOfRecord(f);
  const owner = chain.owners.get(f.id);
  const roll = chain.rolls.get(f.id);
  return {
    id: f.id,
    seed: f.seed.toString(),
    pins: unpackPins(f.pins),
    oneOfOne: f.one === 255 ? null : ONE_OF_ONES[f.one].name,
    rarity: rarityOf(t),
    attributes: attributesOf(t),
    owner: owner ?? null,
    ownerName: owner ? names.get(owner.toLowerCase()) ?? null : null,
    /** The current holder is the author's wallet. Whether the author rolled it is `roll.treasury`. */
    treasury: owner ? isAuthor(chain, owner) : false,
    roll: roll ? { to: roll.to, treasury: isAuthor(chain, roll.to), tx: roll.tx, block: Number(roll.block), at: roll.at, paidWei: roll.paid.toString(), explorer: `${explorer(chain.chainId)}/tx/${roll.tx}` } : null,
    image: `https://${SITE}/face/${f.id}.svg`,
    png: `https://${SITE}/face/${f.id}-1024.png`,
    card: `https://${SITE}/face/${f.id}.png`,
    url: `https://${SITE}/face/${f.id}`,
    opensea: opensea(chain, f.id),
    chain: chainBlock(status),
  };
}

export function stateJson(chain: ChainState | null, names: Names = NO_NAMES, status: ChainStatus | null = null) {
  const recent = chain ? Array.from({ length: Math.min(40, chain.totalSupply) }, (_, i) => chain.totalSupply - i).map((id) => chain.faces.get(id)).filter(Boolean).map((f) => faceJson(f!, chain, names, status)) : [];
  return {
    site: SITE,
    kind: "rolls",
    contract: chain ? { address: chain.address, chainId: chain.chainId, renderer: chain.renderer, rendererLocked: chain.rendererLocked, author: chain.author } : null,
    /** Null, not zero, when the chain never answered. */
    totalSupply: chain?.totalSupply ?? null,
    /** Commits not yet revealed, from the contract. They hold a place in the supply. */
    pending: chain?.pending ?? null,
    /** What the scanner has seen committed and not yet rolled; can lag the contract. */
    unrevealedSeen: chain && status?.scanned ? unrevealed.size : null,
    maxSupply: MAX_SUPPLY,
    left: chain ? Math.max(0, MAX_SUPPLY - chain.totalSupply - chain.pending) : null,
    soldOut: chain ? chain.totalSupply + chain.pending >= MAX_SUPPLY : null,
    poolLeft: chain?.poolLeft ?? null,
    epoch: chain?.epoch ?? null,
    secondsLeft: chain?.secondsLeft ?? null,
    pinPricesWei: PIN_PRICES_WEI.map((p) => p.toString()),
    chain: chainBlock(status),
    recent,
  };
}

export function holderJson(who: Address, chain: ChainState, names: Names = NO_NAMES, status: ChainStatus | null = null) {
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === who.toLowerCase()).map(([id]) => id).sort((a, b) => a - b);
  return { address: who, name: names.get(who.toLowerCase()) ?? null, treasury: isAuthor(chain, who), count: mine.length, chain: chainBlock(status), faces: mine.map((id) => faceJson(chain.faces.get(id)!, chain, names, status)) };
}

/** The standing of one wallet's roll, for the builder's polling. */
export function rollJson(r: RevealResult, keeper: { armed: boolean; address: Address | null; pending: number }, status: ChainStatus | null) {
  return {
    address: r.address,
    state: r.state,
    tx: r.hash ?? null,
    tokenId: r.tokenId ?? null,
    revealBlock: r.revealBlock ?? null,
    head: r.head ?? null,
    epoch: r.epoch ?? null,
    rolledToday: r.rolledToday ?? null,
    soldOut: r.soldOut ?? null,
    sentAgo: r.sentAgo ?? null,
    reason: r.reason ?? null,
    keeper: { armed: keeper.armed, pending: keeper.pending },
    chain: chainBlock(status),
  };
}

export function specJson() {
  return {
    site: SITE,
    version: 1,
    canvas: { size: 32, bitsPerPixel: 3, roles: ["none", "outline", "fill", "shade", "light", "second", "secondShade", "white"] },
    draw: { mixer: "splitmix64 finalizer", seed: "keccak256(blockhash(commitBlock + 1), wallet, pins, commitBlock) as uint64; reveal allowed from commitBlock + 2 to commitBlock + 256, renew past that", perDraw: "mix64(seed + i) mod 10000", order: [...SLOTS.map((s) => s.slot), "skin", "hairColour", "topColour", "ground", "accent", "lucky", "poolIndex"] },
    tierWeights: TIER_WEIGHT,
    slots: SLOTS.map((s, k) => ({ slot: s.slot, trait: s.trait, pinnable: s.pinnable, group: s.group, items: s.items.map((it, i) => ({ name: it.name, tier: it.tier, weight: WEIGHTS[k][i] })) })),
    pinKeys: PIN_KEYS,
    maxPins: MAX_PINS,
    pinsEncoding: "uint128, one byte per pin key high byte first, 0xff for none, spare bytes 0xff",
    pinPricesWei: PIN_PRICES_WEI.map((p) => p.toString()),
    pinPricesEth: PIN_PRICES_WEI.map((p) => ethOf(p)),
    skins: SKINS.map((s, i) => ({ ...s, weight: SKIN_WEIGHTS[i] })),
    hairColours: HAIRS, topColours: TOPCOLORS, grounds: GROUNDS, accents: ACCENTS,
    oneOfOnes: ONE_OF_ONES.map((o) => ({ name: o.name, main: o.main, second: o.second })),
    oneOfOneOdds: "poolLeft / tokensLeft per roll, with or without pins; a one of one keeps the pinned background and ground colour and replaces every other pin",
    maxSupply: MAX_SUPPLY,
    rule: `one roll per wallet per UTC day while supply remains, as commit then reveal from two blocks later within 256 blocks (renew past that); ${pinRule()}; any roll may take a one of one with odds poolLeft / tokensLeft`,
  };
}
