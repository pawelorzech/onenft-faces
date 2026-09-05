import { SLOTS } from "./sprites.ts";
import { svgOf, itemSvg, previewSvg, unpackPins, faceOfDay, pinOk } from "./faces.ts";
import { chainState, contractEnabled, startRollScan, canRoll, CONTRACT, CHAIN_ID, EPOCH_SECONDS } from "./contract.ts";
import { homePage, facePage, howPage, notFound, traitsOfRecord } from "./site.ts";
import { rarityPage, onesPage, holderPage, assetsPage } from "./pages.ts";
import { faceJson, stateJson, holderJson, specJson } from "./api.ts";
import { cardPng } from "./image.ts";
import { ensNames, resolveHolder } from "./ens.ts";
import { startAutoclaim } from "./autoclaim.ts";
import { isAddress, type Address, type Hex } from "viem";

const PORT = Number(process.env.PORT ?? 3000);

const html = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const svg = (s: string, immutable: boolean) => new Response(s, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=60", "access-control-allow-origin": "*" } });
const png = (b: Uint8Array, immutable: boolean) => new Response(b, { headers: { "content-type": "image/png", "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300" } });
const json = (o: unknown, maxAge = 15) => new Response(JSON.stringify(o, null, 1), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}`, "access-control-allow-origin": "*" } });

if (contractEnabled()) {
  const st = await chainState();
  if (st) console.log(`contract ${CONTRACT} on chain ${CHAIN_ID}, ${st.totalSupply} rolled, pool ${st.poolLeft}, renderer ${st.renderer}`);
  startRollScan();
  if (process.env.DEPLOYER_KEY) startAutoclaim(process.env.DEPLOYER_KEY as Hex);
}

async function namesFor(chain: Awaited<ReturnType<typeof chainState>>) {
  if (!chain) return new Map<string, string>();
  try { return await ensNames([...new Set(chain.owners.values())]); } catch { return new Map<string, string>(); }
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    let chain = null as Awaited<ReturnType<typeof chainState>>;
    try { chain = await chainState(); } catch (e) { console.error("contract state unavailable:", (e as Error).message); }
    const epoch = chain?.epoch ?? Math.floor(Date.now() / 1000 / EPOCH_SECONDS);

    if (path === "/") return html(homePage(chain, epoch, await namesFor(chain)));
    if (path === "/how") return html(howPage(chain, epoch));
    if (path === "/rarity") return html(rarityPage(chain, epoch));
    if (path === "/ones") return html(onesPage(chain, epoch, await namesFor(chain)));
    if (path === "/assets") return html(assetsPage(chain, epoch));
    if (path === "/spec.json") return json(specJson(), 3600);
    if (path === "/api/state") return json(stateJson(chain, await namesFor(chain)));
    if (path === "/health") return new Response(`ok${chain ? `, ${chain.totalSupply} rolled, pool ${chain.poolLeft}, rolls scanned ${chain.rolls.size}` : ", no contract"}`);
    if (path === "/today.svg") return svg(svgOf(faceOfDay(epoch)), false);
    if (path === "/today.png") return png(cardPng(`day${epoch}`, "faces", "roll yours", faceOfDay(epoch), true), false);
    if (path === "/preview.svg") {
      const p = (url.searchParams.get("p") ?? "ffffffff").toLowerCase();
      if (!/^[0-9a-f]{8}$/.test(p)) return new Response("bad pins", { status: 400 });
      const pins = unpackPins(parseInt(p, 16));
      for (const [slot, item] of Object.entries(pins)) if (!pinOk(SLOTS.findIndex((s) => s.slot === slot), item!)) return new Response("bad pin", { status: 400 });
      return svg(previewSvg(pins), true);
    }
    const item = path.match(/^\/item\/([a-z]+)\/(\d{1,3})\.svg$/);
    if (item) {
      const k = SLOTS.findIndex((s) => s.slot === item[1]);
      const i = Number(item[2]);
      if (k < 0 || !SLOTS[k].items[i]) return new Response("no such item", { status: 404 });
      return svg(itemSvg(k, i, 96), true);
    }
    const m = path.match(/^\/(api\/)?face\/(\d{1,5})(\.svg|\.png)?$/);
    if (m) {
      const id = Number(m[2]);
      const f = chain?.faces.get(id);
      if (!chain || !f) return m[1] ? json({ error: "no such face" }, 0) : html(notFound(chain, epoch), 404);
      const t = traitsOfRecord(f);
      if (m[1]) return json(faceJson(f, chain, await namesFor(chain)));
      if (m[3] === ".svg") return svg(svgOf(t), true);
      if (m[3] === ".png") return png(cardPng(`face${id}`, `#${id}`, "face", t, true), true);
      return html(facePage(id, f, chain, await namesFor(chain)));
    }
    const can = path.match(/^\/api\/can-roll\/(0x[0-9a-fA-F]{40})$/);
    if (can && chain) return json({ address: can[1], ...(await canRoll(can[1] as Address)), epoch: chain.epoch, secondsLeft: chain.secondsLeft }, 0);
    const holder = path.match(/^\/(api\/holder\/)?(0x[0-9a-fA-F]{40}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth)$/i);
    if (holder && chain) {
      const who = await resolveHolder(holder[2]);
      if (!who || !isAddress(who)) return html(notFound(chain, epoch), 404);
      const names = await namesFor(chain);
      if (holder[1]) return json(holderJson(who, chain, names));
      return html(holderPage(who, holder[2], chain, names));
    }
    return html(notFound(chain, epoch), 404);
  },
});

console.log(`faces.onenft.click on :${PORT}`);
