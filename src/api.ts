/** JSON for other people's code and the spec. Everything here is derived; nothing is stored. */
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { WEIGHTS, SKIN_WEIGHTS, SKINS, HAIRS, TOPCOLORS, GROUNDS, ACCENTS, attributesOf, rarityOf, unpackPins, PIN_PRICES_WEI, PIN_KEYS, TIER_WEIGHT } from "./faces.ts";
import { SITE, traitsOfRecord, isAuthor, opensea, explorer, MAX_SUPPLY, type Names, NO_NAMES } from "./site.ts";
import { unrevealed, type ChainState, type FaceRecord } from "./contract.ts";
const unrevealedList = () => unrevealed;
import type { Address } from "viem";

export function faceJson(f: FaceRecord, chain: ChainState, names: Names = NO_NAMES) {
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
    treasury: owner ? isAuthor(chain, owner) : false,
    roll: roll ? { tx: roll.tx, block: Number(roll.block), at: roll.at, paidWei: roll.paid.toString(), explorer: `${explorer(chain.chainId)}/tx/${roll.tx}` } : null,
    image: `https://${SITE}/face/${f.id}.svg`,
    card: `https://${SITE}/face/${f.id}.png`,
    url: `https://${SITE}/face/${f.id}`,
    opensea: opensea(chain, f.id),
  };
}

export function stateJson(chain: ChainState | null, names: Names = NO_NAMES) {
  const recent = chain ? Array.from({ length: Math.min(40, chain.totalSupply) }, (_, i) => chain.totalSupply - i).map((id) => chain.faces.get(id)).filter(Boolean).map((f) => faceJson(f!, chain, names)) : [];
  return {
    site: SITE,
    contract: chain ? { address: chain.address, chainId: chain.chainId, renderer: chain.renderer, rendererLocked: chain.rendererLocked, author: chain.author } : null,
    totalSupply: chain?.totalSupply ?? 0,
    pending: chain ? [...unrevealedList()].length : 0,
    maxSupply: MAX_SUPPLY,
    poolLeft: chain?.poolLeft ?? ONE_OF_ONES.length,
    secondsLeft: chain?.secondsLeft ?? null,
    pinPricesWei: PIN_PRICES_WEI.map((p) => p.toString()),
    recent,
  };
}

export function holderJson(who: Address, chain: ChainState, names: Names = NO_NAMES) {
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === who.toLowerCase()).map(([id]) => id).sort((a, b) => a - b);
  return { address: who, name: names.get(who.toLowerCase()) ?? null, treasury: isAuthor(chain, who), count: mine.length, faces: mine.map((id) => faceJson(chain.faces.get(id)!, chain, names)) };
}

export function specJson() {
  return {
    site: SITE,
    version: 1,
    canvas: { size: 32, bitsPerPixel: 3, roles: ["none", "outline", "fill", "shade", "light", "second", "secondShade", "white"] },
    draw: { mixer: "splitmix64 finalizer", seed: "keccak256(blockhash(commitBlock + 1), wallet, pins, commitBlock, tokenId) as uint64", perDraw: "mix64(seed + i) mod 10000", order: [...SLOTS.map((s) => s.slot), "skin", "hairColour", "topColour", "ground", "accent", "lucky", "poolIndex"] },
    tierWeights: TIER_WEIGHT,
    slots: SLOTS.map((s, k) => ({ slot: s.slot, trait: s.trait, pinnable: s.pinnable, group: s.group, items: s.items.map((it, i) => ({ name: it.name, tier: it.tier, weight: WEIGHTS[k][i] })) })),
    pinKeys: PIN_KEYS,
    pinsEncoding: "uint64, one byte per pin key high byte first, 0xff for none, spare bytes 0xff",
    pinPricesWei: PIN_PRICES_WEI.map((p) => p.toString()),
    skins: SKINS.map((s, i) => ({ ...s, weight: SKIN_WEIGHTS[i] })),
    hairColours: HAIRS, topColours: TOPCOLORS, grounds: GROUNDS, accents: ACCENTS,
    oneOfOnes: ONE_OF_ONES.map((o) => ({ name: o.name, main: o.main, second: o.second })),
    oneOfOneOdds: "poolLeft / tokensLeft per roll without pins",
    maxSupply: MAX_SUPPLY,
    rule: "one roll per wallet per UTC day, as commit then reveal one block later; up to three pins on the pin keys, common or uncommon items only; any roll may take a one of one with odds poolLeft / tokensLeft",
  };
}
