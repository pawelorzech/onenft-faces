/** Inner pages: rarity, the 1/1 gallery, holders, your wallet, assets. */
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { WEIGHTS, SKIN_WEIGHTS, SKINS, HAIRS, TOPCOLORS, GROUNDS, ACCENTS, svgOf, groundOf, pinOk, skinPinOk, combinations, rarityOf, unpackPins, BASE_TRAITS, type Traits } from "./faces.ts";
import { SITE, REPO, PARENT, FILE_PREFIX, layout, topBar, esc, num, plural, label, isAuthor, tierTag, pageTraits, traitsOfRecord, stripSize, explorer, chainName, openseaCollection, opensea, shortAddr, MAX_SUPPLY, staleNote, whoBlock, sizePicker, downloadBar, connectScript, downloadScript, nameHeading, traitList, heldBy, rolledBy, dateOf, eth, type Names, NO_NAMES } from "./site.ts";
import type { ChainState, ChainStatus } from "./contract.ts";
import type { Address } from "viem";

const pct = (w: number) => (w / 100).toFixed(w >= 100 ? 0 : 2) + "%";

export function rarityPage(chain: ChainState | null, epoch: number): string {
  const p = groundOf(pageTraits(chain, epoch));
  const tables = SLOTS.map((s, k) => {
    const rows = s.items.map((it, i) => `<tr><td><img class="px" src="/item/${s.slot}/${i}.svg" alt="" width="40" height="40" loading="lazy">${esc(it.name)}${tierTag(it.tier)}</td><td>${s.pinnable ? (pinOk(k, i) ? "pin or luck" : "luck only") : "luck only"}</td><td class="n">${pct(WEIGHTS[k][i])}</td></tr>`).join("");
    return `<div id="s${k}"><h3 class="syne">${esc(s.trait)}, ${s.items.length} items${s.pinnable ? ", pinnable" : ", never pinnable"}</h3><div class="scroll"><table class="tr"><thead><tr><th>item</th><th>how you get it</th><th style="text-align:right">odds per roll</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  });
  const skins = `<div><h3 class="syne">Skin, ${SKINS.length} tones, pinnable</h3><div class="scroll"><table class="tr"><tbody>${SKINS.map((s, i) => `<tr><td><i style="display:inline-block;width:40px;height:40px;background:${s.main};vertical-align:middle;margin-right:8px;box-shadow:0 0 0 1px var(--line)"></i>${esc(s.name)}${tierTag(s.tier)}</td><td>${skinPinOk(i) ? "pin or luck" : "luck only"}</td><td class="n">${pct(SKIN_WEIGHTS[i])}</td></tr>`).join("")}</tbody></table></div></div>`;
  const colours = [["Hair colour", HAIRS], ["Top colour", TOPCOLORS], ["Ground", GROUNDS], ["Accent", ACCENTS]].map(([name, list]) => `<div><h3 class="syne">${name}, ${(list as any[]).length}, even odds, pinnable</h3><p class="small">${(list as { name: string; main: string }[]).map((c) => `<i style="display:inline-block;width:18px;height:18px;background:${c.main};vertical-align:middle;margin-right:4px;box-shadow:0 0 0 1px var(--line)"></i>${esc(c.name)}`).join(" &nbsp; ")}</p></div>`).join("");
  const body = `<main class="wide" id="main">
${topBar("Rarity")}
<h2 class="syne">Every item and its odds</h2>
<p style="max-width:640px">Tiers set the weights: a common item weighs 100, an uncommon 35, a rare 8, a legendary 1, scaled so every slot sums to 10,000. A face's rarity is its rarest part. Tier "u" in the builder marks an uncommon item. ${num(combinations())} combinations, plus ${ONE_OF_ONES.length} one of ones ("1/1": a drawing that exists once), with odds of pool left over tokens left on every roll, pinned or not.</p>
${tables.join("")}
${skins}
${colours}
<p class="small"><a href="/">Back to the roll</a></p>
</main>`;
  return layout(`Rarity | ${SITE}`, p, body, "/today.png", "/rarity");
}

export function onesPage(chain: ChainState | null, epoch: number, names: Names = NO_NAMES, status: ChainStatus | null = null): string {
  const p = groundOf(pageTraits(chain, epoch));
  const holders = new Map<number, number>();
  if (chain) for (const f of chain.faces.values()) if (f.one !== 255) holders.set(f.one, f.id);
  const tiles = ONE_OF_ONES.map((o, i) => {
    const t: Traits = { ...BASE_TRAITS, one: i, ground: (i * 3) % GROUNDS.length };
    const id = holders.get(i);
    const cap = id ? `#${id}, ${heldBy(chain!, id, names) || "rolled"}` : chain ? "still in the pool" : "pool status unknown";
    const img = `<div class="px">${stripSize(svgOf(t, 240))}</div>`;
    return id ? `<a href="/face/${id}" class="gone">${img}<div class="cap">${esc(o.name)}, ${cap}</div></a>` : `<div>${img}<div class="cap">${esc(o.name)}, ${cap}</div></div>`;
  });
  const body = `<main class="wide" id="main">
${topBar("One of ones")}
${staleNote(status)}
<h2 class="syne">One of ones</h2>
<p style="max-width:640px">${ONE_OF_ONES.length} drawings, each once. Any roll, pinned or not, takes one with odds of pool left over tokens left; the contract then removes it from the pool. A one of one keeps the pinned background and ground colour and replaces every other pin. ${chain ? `${chain.poolLeft} still in the pool.` : ""} The ground behind a one of one is the token's own.</p>
<div class="strip">${tiles.join("")}</div>
<p class="small"><a href="/">Back to the roll</a></p>
</main>`;
  return layout(`One of ones | ${SITE}`, p, body, "/today.png", "/ones");
}

