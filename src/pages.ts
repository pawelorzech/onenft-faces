/** Inner pages: rarity, the 1/1 gallery, holders, assets. */
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { WEIGHTS, SKIN_WEIGHTS, SKINS, HAIRS, TOPCOLORS, GROUNDS, ACCENTS, svgOf, groundOf, pinOk, skinPinOk, combinations, rarityOf, BASE_TRAITS, type Traits } from "./faces.ts";
import { SITE, REPO, PARENT, layout, topBar, esc, num, label, isAuthor, tierTag, pageTraits, traitsOfRecord, stripSize, explorer, chainName, openseaCollection, opensea, shortAddr, MAX_SUPPLY, type Names, NO_NAMES } from "./site.ts";
import type { ChainState } from "./contract.ts";
import type { Address } from "viem";

const pct = (w: number) => (w / 100).toFixed(w >= 100 ? 0 : 2) + "%";

export function rarityPage(chain: ChainState | null, epoch: number): string {
  const p = groundOf(pageTraits(chain, epoch));
  const tables = SLOTS.map((s, k) => {
    const rows = s.items.map((it, i) => `<tr><td><img class="px" src="/item/${s.slot}/${i}.svg" alt="" width="40" height="40" loading="lazy">${esc(it.name)}${tierTag(it.tier)}</td><td>${s.pinnable ? (pinOk(k, i) ? "pin" : "luck only") : "luck"}</td><td class="n">${pct(WEIGHTS[k][i])}</td></tr>`).join("");
    return `<div id="s${k}"><h3 class="syne">${esc(s.trait)}, ${s.items.length} items${s.pinnable ? ", pinnable" : ", never pinnable"}</h3><table class="tr"><thead><tr><th>item</th><th>how you get it</th><th style="text-align:right">odds per roll</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  });
  const skins = `<div><h3 class="syne">Skin, ${SKINS.length} tones, pinnable</h3><table class="tr"><tbody>${SKINS.map((s, i) => `<tr><td><i style="display:inline-block;width:40px;height:40px;background:${s.main};vertical-align:middle;margin-right:8px;box-shadow:0 0 0 1px var(--line)"></i>${esc(s.name)}${tierTag(s.tier)}</td><td>${skinPinOk(i) ? "pin" : "luck only"}</td><td class="n">${pct(SKIN_WEIGHTS[i])}</td></tr>`).join("")}</tbody></table></div>`;
  const colours = [["Hair colour", HAIRS, "pinnable"], ["Top colour", TOPCOLORS, "luck"], ["Ground", GROUNDS, "pinnable"], ["Accent", ACCENTS, "luck"]].map(([name, list, how]) => `<div><h3 class="syne">${name}, ${(list as any[]).length}, even odds, ${how}</h3><p class="small">${(list as { name: string; main: string }[]).map((c) => `<i style="display:inline-block;width:18px;height:18px;background:${c.main};vertical-align:middle;margin-right:4px;box-shadow:0 0 0 1px var(--line)"></i>${esc(c.name)}`).join(" &nbsp; ")}</p></div>`).join("");
  const body = `<main class="wide">
${topBar()}
<h2 class="syne">Every item and its odds</h2>
<p style="max-width:640px">Tiers set the weights: a common item weighs 100, an uncommon 35, a rare 8, a legendary 1, scaled so every slot sums to 10,000. A face's rarity is its rarest part. ${num(combinations())} combinations, plus ${ONE_OF_ONES.length} one of ones, odds of pool left over tokens left per unpinned roll.</p>
${tables.join("")}
${skins}
${colours}
<p class="small"><a href="/">Back to the roll</a></p>
</main>`;
  return layout(`Rarity | ${SITE}`, p, body, "/today.png", "/rarity");
}

export function onesPage(chain: ChainState | null, epoch: number, names: Names = NO_NAMES): string {
  const p = groundOf(pageTraits(chain, epoch));
  const holders = new Map<number, number>();
  if (chain) for (const f of chain.faces.values()) if (f.one !== 255) holders.set(f.one, f.id);
  const tiles = ONE_OF_ONES.map((o, i) => {
    const t: Traits = { ...BASE_TRAITS, one: i, ground: (i * 3) % GROUNDS.length };
    const id = holders.get(i);
    const owner = id ? chain!.owners.get(id) : undefined;
    const cap = id ? `#${id}, ${owner ? (isAuthor(chain!, owner) ? "the treasury's" : label(owner, names)) : "rolled"}` : "still in the pool";
    const img = `<div class="px">${stripSize(svgOf(t, 240))}</div>`;
    return id ? `<a href="/face/${id}" class="gone">${img}<div class="cap">${esc(o.name)}, ${cap}</div></a>` : `<div>${img}<div class="cap">${esc(o.name)}, ${cap}</div></div>`;
  });
  const body = `<main class="wide">
${topBar()}
<h2 class="syne">One of ones</h2>
<p style="max-width:640px">${ONE_OF_ONES.length} drawings, each once. A roll without pins takes one with odds of pool left over tokens left; the contract then removes it from the pool. ${chain ? `${chain.poolLeft} still in the pool.` : ""} The ground behind a one of one is the token's own.</p>
<div class="strip">${tiles.join("")}</div>
<p class="small"><a href="/">Back to the roll</a></p>
</main>`;
  return layout(`One of ones | ${SITE}`, p, body, "/today.png", "/ones");
}

