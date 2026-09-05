import { SLOTS } from "./sprites.ts";
import { svgOf, itemSvg, skinSvg, hairColourSvg, groundSvg, topColourSvg, accentSvg, previewSvg, unpackPins, faceOfDay, pinKeyOk, SKINS, HAIRS, GROUNDS, TOPCOLORS, ACCENTS } from "./faces.ts";
import { chainState, chainStatus, contractEnabled, readNow, startRollScan, CONTRACT, CHAIN_ID, EPOCH_SECONDS, type ChainState } from "./contract.ts";
import { homePage, facePage, howPage, notFound, chainDown, traitsOfRecord, goTarget } from "./site.ts";
import { rarityPage, onesPage, holderPage, yoursPage, assetsPage } from "./pages.ts";
import { faceJson, stateJson, holderJson, specJson, rollJson } from "./api.ts";
import { cardPng, squarePng } from "./image.ts";
import { ensNames, resolveHolder, resolveFailed } from "./ens.ts";
import { startAutoclaim, revealFor, keeperInfo } from "./autoclaim.ts";
import { isAddress, type Address, type Hex } from "viem";

const PORT = Number(process.env.PORT ?? 3000);
const BOOT_AT = Date.now();

const html = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const svg = (s: string, immutable: boolean) => new Response(s, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60", "access-control-allow-origin": "*" } });
const png = (b: Uint8Array, immutable: boolean) => new Response(b as Uint8Array<ArrayBuffer>, { headers: { "content-type": "image/png", "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300", "access-control-allow-origin": "*" } });
const json = (o: unknown, maxAge = 15, status = 200) => new Response(JSON.stringify(o, null, 1), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 && maxAge > 0 ? `public, max-age=${maxAge}` : "no-store", "access-control-allow-origin": "*" } });
const text = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });

/** Headers every response carries. Pages may sit in a frame on this origin only. */
export function withHeaders(res: Response): Response {
  const h = res.headers;
  h.set("x-content-type-options", "nosniff");
  h.set("referrer-policy", "strict-origin-when-cross-origin");
  h.set("x-frame-options", "SAMEORIGIN");
  return res;
}

/** ENS names for the owners a page will show. Never throws. */
async function namesFor(chain: ChainState | null, only?: Iterable<string>) {
  if (!chain) return new Map<string, string>();
  return ensNames([...(only ?? new Set(chain.owners.values()))]);
}
/** Owners of the newest faces, the ones the home page lists. */
function recentOwners(chain: ChainState, n = 40): string[] {
  const out: string[] = [];
  for (let id = chain.totalSupply; id > Math.max(0, chain.totalSupply - n); id--) {
    const o = chain.owners.get(id);
    if (o) out.push(o);
  }
  return out;
}

export async function handle(req: Request): Promise<Response> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return text("bad request", 400);
  }
  try {
    return withHeaders(await route(url, req));
  } catch (e) {
    console.error(`route ${url.pathname}:`, (e as Error).message);
    return withHeaders(url.pathname.startsWith("/api/") ? json({ error: "internal error" }, 0, 500) : text("internal error", 500));
  }
}