/** The way in: connect a wallet or type an address, then land on that wallet's page. */
export function yoursPage(chain: ChainState | null, epoch: number, status: ChainStatus | null = null, bad: string | null = null): string {
  const p = groundOf(pageTraits(chain, epoch));
  const body = `<main class="wide" id="main">
${topBar("Your wallet")}
${staleNote(status)}
<div><h2 class="syne">Your faces</h2><p class="lead" style="margin-top:8px">Connect a wallet or type an address, and this page lists every face it holds, each one ready to save as SVG, PNG or JPEG.</p></div>
${bad !== null ? `<p class="note" role="alert">"${esc(bad)}" is not a wallet address or an ENS name. An address is 42 characters starting with 0x; a name ends in .eth.</p>` : ""}
${whoBlock(chain, status)}
<p class="small">Viewing a wallet needs no transaction and no signature. Its public address appears in the page URL and is sent to this site to load its tokens. The same list is on <a href="https://${PARENT}/wallet">${PARENT}</a> for every collection at once; each site connects on its own.</p>
</main>
${connectScript("/", true)}`;
  return layout(`Your faces | ${SITE}`, p, body, "/today.png", "/yours");
}

export function holderPage(who: Address, handle: string, chain: ChainState, names: Names = NO_NAMES, status: ChainStatus | null = null): string {
  const p = groundOf(pageTraits(chain, chain.epoch));
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === who.toLowerCase()).map(([id]) => id).sort((a, b) => b - a);
  const rawName = names.get(who.toLowerCase()) ?? shortAddr(who);
  const rows = mine.map((id) => {
    const f = chain.faces.get(id)!;
    const t = traitsOfRecord(f);
    const g = groundOf(t);
    const roll = chain.rolls.get(id);
    const pinsN = Object.keys(unpackPins(f.pins)).length;
    const links = [roll ? `<a href="${explorer(chain.chainId)}/tx/${roll.tx}">Transaction</a>` : "", `<a href="${opensea(chain, id)}">OpenSea</a>`, `<a href="/face/${id}">Face page</a>`].filter(Boolean).join(", ");
    return `<div class="tok" id="face-${id}">
<a href="/face/${id}"><img class="px" src="/face/${id}.svg" width="256" height="256" alt="Face ${id}" loading="lazy"></a>
<div class="meta">
<div class="num syne">#${id}${tierTag(rarityOf(t))}</div>
<p class="small" style="margin:0">${roll ? `${rolledBy(chain, id, names) || "rolled"}, ${dateOf(Math.floor(roll.at / 86400))}${roll.paid ? `, pin fee ${eth(roll.paid)}` : ""}` : pinsN ? `${pinsN} ${plural(pinsN, "pin", "pins")}` : "no pins"}${f.one !== 255 ? ", one of one" : ""}</p>
${traitList(t)}
<p class="small" style="margin:0">${links}.</p>
${downloadBar(id, g.bg)}
</div>
</div>`;
  });
  const body = `<main class="wide" id="main">
${topBar(rawName)}
${staleNote(status)}
<div><h2 class="syne">${nameHeading(rawName)}</h2><p class="lead" style="margin-top:8px">${mine.length ? `${mine.length} ${plural(mine.length, "face", "faces")}${isAuthor(chain, who) ? ", the treasury" : ""}.` : "No faces yet."}${handle.toLowerCase() !== who.toLowerCase() ? ` <span class="small">${shortAddr(who)}</span>` : ""}</p></div>
${whoBlock(chain, status)}
${rows.length ? `${sizePicker()}\n<div>${rows.join("\n")}</div>` : `<p>No faces here yet. <a href="/">Roll one</a> today.</p>`}
<nav class="nav small" style="padding-top:20px;border-top:1px solid var(--line)" aria-label="Wallet links"><a href="${explorer(chain.chainId)}/address/${who}">Basescan</a><a href="${chain.chainId === 8453 ? `https://opensea.io/${who}` : `https://testnets.opensea.io/${who}`}">OpenSea</a><a href="/api/holder/${who}">JSON</a><a href="https://${PARENT}/wallet/${who}">This wallet on ${PARENT}</a></nav>
</main>
${connectScript("/")}
${rows.length ? downloadScript() : ""}`;
  return layout(`${rawName} | ${SITE}`, p, body, "/today.png", `/${handle}`);
}

export function assetsPage(chain: ChainState | null, epoch: number): string {
  const p = groundOf(pageTraits(chain, epoch));
  const img = esc(`<img src="https://${SITE}/face/1.svg" width="256" height="256" alt="Face #1 of faces.onenft.click" style="image-rendering:pixelated">`);
  const body = `<main class="prose" id="main">