export function holderPage(who: Address, handle: string, chain: ChainState, names: Names = NO_NAMES): string {
  const p = groundOf(pageTraits(chain, chain.epoch));
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === who.toLowerCase()).map(([id]) => id).sort((a, b) => a - b);
  const name = names.get(who.toLowerCase()) ?? (handle.endsWith(".eth") ? handle : shortAddr(who));
  const tiles = mine.map((id) => { const t = traitsOfRecord(chain.faces.get(id)!); return `<a href="/face/${id}"><img class="px" src="/face/${id}.svg" alt="" loading="lazy"><div class="cap">#${id}${rarityOf(t) !== "common" ? `, ${rarityOf(t)}` : ""}</div></a>`; }).join("");
  const body = `<main class="wide">
${topBar()}
<h2 class="syne">${esc(name)}</h2>
<p class="lead">${mine.length ? `${mine.length} ${mine.length === 1 ? "face" : "faces"}${isAuthor(chain, who) ? ", the treasury" : ""}.` : "No faces yet."} <span class="small"><a href="${explorer(chain.chainId)}/address/${who}">${who}</a></span></p>
${tiles ? `<div class="strip">${tiles}</div>` : ""}
<p class="small"><a href="/">Back to the roll</a> · <a href="/api/holder/${who}">JSON</a></p>
</main>`;
  return layout(`${name} | ${SITE}`, p, body, "/today.png", `/${handle}`);
}

export function assetsPage(chain: ChainState | null, epoch: number): string {
  const p = groundOf(pageTraits(chain, epoch));
  const img = esc(`<img src="https://${SITE}/face/1.svg" width="256" height="256" alt="Face #1 of faces.onenft.click" style="image-rendering:pixelated">`);
  const body = `<main class="prose">
${topBar()}
<h2 class="syne">Take it. It is yours.</h2>
<p>Everything here is <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>: every face, every sprite, the contracts, this site. The sprites were drawn for this project. No credit needed, no permission to ask. Print it, remix it, mint it elsewhere. Owning a face gives you the token; the image belongs to everyone.</p>
<h2 class="syne">Images</h2>
<p>Any face as SVG at <code>/face/N.svg</code> and as a 1200 by 630 card at <code>/face/N.png</code>. Any single item on a neutral stand-in at <code>/item/SLOT/N.svg</code>, slots ${SLOTS.map((s) => `<code>${s.slot}</code>`).join(", ")}. The SVG is the same file the contract holds. Render it with <code>image-rendering: pixelated</code> so the pixels stay square.</p>
<pre class="snip">${img}</pre>
<h2 class="syne">Data</h2>
<p><a href="/api/state">/api/state</a> gives the supply, the pool and the newest faces. <code>/api/face/N</code> returns one face: seed, pins, traits with tiers, rarity, owner, roll transaction, image links. <code>/api/holder/ADDRESS</code> lists one wallet's faces. <code>/api/can-roll/ADDRESS</code> says whether a wallet may roll today. <a href="/spec.json">/spec.json</a> holds the draw, the weight tables, the palettes and every item name, so you can port the generator. All JSON, open to any origin.</p>
<h2 class="syne">Code and contract</h2>
<p>The generator in TypeScript and Solidity, the site and the contracts: <a href="${REPO}">${REPO.replace("https://", "")}</a>.${chain ? ` Token contract <a href="${explorer(chain.chainId)}/address/${chain.address}">${chain.address}</a> on ${chainName(chain.chainId)}. <a href="${openseaCollection(chain)}">Collection on OpenSea</a>.` : ""} Every collection: <a href="https://${PARENT}">${PARENT}</a>.</p>
<p class="small"><a href="/">Back to the roll</a></p>
</main>`;
  return layout(`Assets | ${SITE}`, p, body, "/today.png", "/assets");
}