async function route(url: URL, req: Request): Promise<Response> {
  const path = url.pathname;
  // The day from the clock, the same arithmetic the contract runs on block.timestamp. Never a cached chain read.
  const epoch = Math.floor(Date.now() / 1000 / EPOCH_SECONDS);

  // ---- everything that needs no chain answers before any chain read
  if (path === "/health") return text(`ok, epoch ${epoch}, up ${Math.floor((Date.now() - BOOT_AT) / 1000)} s`);
  if (path === "/ready") {
    const s = chainStatus();
    return json({ ok: !s.configured || s.known, epoch, chain: s, keeper: keeperInfo() }, 0, !s.configured || s.known ? 200 : 503);
  }
  if (path === "/spec.json") return json(specJson(), 3600);
  if (path === "/today.svg") return svg(svgOf(faceOfDay(epoch)), false);
  if (path === "/today.png") return png(cardPng(`day${epoch}`, "faces", "roll yours", faceOfDay(epoch), true), false);
  if (path === "/go") return redirect(goTarget(url.searchParams.get("who")), 302);
  if (path === "/preview.svg") {
    const p = (url.searchParams.get("p") ?? "f".repeat(32)).toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(p)) return text("bad pins", 400);
    const pins = unpackPins(BigInt("0x" + p));
    for (const [key, item] of Object.entries(pins)) if (!pinKeyOk(key, item!)) return text("bad pin", 400);
    return svg(previewSvg(pins), true);
  }
  const hc = path.match(/^\/haircolour\/(\d{1,2})\.svg$/);
  if (hc) return HAIRS[Number(hc[1])] ? svg(hairColourSvg(Number(hc[1]), 96), true) : text("no such colour", 404);
  const tc = path.match(/^\/topcolour\/(\d{1,2})\.svg$/);
  if (tc) return TOPCOLORS[Number(tc[1])] ? svg(topColourSvg(Number(tc[1]), 96), true) : text("no such colour", 404);
  const ac = path.match(/^\/accent\/(\d{1,2})\.svg$/);
  if (ac) return ACCENTS[Number(ac[1])] ? svg(accentSvg(Number(ac[1]), 96), true) : text("no such colour", 404);
  const gr = path.match(/^\/ground\/(\d{1,2})\.svg$/);
  if (gr) return GROUNDS[Number(gr[1])] ? svg(groundSvg(Number(gr[1]), 96), true) : text("no such ground", 404);
  const skin = path.match(/^\/skin\/(\d{1,2})\.svg$/);
  if (skin) return SKINS[Number(skin[1])] ? svg(skinSvg(Number(skin[1]), 96), true) : text("no such skin", 404);
  const item = path.match(/^\/item\/([a-z]+)\/(\d{1,3})\.svg$/);
  if (item) {
    const k = SLOTS.findIndex((s) => s.slot === item[1]);
    const i = Number(item[2]);
    if (k < 0 || !SLOTS[k].items[i]) return text("no such item", 404);
    return svg(itemSvg(k, i, 96), true);
  }

  // ---- from here on pages show chain state: the last good read at once; a wait only before the first read
  const chain = await chainState();
  const status = chainStatus();

  if (path === "/") return html(homePage(chain, epoch, await namesFor(chain, chain ? recentOwners(chain) : undefined), status));
  if (path === "/how") return html(howPage(chain, epoch));
  if (path === "/rarity") return html(rarityPage(chain, epoch));
  if (path === "/ones") return html(onesPage(chain, epoch, await namesFor(chain, chain ? [...chain.faces.values()].filter((f) => f.one !== 255).map((f) => chain.owners.get(f.id)).filter(Boolean) as string[] : []), status));
  if (path === "/assets") return html(assetsPage(chain, epoch));
  if (path === "/yours") return html(yoursPage(chain, epoch, status, url.searchParams.get("bad")));
  if (path === "/api/state") return json(stateJson(chain, await namesFor(chain, chain ? recentOwners(chain) : undefined), status), 15);

  // A rolled face is immutable; its image needs the record, and the record needs the chain once.
  const m = path.match(/^\/(api\/)?face\/(\d{1,5})(\.svg|\.png|-1024\.png)?$/);
  if (m) {
    const id = Number(m[2]);
    if (!contractEnabled()) return m[1] ? json({ error: "no contract configured" }, 0, 404) : html(notFound(chain, epoch), 404);
    const f = chain?.faces.get(id);
    if (!f) {
      // Unknown to us. That is "no such face" only when the chain answered and the id is past the supply; otherwise the read may simply be missing.
      const missing = !chain || status.stale || id > 0 && id <= chain.totalSupply;
      if (missing) return m[1] ? json({ error: "the chain did not answer for this face", chain: status }, 0, 503) : html(chainDown(chain, epoch, `Face #${id} could not be read from the chain. Try again in a minute.`), 503);
      return m[1] ? json({ error: "no such face", totalSupply: chain!.totalSupply }, 0, 404) : html(notFound(chain, epoch), 404);
    }
    const t = traitsOfRecord(f);
    if (m[1]) return json(faceJson(f, chain!, await namesFor(chain, chain!.owners.get(id) ? [chain!.owners.get(id)!] : []), status));
    if (m[3] === ".svg") return svg(svgOf(t), true);
    if (m[3] === ".png") return png(cardPng(`face${id}`, `#${id}`, "face", t, true), true);
    if (m[3] === "-1024.png") return png(squarePng(id, t), true);
    const o = chain!.owners.get(id), r = chain!.rolls.get(id);
    return html(facePage(id, f, chain!, await namesFor(chain, [o, r?.to].filter(Boolean) as string[]), status));
  }

  // The standing of one wallet's roll. GET reports; POST also lets the keeper send a reveal that is due.
  const roll = path.match(/^\/api\/(roll|reveal|can-roll)\/(0x[0-9a-fA-F]{40})$/);
  if (roll) {
    if (!contractEnabled()) return json({ error: "no contract configured" }, 0, 404);
    const who = roll[2] as Address;
    const send = roll[1] === "reveal" && req.method === "POST";
    const r = await revealFor(who, send);
    return json(rollJson(r, keeperInfo(), status), 0, r.state === "rpc-down" ? 503 : 200);
  }

  const holder = path.match(/^\/(api\/holder\/)?(0x[0-9a-fA-F]{40}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth)$/i);
  if (holder) {
    if (!contractEnabled()) return holder[1] ? json({ error: "no contract configured" }, 0, 404) : html(notFound(chain, epoch), 404);
    if (!chain) return holder[1] ? json({ error: "the chain did not answer", chain: status }, 0, 503) : html(chainDown(chain, epoch), 503);
    const who = await resolveHolder(holder[2]);
    if (!who || !isAddress(who)) {
      const failed = resolveFailed(holder[2]);
      if (holder[1]) return json({ error: failed ? "ENS did not answer" : "no such name" }, 0, failed ? 503 : 404);
      return html(failed ? chainDown(chain, epoch, "ENS did not answer. Try the name again in a minute, or use the address.") : notFound(chain, epoch, `No wallet answers to ${holder[2]}.`), failed ? 503 : 404);
    }
    const names = await namesFor(chain, [who]);
    if (holder[1]) return json(holderJson(who, chain, names, status));
    return html(holderPage(who, holder[2], chain, names, status));
  }
  if (path.startsWith("/api/")) return json({ error: "no such endpoint" }, 0, 404);
  return html(notFound(chain, epoch), 404);
}

if (import.meta.main) {
  if (contractEnabled()) {
    // A dead RPC at boot must not take the site down with it: the builder and the images need no chain.
    readNow()
      .then((st) => console.log(`contract ${CONTRACT} on chain ${CHAIN_ID}, ${st.totalSupply} rolled, ${st.pending} pending, pool ${st.poolLeft}, renderer ${st.renderer}`))
      .catch((e) => console.error("contract state unavailable at boot, serving without it:", (e as Error).message));
    startRollScan();
    if (process.env.DEPLOYER_KEY) startAutoclaim(process.env.DEPLOYER_KEY as Hex);
  }
  Bun.serve({ port: PORT, fetch: handle });
  console.log(`faces.onenft.click on :${PORT}`);
}