${topBar("Assets")}
<h2 class="syne">Take it. It is yours.</h2>
<p>Every face, every sprite, the contracts and the text of this site are <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>. The sprites were drawn for this project. No credit needed, no permission to ask. Print it, remix it, mint it elsewhere. Owning a face gives you the token; the image belongs to everyone. The site's code in the repository carries its own license file; the fonts Syne and Newsreader are under the SIL Open Font License; the libraries the site uses keep their own licenses.</p>
<h2 class="syne">Images</h2>
<p>Any face as SVG at <code>/face/N.svg</code>, as a 1024 pixel PNG at <code>/face/N-1024.png</code>, and as a 1200 by 630 link card at <code>/face/N.png</code>. Any single item on a neutral stand-in at <code>/item/SLOT/N.svg</code>, slots ${SLOTS.map((s) => `<code>${s.slot}</code>`).join(", ")}. The SVG is the same file the contract holds. Render it with <code>image-rendering: pixelated</code> so the pixels stay square.</p>
<pre class="snip">${img}</pre>
<h2 class="syne">Data</h2>
<p><a href="/api/state">/api/state</a> gives the supply, the commits being revealed, the pool and the newest faces. <code>/api/face/N</code> returns one face: seed, pins, traits with tiers, rarity, holder, roll transaction, image links. <code>/api/holder/ADDRESS</code> lists one wallet's faces. <code>/api/roll/ADDRESS</code> says where a wallet's roll stands today. <a href="/spec.json">/spec.json</a> holds the draw, the weight tables, the palettes, the pin prices and every item name, so you can port the generator. Every answer carries a <code>chain</code> block that says how old the data is. All JSON, open to any origin.</p>
<h2 class="syne">Code and contract</h2>
<p>The generator in TypeScript and Solidity, the site and the contracts: <a href="${REPO}">${REPO.replace("https://", "")}</a>.${chain ? ` Token contract <a href="${explorer(chain.chainId)}/address/${chain.address}">${chain.address}</a> on ${chainName(chain.chainId)}. <a href="${openseaCollection(chain)}">Collection on OpenSea</a>.` : ""} Every collection: <a href="https://${PARENT}">${PARENT}</a>.</p>
<p class="small"><a href="/">Back to the roll</a></p>
</main>`;
  return layout(`Assets | ${SITE}`, p, body, "/today.png", "/assets");
}
