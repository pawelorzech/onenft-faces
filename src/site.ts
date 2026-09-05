/**
 * Page HTML. The page has no palette of its own: it wears the ground colour
 * of the newest face, or of the face of the day before anyone has rolled.
 * No light or dark mode.
 *
 * Copy rules: plain words, active voice, no adverbs, no em dashes, nothing a
 * reader could misunderstand. Facts (numbers, addresses, paths) stay exact,
 * and every number about pins and prices comes from faces.ts, not from prose.
 */
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { traitsOf, svgOf, attributesOf, rarityOf, groundOf, faceOfDay, unpackPins, pinOk, skinPinOk, SKINS, HAIRS, GROUNDS, TOPCOLORS, ACCENTS, PIN_KEYS, PIN_BYTES, MAX_PINS, PIN_PRICES_WEI, combinations, type Traits } from "./faces.ts";
import { COMMIT_SELECTOR, type ChainState, type ChainStatus, type FaceRecord } from "./contract.ts";

export type Names = Map<string, string>;
export const NO_NAMES: Names = new Map();
export type Colors = { bg: string; fg: string; muted: string };

export const SITE = "faces.onenft.click";
export const NAME = "Faces";
export const REPO = "https://github.com/pawelorzech/onenft-faces";
export const PARENT = "onenft.click";
export const MAX_SUPPLY = 10000;
/**
 * A tag of the contract in every face image URL. Face images are immutable and
 * cached for a year, and a second contract numbers its faces from 1 again, so
 * without the tag a browser would show the first contract's face 1 for the
 * second's. The server ignores the query; the tag only keeps caches apart.
 */
export const IMG_V = (process.env.CONTRACT_ADDRESS ?? "").slice(2, 10).toLowerCase();
export const IMG_Q = IMG_V ? `?c=${IMG_V}` : "";
/** keccak("reveal(address)")[:4], for a reveal sent from the roller's own wallet. */
export const REVEAL_SELECTOR = "0xc392cf41";

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
/** The text for an owner: its ENS name when known, else the short address. Escaped; safe in text and attributes. */
export function label(a: string, names: Names): string {
  return esc(names.get(a.toLowerCase()) ?? shortAddr(a));
}
/** The holder page of an owner. Always the full address: the short form is text, not a route. */
export function holderHref(a: string): string {
  return `/${a}`;
}
export function ownerLink(a: string, names: Names): string {
  return `<a href="${holderHref(a)}">${label(a, names)}</a>`;
}
export function openseaCollection(chain: ChainState): string {
  // The second contract's OpenSea collection has no slug yet; the first token's page lists the collection.
  return chain.chainId === 8453 ? `https://opensea.io/assets/base/${chain.address}/1` : `https://testnets.opensea.io/assets/base_sepolia/${chain.address}`;
}
export function opensea(chain: ChainState, id: number): string {
  return chain.chainId === 8453 ? `https://opensea.io/assets/base/${chain.address}/${id}` : `https://testnets.opensea.io/assets/base_sepolia/${chain.address}/${id}`;
}
export function explorer(chainId: number): string {
  return chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
}
export function chainName(chainId: number): string {
  return chainId === 8453 ? "Base" : "Base Sepolia";
}
export const num = (n: number | bigint) => n.toLocaleString("en-US");
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
/** Wei as ETH, exact, no float: 500000000000000n gives "0.0005". */
export function ethOf(wei: bigint): string {
  const whole = wei / 10n ** 18n, frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
export const eth = (wei: bigint) => `${ethOf(wei)} ETH`;
export function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function isAuthor(chain: ChainState, a?: string): boolean {
  return Boolean(a) && a!.toLowerCase() === chain.author.toLowerCase();
}
export function stripSize(svg: string): string {
  return svg.replace(/ width="\d+" height="\d+"/, "");
}
export function fmtLeft(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h === 0 ? `${m} min` : `${h} h ${m} min`;
}
export function dateOf(epoch: number): string {
  return new Date(epoch * 86400 * 1000).toISOString().slice(0, 10);
}
/** The pin rule in one sentence, from the constants, so no page can drift from the contract. */
export function pinRule(): string {
  return `a pin fixes one trait or colour to a common or uncommon item; the first pin costs ${ethOf(PIN_PRICES_WEI[1])} ETH and each additional pin doubles the total pin fee, up to ${ethOf(PIN_PRICES_WEI[MAX_PINS])} ETH for ${MAX_PINS}; network gas is extra`;
}

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}
function luminance(c: string): number {
  const ch = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hex(c).map((x) => ch(x / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const MUTED_MIN_CONTRAST = 4.5;
export const LINE_MIN_CONTRAST = 3;
function pulled(fg: string, bg: string, from: number, min: number): string {
  for (let t = from; t > 0; t -= 0.01) {
    const c = mix(fg, bg, t);
    if (contrast(c, bg) >= min) return c;
  }
  return fg;
}
export function mutedFor(fg: string, bg: string): string {
  return pulled(fg, bg, 0.38, MUTED_MIN_CONTRAST);
}
export function edgeFor(fg: string, bg: string): string {
  return pulled(fg, bg, 0.6, LINE_MIN_CONTRAST);
}
export function textFor(fg: string, bg: string): string {
  if (contrast(fg, bg) >= MUTED_MIN_CONTRAST) return fg;
  const ink = contrast("#000000", bg) >= contrast("#ffffff", bg) ? "#000000" : "#ffffff";
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(fg, ink, t);
    if (contrast(c, bg) >= MUTED_MIN_CONTRAST) return c;
  }
  return ink;
}
export function cssVars(cord: string, bg: string): string {
  const fg = textFor(cord, bg);
  return `--bg:${bg};--fg:${fg};--muted:${mutedFor(fg, bg)};--edge:${edgeFor(fg, bg)};--line:${mix(fg, bg, 0.8)};--soft:${mix(fg, bg, 0.93)}`;
}

/** The face the page wears: the newest rolled one, else the face of the day. */
export function pageTraits(chain: ChainState | null, epoch: number): Traits {
  if (chain && chain.totalSupply > 0) {
    const f = chain.faces.get(chain.totalSupply);
    if (f) return traitsOfRecord(f);
  }
  return faceOfDay(epoch);
}
export function traitsOfRecord(f: FaceRecord): Traits {
  return traitsOf(f.seed, unpackPins(f.pins), f.one === 255 ? undefined : f.one);
}

function css(p: Colors): string {
  return `
:root{${cssVars(p.fg, p.bg)}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{background:var(--bg);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:17px;line-height:1.5}
body{margin:0;min-height:100vh}
a{color:inherit}
a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--fg);outline-offset:3px}
.skip{position:absolute;left:-999px;top:8px;background:var(--fg);color:var(--bg);padding:8px 14px;font-weight:700;z-index:9}
.skip:focus{left:8px}
.syne{font-family:"Syne",system-ui,sans-serif}
.page{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:100vh}
aside{border-right:1px solid var(--line);padding:38px 32px}
aside .stick{position:sticky;top:38px;display:flex;flex-direction:column;gap:28px}
.mark{font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}
h1{font-weight:800;font-size:33px;line-height:.96;letter-spacing:-.045em;margin:0;overflow-wrap:normal;hyphens:manual}
h2{font-weight:800;font-size:30px;line-height:1;letter-spacing:-.03em;margin:0}
h3{font-weight:700;font-size:18px;margin:0}
.lead{color:var(--muted);margin:0}
hr{border:0;border-top:1px solid var(--line);margin:0;width:100%}
.big{font-weight:700;font-size:40px;line-height:1}
.small{font-size:15px;color:var(--muted)}
.cta{display:flex;align-items:center;justify-content:center;min-height:58px;padding:0 16px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:700;font-size:18px;text-align:center}
.cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--fg)}
button.cta{border:0;cursor:pointer;width:100%;font-family:"Syne",system-ui,sans-serif}
button.cta[disabled]{opacity:.55;cursor:default}
.msg{font-size:15px;color:var(--muted);min-height:1.5em;margin:0}
.msg a{font-weight:700}
.note{padding:12px 16px;border:1px solid var(--edge);font-size:15px;color:var(--fg);margin:0;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.note button{font:inherit;font-weight:700;font-family:"Syne",system-ui,sans-serif;background:var(--fg);color:var(--bg);border:0;padding:8px 14px;cursor:pointer;min-height:44px}
.testnet{display:inline-block;padding:3px 8px;border:1px solid var(--line);font-size:13px;color:var(--muted)}
.px,.px svg,.px img{image-rendering:pixelated}
.builder{padding:38px 34px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,396px) minmax(280px,1fr);gap:34px;align-items:start}
.stage{position:sticky;top:24px;align-self:start;display:flex;flex-direction:column;gap:14px}
.preview{width:100%;max-width:396px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line);background:var(--soft)}
.preview img{display:block;width:100%;height:100%}
.price{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.price .syne{font-weight:800;font-size:22px;white-space:nowrap}
.sum{font-size:15px;color:var(--muted);margin:0}
.keep{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:16px;margin:0}
.keep dt{color:var(--muted)}
.keep dd{margin:0}
.keep dd b{font-weight:700}
.keep dd .luck{color:var(--muted)}
.galleries{display:flex;flex-direction:column;gap:14px;min-width:0}
.cats{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:15px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.cats a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;color:var(--muted)}
.cats a:hover{color:var(--fg)}
.gallery{border-bottom:1px solid var(--line);padding-bottom:12px}
.gallery summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:baseline;gap:12px;min-height:44px;padding:6px 0}
.gallery summary::-webkit-details-marker{display:none}
.gallery summary h3{display:inline}
.gallery summary span{font-weight:400;font-size:14px;color:var(--muted)}
.gallery summary::after{content:"+";font-family:"Syne",system-ui,sans-serif;font-weight:800;font-size:20px;color:var(--muted)}
.gallery[open] summary::after{content:"\\2212"}
.gallery .pick{font-size:15px;color:var(--muted);margin:0 0 8px;min-height:1.5em}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}
.items button{padding:0;border:1px solid var(--edge);background:var(--soft);cursor:pointer;aspect-ratio:1;position:relative;display:block;width:100%;min-width:44px;min-height:44px}
.items button img{display:block;width:100%;height:100%}
.items button[aria-pressed="true"]{outline:3px solid var(--fg);outline-offset:-3px}
.items button .sw{position:absolute;left:3px;bottom:3px;width:14px;height:14px;box-shadow:0 0 0 1px var(--fg)}
.items button .u{position:absolute;right:3px;top:2px;font-size:11px;font-weight:700;background:var(--fg);color:var(--bg);padding:0 4px;font-family:"Syne",system-ui,sans-serif}
.items button:hover{border-color:var(--fg)}
.items button[disabled]{opacity:.5;cursor:default}
.row{display:flex;align-items:center;gap:22px;padding:0 34px;min-height:128px;border-bottom:1px solid var(--line);text-decoration:none}
.row:hover{background:var(--soft)}
.row.yours .n::after{content:" yours";font-size:14px;font-weight:400;color:var(--muted)}
.row img{width:92px;height:92px;display:block;flex-shrink:0;box-shadow:0 0 0 1px var(--line)}
.row .n{font-weight:700;font-size:23px}
.tag{display:inline-block;padding:1px 7px;border:1px solid var(--line);font-size:13px;color:var(--muted);margin-left:8px;vertical-align:middle}
.tag.rare{border-color:var(--fg);color:var(--fg)}
.tag.legendary{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.counts{display:flex;gap:34px;flex-wrap:wrap;padding:22px 34px;border-bottom:1px solid var(--line)}
.counts b{display:block;font-weight:700;font-size:26px;line-height:1}
.sitenav{display:flex;gap:4px 22px;flex-wrap:wrap;padding:6px 34px;border-bottom:1px solid var(--line)}
footer{padding:26px 34px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;color:var(--muted);font-size:16px}
footer nav,.nav{display:flex;gap:6px 20px;flex-wrap:wrap}
footer nav a,.nav a,.top nav a,.sitenav a{display:inline-flex;align-items:center;min-height:44px}
.prose{max-width:680px;padding:38px 34px;display:flex;flex-direction:column;gap:22px}
.prose h2{margin-top:22px}
.prose p{margin:0}
.prose code{font-family:ui-monospace,Menlo,monospace;font-size:.92em}
.prose pre{margin:0;padding:18px;background:var(--soft);overflow-x:auto;font-size:14px;line-height:1.5}
.single{padding:38px 34px;display:flex;flex-direction:column;gap:22px;max-width:760px}
.single .face{width:100%;max-width:512px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line)}
.single .face svg{display:block;width:100%;height:100%}
.num{font-weight:800;font-size:62px;line-height:.95;letter-spacing:-.03em}
.top{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.top nav{display:flex;gap:4px 18px;flex-wrap:wrap;font-size:16px;color:var(--muted)}
.wide{padding:38px 34px;display:flex;flex-direction:column;gap:28px;max-width:1180px}
.wide p{margin:0}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.strip a,.strip div{text-decoration:none}
.strip img,.strip svg{width:100%;aspect-ratio:1;display:block;box-shadow:0 0 0 1px var(--line)}
.strip .cap{font-size:14px;color:var(--muted);margin-top:6px}
.strip .gone img{opacity:.35}
.scroll{overflow-x:auto}
table.tr{border-collapse:collapse;width:100%;max-width:720px;font-size:16px}
table.tr th,table.tr td{text-align:left;padding:8px 10px 8px 0;border-bottom:1px solid var(--line);vertical-align:top}
table.tr th{font-weight:400;color:var(--muted);font-size:14px}
table.tr td.n{text-align:right;font-family:"Syne",system-ui,sans-serif;font-weight:700;white-space:nowrap}
table.tr td img{width:40px;height:40px;vertical-align:middle;margin-right:8px;box-shadow:0 0 0 1px var(--line)}
.traits{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;font-size:16px;max-width:460px}
.traits dt{color:var(--muted);margin:0}
.traits dd{margin:0}
.share{display:flex;gap:16px;flex-wrap:wrap;font-size:15px}
pre.snip{margin:0;padding:14px;background:var(--soft);overflow-x:auto;font-size:13px;line-height:1.5;font-family:ui-monospace,Menlo,monospace}
.crumb{margin:0}
.crumb ol{list-style:none;margin:0;padding:0;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.crumb li{display:flex;gap:10px;align-items:baseline}
.crumb a,.crumb span[aria-current]{display:inline-flex;align-items:center;min-height:44px}
.crumb .hub{color:var(--muted)}
.crumb .sep{color:var(--line);font-weight:800;font-size:20px}
.crumb span[aria-current]{color:var(--muted);font-size:16px}
@media (min-width:901px){
 aside .crumb ol,aside .crumb li{flex-direction:column;gap:2px;align-items:flex-start}
 aside .crumb .sep{display:none}
 aside .crumb a,aside .crumb span[aria-current]{min-height:0}
 aside .crumb .hub{font-size:15px;font-weight:700}
}
.whobox{display:flex;flex-direction:column;gap:8px}
.wname{overflow-wrap:normal;word-break:keep-all}
.who{display:flex;gap:12px;flex-wrap:wrap;max-width:720px}
.who form{display:flex;flex-direction:column;gap:8px;flex:1;min-width:280px}
.who form .line{display:flex;gap:12px}
.who label{font-size:15px;color:var(--muted)}
.who .cta{min-height:50px;padding:0 22px;font-size:17px;width:auto}
.field{height:50px;padding:0 16px;border:1px solid var(--edge);background:transparent;color:var(--fg);flex:1;min-width:0;font-family:ui-monospace,Menlo,monospace;font-size:15px}
.field::placeholder{color:var(--muted)}
.tok{display:grid;grid-template-columns:256px minmax(0,1fr);gap:32px;padding:30px 0;border-top:1px solid var(--line)}
.tok img{width:256px;height:256px;display:block;box-shadow:0 0 0 1px var(--line)}
.tok .meta{display:flex;flex-direction:column;gap:14px}
.tok .num{font-size:44px}
.dl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:auto;padding-top:14px;border-top:1px solid var(--line)}
.dl .lab{color:var(--muted);font-size:15px;margin-right:6px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border:1px solid var(--fg);color:var(--fg);text-decoration:none;font-weight:700;font-size:15px;font-family:"Syne",system-ui,sans-serif;background:transparent;cursor:pointer}
.btn[aria-busy="true"]{opacity:.6;cursor:progress}
.sizes{display:flex;border:1px solid var(--edge)}
.sizes button{padding:0 12px;min-height:44px;display:flex;align-items:center;font-size:14px;color:var(--muted);border:0;border-right:1px solid var(--line);background:transparent;font-family:"Syne",system-ui,sans-serif;cursor:pointer}
.sizes button:last-child{border-right:0}
.sizes button[aria-pressed="true"]{background:var(--soft);color:var(--fg);font-weight:700}
@media (max-width:1180px){
 .builder{display:block}
 .stage{position:sticky;top:0;z-index:2;background:var(--bg);display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px 14px;align-items:start;padding:10px 0;margin:0 0 14px;border-bottom:1px solid var(--line)}
 .stage .preview{max-width:120px;grid-row:1/span 3}
 .stage .hint,.stage .keep,.stage .small:not(#fee){display:none}
 .stage .cta{min-height:46px;font-size:16px}
 .stage .sum{display:block}
 .stage>div:not(.preview){gap:6px!important}
 .stage .price .small{white-space:nowrap}
 .stage .price .syne{font-size:18px}
 .stage .msg:empty{min-height:0}
}
@media (min-width:1181px){.stage .sum{display:none}}
@media (max-width:900px){
 .page{grid-template-columns:1fr}
 aside{border-right:0;border-bottom:1px solid var(--line);padding:18px 20px}
 aside .stick{position:static;gap:16px}
 h1{font-size:38px}
 .builder{padding:20px}
 .num{font-size:44px}
 .row{min-height:64px;padding:14px 20px;gap:16px}
 .row img{width:56px;height:56px}
 .counts{padding:16px 20px;gap:24px}
 .sitenav{padding:4px 20px}
 footer,.prose,.single,.wide{padding:20px}
 .tok{grid-template-columns:1fr;gap:16px}
 .tok img{width:100%;height:auto}
 .who form{min-width:0;width:100%}
}
@media (max-width:360px){h1{font-size:29px}.mark{font-size:17px}.stage{grid-template-columns:96px minmax(0,1fr)}.stage .preview{max-width:96px}}
@media (prefers-reduced-motion:no-preference){.row{transition:background .15s}}
`;
}

const UMAMI_URL = process.env.UMAMI_URL ?? "";
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? "";
const ANALYTICS = UMAMI_URL && UMAMI_WEBSITE_ID ? `<script defer src="${esc(UMAMI_URL)}/script.js" data-website-id="${esc(UMAMI_WEBSITE_ID)}"></script>` : "";
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Newsreader:opsz,wght@6..72,400&display=swap">`;
const DESC = `One face per wallet each UTC day, rolled on chain on Base. Pin traits for a fee or leave them to chance. The collection ends at ${num(MAX_SUPPLY)} faces.`;

export function layout(title: string, p: Colors, body: string, image = "/today.png", path = "/"): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="${p.bg}">
<link rel="icon" href="/today.svg" type="image/svg+xml">
<link rel="canonical" href="https://${SITE}${esc(path)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="https://${SITE}${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://${SITE}${esc(path)}">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${ANALYTICS}
<style>${css(p)}</style>
</head>
<body><a class="skip" href="#main">Skip to content</a>${body}</body>
</html>`;
}

/** The breadcrumb: the hub, this collection, and on inner pages the page itself. */
export function crumb(current?: string): string {
  const here = current ? `<li><span class="sep syne" aria-hidden="true">/</span><span aria-current="page">${esc(current)}</span></li>` : "";
  return `<nav class="crumb" aria-label="Breadcrumb"><ol><li><a class="mark syne hub" href="https://${PARENT}">${PARENT}</a></li><li><span class="sep syne" aria-hidden="true">/</span><a class="mark syne" href="/"${current ? "" : ' aria-current="page"'}>${NAME}</a></li>${here}</ol></nav>`;
}
export const MENU: [string, string][] = [["/rarity", "Rarity"], ["/ones", "One of ones"], ["/assets", "Assets"], ["/how", "How it works"], ["/yours", "Your wallet"]];
export function menu(extra: [string, string][] = []): string {
  return [...MENU, ...extra].map(([h, t]) => `<a href="${h}">${t}</a>`).join("");
}
export function topBar(current?: string): string {
  return `<div class="top">${crumb(current)}<nav aria-label="Site">${menu([[`https://${PARENT}`, "All collections"]])}</nav></div>`;
}

/** The countdown to midnight UTC. Counts from the clock, recomputes when the tab comes back, never reloads: a reload would drop a roll in flight and the pins. */
export const COUNTDOWN = `<script>
(function(){var el=document.querySelector('[data-left]');if(!el)return;var s=+el.getAttribute('data-left');var t0=Date.now();var told=false;
function f(x){var h=Math.floor(x/3600),m=Math.floor(x%3600/60);return h?h+' h '+m+' min':m+' min'}
function tick(){var r=s-Math.floor((Date.now()-t0)/1000);if(r<0){if(told)return;told=true;el.textContent='0 min';var n=document.getElementById('newday');if(n){n.hidden=false;n.querySelector('button').onclick=function(){location.reload()}}return}el.textContent=f(r)}
setInterval(tick,15000);document.addEventListener('visibilitychange',function(){if(!document.hidden)tick()});
})();
</script>`;
export const NEW_DAY = `<p class="note" id="newday" hidden role="status">A new UTC day has started. Refresh to see it; your pins are kept. <button type="button">Refresh</button></p>`;
export const YOURS = `<script>
(function(){var eth=window.ethereum;if(!eth||!eth.request)return;
function mark(accs){var mine={};(accs||[]).forEach(function(a){mine[a.toLowerCase()]=1});var n=0;document.querySelectorAll('[data-owner]').forEach(function(el){var y=!!mine[el.getAttribute('data-owner')];el.classList.toggle('yours',y);if(y)n++});var box=document.getElementById('yours');if(box){box.hidden=!n;var c=box.querySelector('b');if(c)c.textContent=n}}
eth.request({method:'eth_accounts'}).then(mark).catch(function(){});
if(eth.on){eth.on('accountsChanged',mark);eth.on('disconnect',function(){mark([])})}
})();
</script>`;

export function staleNote(status: ChainStatus | null | undefined): string {
  if (!status?.configured) return "";
  if (!status.known) return `<p class="note" role="status">Collection status is unavailable. The chain did not answer. The builder works; rolling and the list of faces wait for the chain.</p>`;
  if (!status.stale) return "";
  const when = new Date(status.readAt!).toISOString().slice(11, 16);
  return `<p class="note" role="status">Collection status could not be refreshed. Showing data from ${when} UTC.</p>`;
}

export function tierTag(tier: string): string {
  return tier === "common" ? "" : `<span class="tag ${tier}">${tier}</span>`;
}
/** The traits of a face as a definition list, with tiers. */
export function traitList(t: Traits): string {
  const rows = attributesOf(t).map((a) => `<dt>${esc(a.trait_type.toLowerCase())}</dt><dd>${esc(a.value)}${a.tier ? tierTag(a.tier) : ""}</dd>`);
  rows.push(`<dt>rarity</dt><dd>${rarityOf(t)}</dd>`);
  return `<dl class="traits">${rows.join("")}</dl>`;
}

export const PIXEL = true;
export const FILE_PREFIX = "faces";
export const SIZES = [1024, 2048, 4096];

export function whoBlock(chain: ChainState | null, status?: ChainStatus | null): string {
  const off = !chain && status?.configured;
  return `<div class="whobox"><div class="who">${chain ? `<button class="cta syne" id="connect" type="button">Connect wallet</button>` : ""}<form action="/go" method="get"><label for="who">Wallet address or ENS name</label><div class="line"><input class="field" id="who" name="who" placeholder="0x1234… or name.eth" autocomplete="off" spellcheck="false" required pattern="^\\s*(0x[0-9a-fA-F]{40}|[a-zA-Z0-9-]+(\\.[a-zA-Z0-9-]+)*\\.eth)\\s*$" title="A 42-character address starting with 0x, or an ENS name ending in .eth"><button class="cta ghost syne" type="submit">View wallet</button></div></form></div>
<p class="msg" id="msg" aria-live="polite">${off ? "The chain did not answer. Viewing a wallet needs it. Try again in a minute." : ""}</p>
<p class="small" id="last" hidden>Last time here: <a href="/">…</a>.</p></div>`;
}
export function sizePicker(): string {
  return `<div class="dl" style="border:0;padding:0;margin:0"><span class="lab" id="sizelab">PNG and JPEG size</span><div class="sizes" role="group" aria-labelledby="sizelab">${SIZES.map((s) => `<button type="button" data-size="${s}" aria-pressed="${s === 2048}">${s}</button>`).join("")}</div></div>`;
}
/** The download bar under one face. SVG is the file itself; PNG without JavaScript is a 1024 pixel PNG the server draws; JPEG needs JavaScript. */
export function downloadBar(id: number, bg: string): string {
  const d = `data-id="${id}" data-unit="face" data-src="/face/${id}.svg${IMG_Q}" data-bg="${bg}"`;
  return `<div class="dl"><span class="lab">Download face ${id}</span><a class="btn" href="/face/${id}.svg${IMG_Q}" download="${FILE_PREFIX}-face-${id}.svg" aria-label="SVG of face ${id}">SVG</a><a class="btn" href="/face/${id}-1024.png${IMG_Q}" download="${FILE_PREFIX}-face-${id}-1024.png" data-dl="png" ${d} aria-label="PNG of face ${id}">PNG</a><a class="btn" href="/face/${id}-1024.png${IMG_Q}" data-dl="jpeg" ${d} hidden data-js aria-label="JPEG of face ${id}">JPEG</a><noscript><span class="small">JPEG needs JavaScript; the PNG link saves a 1024 pixel PNG.</span></noscript></div>`;
}

export function connectScript(base = "/", entry = false): string {
  return `<script>
(function(){
var BASE=${JSON.stringify(base)};var ENTRY=${entry ? "true" : "false"};var KEY='onenft_who';var btn=document.getElementById('connect');var out=document.getElementById('msg');var last=document.getElementById('last');
function say(t){if(out)out.textContent=t}
function here(a){return location.pathname.toLowerCase()===(BASE+a).toLowerCase()}
function remember(a){try{localStorage.setItem(KEY,a)}catch(e){}}
function offer(a,label){if(!last||here(a))return;var l=last.querySelector('a');l.href=BASE+a;l.textContent=a.slice(0,6)+'\\u2026'+a.slice(-4);last.firstChild.textContent=label+': ';last.hidden=false}
var who=null;try{who=localStorage.getItem(KEY)}catch(e){}
if(who&&/^0x[0-9a-fA-F]{40}$/.test(who))offer(who,'Last time here');
if(!btn)return;var eth=window.ethereum;
if(!eth||!eth.request){btn.disabled=true;btn.textContent='No wallet detected';say('No wallet detected. Enter a public address to browse, or open this site in your wallet\\u2019s browser to connect.');return}
function known(accs){if(!accs||!accs.length){btn.textContent='Connect wallet';btn.onclick=null;btn.disabled=false;return}var a=accs[0];remember(a);if(here(a)){btn.textContent='This is your wallet';btn.disabled=true;return}if(ENTRY){location.replace(BASE+a);return}btn.textContent='Your wallet';btn.disabled=false;btn.onclick=function(){location.href=BASE+a};offer(a,'Connected')}
eth.request({method:'eth_accounts'}).then(known).catch(function(){});
if(eth.on){eth.on('accountsChanged',known);eth.on('disconnect',function(){known([])})}
btn.addEventListener('click',async function(){if(btn.onclick)return;btn.disabled=true;
  try{var accs=await eth.request({method:'eth_requestAccounts'});if(!accs||!accs.length)throw new Error('the wallet gave no account');var acc=accs[0];remember(acc);location.href=BASE+acc}
  catch(e){say(e&&e.code===4001?'Cancelled in the wallet.':e&&e.code===-32002?'The wallet is already asking. Open it to answer.':'Failed: '+((e&&e.message)||e));btn.disabled=false}});
})();
</script>`;
}

export function downloadScript(prefix = FILE_PREFIX, pixel = PIXEL): string {
  return `<script>
(function(){
var PREFIX=${JSON.stringify(prefix)};var PIXEL=${pixel ? "true" : "false"};var KEY='onenft_size';var SIZES=${JSON.stringify(SIZES)};
var size=2048;try{var s=+localStorage.getItem(KEY);if(SIZES.indexOf(s)>=0)size=s}catch(e){}
var out=document.getElementById('msg');function say(t){if(out)out.textContent=t}
var picks=document.querySelectorAll('.sizes button');
function paint(){picks.forEach(function(b){b.setAttribute('aria-pressed',String(+b.getAttribute('data-size')===size))})}
picks.forEach(function(b){b.addEventListener('click',function(){size=+b.getAttribute('data-size');try{localStorage.setItem(KEY,String(size))}catch(e){}paint()})});paint();
document.querySelectorAll('[data-js]').forEach(function(el){el.hidden=false});
function save(blob,name){var a=document.createElement('a');var u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(u);a.remove()},10000)}
function timeout(ms,what){return new Promise(function(_,no){setTimeout(function(){no(new Error(what+' took too long'))},ms)})}
var busy=false;
document.querySelectorAll('[data-dl]').forEach(function(el){el.addEventListener('click',async function(ev){
  ev.preventDefault();if(busy){say('One download at a time. The other one is still drawing.');return}
  var kind=el.getAttribute('data-dl');var n=el.getAttribute('data-id')||el.getAttribute('data-day');var unit=el.getAttribute('data-unit')||'face';var prefix=el.getAttribute('data-prefix')||PREFIX;
  var pixel=el.hasAttribute('data-pixel')?el.getAttribute('data-pixel')==='1':PIXEL;var bg=el.getAttribute('data-bg')||'#000000';
  busy=true;var was=el.textContent;el.textContent='\\u2026';el.setAttribute('aria-busy','true');say('');var u=null;
  try{
    var ctl=new AbortController();var t=setTimeout(function(){ctl.abort()},20000);
    var res;try{res=await fetch(el.getAttribute('data-src'),{signal:ctl.signal})}finally{clearTimeout(t)}
    if(!res.ok)throw new Error('the image answered '+res.status);var text=await res.text();
    if(kind==='svg'){save(new Blob([text],{type:'image/svg+xml'}),prefix+'-'+unit+'-'+n+'.svg');return}
    text=text.replace(/ width="\\d+" height="\\d+"/,' width="'+size+'" height="'+size+'"');
    u=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));var img=new Image();
    await Promise.race([new Promise(function(ok,no){img.onload=ok;img.onerror=function(){no(new Error('the browser could not draw the image'))};img.src=u}),timeout(20000,'drawing')]);
    if(img.decode){try{await img.decode()}catch(e){}}
    var c=document.createElement('canvas');c.width=size;c.height=size;var ctx=c.getContext('2d');if(!ctx)throw new Error('the browser gave no canvas');ctx.imageSmoothingEnabled=!pixel;
    if(kind==='jpeg'){ctx.fillStyle=bg;ctx.fillRect(0,0,size,size)}
    ctx.drawImage(img,0,0,size,size);
    var blob=await Promise.race([new Promise(function(ok){c.toBlob(ok,kind==='jpeg'?'image/jpeg':'image/png',0.92)}),timeout(30000,'encoding')]);
    if(!blob)throw new Error('the browser gave no file, try a smaller size');
    save(blob,prefix+'-'+unit+'-'+n+'-'+size+(kind==='jpeg'?'.jpg':'.png'));c.width=c.height=1;
  }catch(e){say('Download failed: '+((e&&e.name==='AbortError')?'the image took too long':((e&&e.message)||e)))}
  finally{if(u)URL.revokeObjectURL(u);el.textContent=was;el.removeAttribute('aria-busy');busy=false}
})});
})();
</script>`;
}

/**
 * The builder script: pins, price, preview, and the roll, as a state machine
 * the browser can leave and come back to.
 *
 *   idle → wallet → network → check → confirm → sent → committed → reveal →
 *   revealed → done, or error / unknown at any step.
 *
 * The pins and the price are frozen when the button is pressed; the gallery is
 * locked until the roll settles. The commit hash is kept in the browser for
 * this chain, contract and account, so a refresh or a return to the tab picks
 * the wait back up. Success is a receipt with status success; the face is the
 * token named by the Rolled event of the reveal, never the newest face of the
 * wallet. A timeout is an unknown outcome and offers a status check; nothing
 * is ever sent twice by itself. A draft of the pins survives a refresh as long
 * as the prices have not changed.
 */
function builderScript(chain: ChainState | null): string {
  const cfg = JSON.stringify({
    address: chain?.address ?? null,
    chainHex: chain ? "0x" + chain.chainId.toString(16) : null,
    name: chain ? chainName(chain.chainId) : null,
    rpc: chain?.chainId === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org",
    explorer: chain ? explorer(chain.chainId) : "",
    selector: COMMIT_SELECTOR,
    revealSelector: REVEAL_SELECTOR,
    prices: PIN_PRICES_WEI.map((p) => p.toString()),
    priceLabels: PIN_PRICES_WEI.map((p) => ethOf(p)),
    keys: Array.from({ length: PIN_BYTES }, (_, k) => PIN_KEYS[k] ?? null),
    maxPins: MAX_PINS,
    epoch: chain?.epoch ?? null,
  });
  return `<script>
(function(){
var CFG=${cfg};var pins={};var btn=document.getElementById('roll');var out=document.getElementById('msg');var prev=document.getElementById('preview');var price=document.getElementById('price');var keep=document.getElementById('keep');var clear=document.getElementById('clear');var sum=document.getElementById('sum');var check=document.getElementById('check');var manual=document.getElementById('manual');var fee=document.getElementById('fee');
var galleryButtons=document.querySelectorAll('.items button');
var DRAFT='onenft_pins:'+(CFG.address||'none');var pricesTag=CFG.prices.join(',');
function say(t){if(out)out.textContent=t}
function link(h){return ' <a href="'+CFG.explorer+'/tx/'+h+'" target="_blank" rel="noopener">View transaction</a>'}
function show(t,h){if(!out)return;out.textContent=t;if(h)out.insertAdjacentHTML('beforeend',link(h))}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function packed(){var v='';CFG.keys.forEach(function(s){var p=s?pins[s]:undefined;v+=(p===undefined?'ff':('0'+p.toString(16)).slice(-2))});return v}
function count(){return Object.keys(pins).length}
function priceText(n){return n?CFG.priceLabels[n]+' ETH':'0 ETH'}
function names(){var out=[];CFG.keys.forEach(function(s){if(!s||pins[s]===undefined)return;var b=document.querySelector('.items button[data-slot="'+s+'"][data-item="'+pins[s]+'"]');out.push((b&&b.getAttribute('data-name'))||s)});return out}
function saveDraft(){try{if(count())localStorage.setItem(DRAFT,JSON.stringify({pins:pins,prices:pricesTag}));else localStorage.removeItem(DRAFT)}catch(e){}}
function loadDraft(){try{var d=JSON.parse(localStorage.getItem(DRAFT)||'null');if(!d||d.prices!==pricesTag)return;Object.keys(d.pins||{}).forEach(function(s){var b=document.querySelector('.items button[data-slot="'+s+'"][data-item="'+d.pins[s]+'"]');if(b)pins[s]=d.pins[s]})}catch(e){}}
var previewFails=0;
function update(){
  galleryButtons.forEach(function(b){var on=pins[b.dataset.slot]===+b.dataset.item;b.setAttribute('aria-pressed',String(on))});
  document.querySelectorAll('.gallery').forEach(function(g){var s=g.getAttribute('data-slot');var b=g.querySelector('.items button[aria-pressed="true"]');var p=g.querySelector('.pick');if(p)p.textContent=b?'Pinned: '+b.getAttribute('data-name'):'Luck decides'});
  var src='/preview.svg?p='+packed();if(prev.getAttribute('src')!==src){prev.src=src}
  var n=count();if(price)price.textContent=priceText(n);
  if(fee)fee.textContent=n?'Pin fee '+priceText(n)+' plus network gas.':'0 ETH mint fee. You pay network gas.';
  if(btn&&!btn.disabled)btn.textContent=n?'Roll with '+n+(n===1?' pin':' pins'):'Roll a face';
  if(keep)CFG.keys.forEach(function(s){if(!s)return;var dd=keep.querySelector('[data-keep="'+s+'"]');var b=document.querySelector('.items button[aria-pressed="true"][data-slot="'+s+'"]');if(dd)dd.innerHTML=b?'<b></b>':'<span class="luck">luck decides</span>';if(dd&&b)dd.querySelector('b').textContent=b.getAttribute('data-name')});
  if(sum)sum.textContent=n?n+(n===1?' pin: ':' pins: ')+names().join(', '):'No pins. Luck decides everything.';
  if(clear)clear.hidden=!n;
  saveDraft();
}
prev.addEventListener('error',function(){previewFails++;say(previewFails>1?'The preview could not load. Your pins are kept; the roll does not need the preview.':'The preview could not load. Retrying.');if(previewFails<=1)setTimeout(function(){prev.src=prev.src.split('&')[0]+'&r='+Date.now()},1500)});
prev.addEventListener('load',function(){previewFails=0});
galleryButtons.forEach(function(b){b.addEventListener('click',function(){if(locked){say('The roll is in progress. The pins are frozen until it settles.');return}var s=b.dataset.slot,i=+b.dataset.item;if(pins[s]===i){delete pins[s]}else{if(pins[s]===undefined&&count()>=CFG.maxPins){say('That is every pin there is.');return}pins[s]=i}say('');update()})});
if(clear)clear.addEventListener('click',function(){if(locked)return;pins={};update()});
var locked=false;
function lock(on){locked=on;galleryButtons.forEach(function(b){b.disabled=on});if(clear)clear.disabled=on;if(btn)btn.disabled=on}
if(window.matchMedia&&matchMedia('(max-width:900px)').matches){document.querySelectorAll('.gallery').forEach(function(g,i){if(i>0)g.removeAttribute('open')})}
loadDraft();update();
if(!btn)return;
var eth=window.ethereum;var account=null;
function key(a){return 'onenft_roll:'+CFG.chainHex+':'+CFG.address.toLowerCase()+':'+a.toLowerCase()}
function keepRec(a,r){try{localStorage.setItem(key(a),JSON.stringify(r))}catch(e){}}
function rec(a){try{return JSON.parse(localStorage.getItem(key(a))||'null')}catch(e){return null}}
function drop(a){try{localStorage.removeItem(key(a))}catch(e){}}
async function receipt(hash){try{return await eth.request({method:'eth_getTransactionReceipt',params:[hash]})}catch(e){return null}}
async function status(from,send){try{var r=await fetch((send?'/api/reveal/':'/api/roll/')+from,{method:send?'POST':'GET',cache:'no-store'});return await r.json()}catch(e){return {state:'rpc-down',reason:'this site did not answer'}}}
function offerCheck(f){check.hidden=false;check.onclick=function(){check.hidden=true;f()}}
function done(id){say('Your face is #'+id+'. Opening it.');drop(account);try{localStorage.removeItem(DRAFT)}catch(e){}setTimeout(function(){location.href='/face/'+id},1200)}
async function waitCommit(from,hash){
  for(var i=0;i<45;i++){
    var r=await receipt(hash);
    if(r){if(r.status==='0x1'){keepRec(from,{stage:'committed',hash:hash,epoch:CFG.epoch});show('Your roll is committed. Waiting for the reveal.',hash);return revealLoop(from,hash)}
      drop(from);show('The network rejected the commit. Nothing was spent beyond gas. You can roll again.',hash);lock(false);update();return}
    await sleep(document.hidden?4000:2000);
  }
  show('We cannot confirm the transaction yet. Check its status before trying again.',hash);offerCheck(function(){show('Checking.',hash);waitCommit(from,hash)});
}
async function revealLoop(from,commitHash){
  for(var i=0;i<80;i++){
    var s=await status(from,true);
    if(s.state==='confirmed'&&s.tokenId){return done(s.tokenId)}
    if(s.state==='none'&&s.rolledToday&&!s.tokenId){say('Your roll is revealed. Finding your face.');await sleep(3000);continue}
    if(s.state==='none'&&!s.rolledToday){say('The chain shows no roll for this wallet today.');drop(from);lock(false);update();return}
    if(s.state==='waiting'){say('Your roll is committed. Waiting for the reveal block ('+(s.head||'?')+' of '+(s.revealBlock||'?')+').')}
    else if(s.state==='sent'){show('Reveal sent. Waiting for confirmation.',s.tx)}
    else if(s.state==='unknown'){show('We cannot confirm the reveal yet. Check its status before trying again.',s.tx);offerCheck(function(){revealLoop(from,commitHash)});return}
    else if(s.state==='no-keeper'){say('Your roll is committed, but the reveal service is not running here. You can reveal it from your wallet; it costs network gas.');manual.hidden=false;manual.onclick=function(){manualReveal(from)};return}
    else if(s.state==='failed'){say('Your roll is committed, but the reveal service could not send the reveal ('+(s.reason||'unknown reason')+'). Check again in a minute, or reveal it from your wallet.');manual.hidden=false;manual.onclick=function(){manualReveal(from)};offerCheck(function(){revealLoop(from,commitHash)});return}
    else if(s.state==='rpc-down'){say('Your roll is committed, but the reveal service is unavailable. Check again.');offerCheck(function(){revealLoop(from,commitHash)});return}
    await sleep(document.hidden?5000:2500);
  }
  say('Your roll is committed. The reveal is taking long; your roll is safe. Check again in a minute.');offerCheck(function(){revealLoop(from,commitHash)});
}
async function manualReveal(from){
  manual.hidden=true;
  try{
    say('Confirm the reveal in your wallet. You pay network gas.');
    var hash=await eth.request({method:'eth_sendTransaction',params:[{from:from,to:CFG.address,data:CFG.revealSelector+from.slice(2).toLowerCase().padStart(64,'0')}]});
    show('Reveal sent. Waiting for confirmation.',hash);
    for(var i=0;i<45;i++){var r=await receipt(hash);if(r){if(r.status==='0x1'){var s=await status(from,false);if(s.tokenId)return done(s.tokenId);say('Revealed. Finding your face.');return revealLoop(from,null)}show('The network rejected the reveal. It may have been revealed already. Checking.',hash);return revealLoop(from,null)}await sleep(2500)}
    show('We cannot confirm the reveal yet. Check its status before trying again.',hash);offerCheck(function(){revealLoop(from,null)});
  }catch(e){say(e&&e.code===4001?'Cancelled in the wallet. Your roll is still committed.':'Failed: '+((e&&e.message)||e));manual.hidden=false}
}
async function resume(){
  if(!eth||!eth.request)return;
  try{var accs=await eth.request({method:'eth_accounts'});if(!accs||!accs.length)return;account=accs[0];var r=rec(account);if(!r)return;
    if(r.epoch!==CFG.epoch){drop(account);return}
    lock(true);if(r.stage==='sent'){show('Transaction sent. Waiting for confirmation.',r.hash);waitCommit(account,r.hash)}else{show('Your roll is committed. Waiting for the reveal.',r.hash);revealLoop(account,r.hash)}}catch(e){}
}
if(eth&&eth.on){eth.on('accountsChanged',function(accs){var a=accs&&accs[0]||null;if(account&&(!a||a.toLowerCase()!==account.toLowerCase())){if(locked){say('The wallet account changed. The roll in progress belongs to the previous account; switch back to follow it.')}account=a;if(!locked&&a){var r=rec(a);if(r&&r.epoch===CFG.epoch){resume()}}}});
  eth.on('chainChanged',function(){say('The wallet switched network. Switch back to '+CFG.name+' to roll.')})}
btn.addEventListener('click',async function(){
  if(!eth||!eth.request){say('No wallet detected. Open this site in your wallet\\u2019s browser, or install one like Rabby, MetaMask or Coinbase Wallet.');return}
  lock(true);
  var snapPins=packed(),snapN=count(),snapWei=BigInt(CFG.prices[snapN]);
  try{
    var accs=await eth.request({method:'eth_requestAccounts'});if(!accs||!accs.length)throw new Error('the wallet gave no account');var from=accs[0];account=from;
    var r=rec(from);if(r&&r.epoch===CFG.epoch){show('A roll from this wallet is already in progress.',r.hash);return r.stage==='sent'?waitCommit(from,r.hash):revealLoop(from,r.hash)}
    try{await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:CFG.chainHex}]})}
    catch(e){if(e&&e.code===4902){await eth.request({method:'wallet_addEthereumChain',params:[{chainId:CFG.chainHex,chainName:CFG.name,rpcUrls:[CFG.rpc],nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},blockExplorerUrls:[CFG.explorer]}]})}else{throw e}}
    var st=await status(from,false);
    if(st.state==='rpc-down'){say('The chain did not answer. Try again in a minute.');lock(false);update();return}
    if(st.revealBlock){say('You have a roll waiting to be revealed.');keepRec(from,{stage:'committed',hash:null,epoch:CFG.epoch});return revealLoop(from,null)}
    if(st.rolledToday){say('This wallet rolled today already. Midnight UTC resets it.');lock(false);update();return}
    if(st.soldOut){say('Sold out. Every face has been rolled or is being revealed.');lock(false);update();return}
    say(snapN?'Confirm in your wallet: '+priceText(snapN)+' pin fee plus network gas, for '+snapN+(snapN===1?' pin.':' pins.'):'Confirm in your wallet. 0 ETH mint fee. You pay network gas.');
    var data=CFG.selector+snapPins.padStart(64,'0');
    var tx={from:from,to:CFG.address,data:data};if(snapWei>0n)tx.value='0x'+snapWei.toString(16);
    var hash=await eth.request({method:'eth_sendTransaction',params:[tx]});
    keepRec(from,{stage:'sent',hash:hash,epoch:CFG.epoch,pins:snapPins});show('Transaction sent. Waiting for confirmation.',hash);
    await waitCommit(from,hash);
  }catch(e){say(e&&e.code===4001?'Cancelled in the wallet. Nothing was sent.':e&&e.code===-32002?'The wallet is already asking. Open it to answer.':'Failed: '+((e&&e.message)||e));lock(false);update()}
});
resume();
})();
</script>`;
}

const GALLERY_LABELS: Record<string, string> = { background: "Background", ground: "Ground colour", head: "Head", skin: "Skin", eyes: "Eyes", mouth: "Mouth", hair: "Hair", hairColour: "Hair colour", top: "Top", topColour: "Top colour", accessory: "Accessory", accent: "Accent colour" };
/** Pattern next to its colour: background then ground colour, hair then hair colour, then the rest. */
const GALLERY_ORDER: string[] = ["background", "ground", "head", "skin", "eyes", "mouth", "hair", "hairColour", "top", "topColour", "accessory", "accent"];

function itemButton(slot: string, i: number, name: string, img: string, extra = ""): string {
  return `<button type="button" data-slot="${slot}" data-item="${i}" data-name="${esc(name)}" aria-pressed="false" aria-label="Pin ${esc(name)}"><img src="${img}" alt="" width="72" height="72" loading="lazy">${extra}</button>`;
}
function gallery(key: string, items: string, count: string): string {
  const label = GALLERY_LABELS[key];
  return `<details class="gallery" id="g-${key}" data-slot="${key}" open><summary><h3 class="syne" id="h-${key}">${esc(label)}</h3><span>${count}</span></summary><p class="pick" aria-live="polite">Luck decides</p><div class="items px" role="group" aria-labelledby="h-${key}">${items}</div></details>`;
}
function itemGallery(k: number): string {
  const s = SLOTS[k];
  const items = s.items.map((it, i) => pinOk(k, i) ? itemButton(s.slot, i, it.name, `/item/${s.slot}/${i}.svg`, it.tier === "uncommon" ? `<span class="u" title="uncommon" aria-hidden="true">u</span>` : "") : "").join("");
  const rareCount = s.items.filter((it) => it.tier === "rare" || it.tier === "legendary").length;
  return gallery(s.slot, items, `${s.items.filter((it, i) => pinOk(k, i)).length} to pin, ${rareCount} only by luck`);
}
function skinGallery(): string {
  const items = SKINS.map((sk, i) => skinPinOk(i) ? itemButton("skin", i, sk.name, `/skin/${i}.svg`) : "").join("");
  const rare = SKINS.filter((sk) => sk.tier === "rare" || sk.tier === "legendary").length;
  return gallery("skin", items, `${SKINS.filter((_, i) => skinPinOk(i)).length} to pin, ${rare} only by luck`);
}
function colourGallery(key: string, base: string, list: { name: string; main: string }[]): string {
  const items = list.map((c, i) => itemButton(key, i, c.name, `${base}${i}.svg`, `<span class="sw" style="background:${c.main}" aria-hidden="true"></span>`)).join("");
  return gallery(key, items, `${list.length} to pin`);
}
function galleries(): string {
  const cats = `<nav class="cats" aria-label="Pin categories">${GALLERY_ORDER.map((k) => `<a href="#g-${k}">${esc(GALLERY_LABELS[k])}</a>`).join("")}</nav>`;
  return cats + GALLERY_ORDER.map((key) => {
    if (key === "ground") return colourGallery("ground", "/ground/", GROUNDS);
    if (key === "hairColour") return colourGallery("hairColour", "/haircolour/", HAIRS);
    if (key === "topColour") return colourGallery("topColour", "/topcolour/", TOPCOLORS);
    if (key === "accent") return colourGallery("accent", "/accent/", ACCENTS);
    if (key === "skin") return skinGallery();
    return itemGallery(SLOTS.findIndex((s) => s.slot === key));
  }).join("");
}

/** "rolled by X" from the Rolled log; "held by X" from ownerOf. The two differ after a transfer. */
export function heldBy(chain: ChainState, id: number, names: Names, link = false): string {
  const owner = chain.owners.get(id);
  if (!owner) return "";
  if (isAuthor(chain, owner)) return "held by the treasury";
  return `held by ${link ? ownerLink(owner, names) : label(owner, names)}`;
}
export function rolledBy(chain: ChainState, id: number, names: Names, link = false): string {
  const roll = chain.rolls.get(id);
  if (!roll) return "";
  if (isAuthor(chain, roll.to)) return "the treasury's daily roll";
  return `rolled by ${link ? ownerLink(roll.to, names) : label(roll.to, names)}`;
}

/**
 * The home page. The sidebar carries the name, the title and one sentence; the
 * builder comes next with the preview, the price and the roll button together,
 * then the galleries, then the counts and the newest faces.
 */
export function homePage(chain: ChainState | null, epoch: number, names: Names = NO_NAMES, status: ChainStatus | null = null): string {
  const t = pageTraits(chain, epoch);
  const p = groundOf(t);
  const total = chain?.totalSupply ?? null;
  const rows: string[] = [];
  if (chain) {
    for (let id = chain.totalSupply; id >= Math.max(1, chain.totalSupply - 40); id--) {
      const f = chain.faces.get(id);
      if (!f) continue;
      const ft = traitsOfRecord(f);
      const owner = chain.owners.get(id);
      const who = rolledBy(chain, id, names) || heldBy(chain, id, names);
      const pinsN = Object.keys(unpackPins(f.pins)).length;
      const r = rarityOf(ft);
      rows.push(`<a class="row" href="/face/${id}"${owner ? ` data-owner="${owner.toLowerCase()}"` : ""}><img class="px" src="/face/${id}.svg${IMG_Q}" alt="" loading="lazy" width="92" height="92"><span><span class="n syne">#${id}</span>${tierTag(r)}<br><span class="small">${who}${pinsN ? `, ${pinsN} ${plural(pinsN, "pin", "pins")}` : ""}${f.one !== 255 ? ", one of one" : ""}</span></span></a>`);
    }
  }
  const badge = chain && chain.chainId !== 8453 ? ` <span class="testnet">${chainName(chain.chainId)} testnet</span>` : "";
  // The clock, never a cached chain read.
  const left = 86400 - (Math.floor(Date.now() / 1000) % 86400);
  const soldOut = chain ? chain.totalSupply + chain.pending >= MAX_SUPPLY : false;
  const keep = `<dl class="keep" id="keep">${GALLERY_ORDER.map((key) => `<dt>${GALLERY_LABELS[key].toLowerCase()}</dt><dd data-keep="${key}"><span class="luck">luck decides</span></dd>`).join("")}</dl>`;
  let cta: string;
  if (chain && soldOut) {
    cta = `<div class="price"><span class="small">Pin fee</span><span class="syne" id="price">0 ETH</span></div>
<button class="cta syne" disabled>Sold out</button>
<p class="small">Every one of the ${num(MAX_SUPPLY)} faces has been rolled or is being revealed. Nothing more can be rolled.${badge}</p>`;
  } else if (chain) {
    cta = `<div class="price"><span class="small">Pin fee</span><span class="syne" id="price">0 ETH</span></div>
<button class="cta syne" id="roll">Roll a face</button>
<p class="msg" id="msg" aria-live="polite"></p>
<button class="cta ghost syne" id="check" type="button" hidden>Check status</button>
<button class="cta ghost syne" id="manual" type="button" hidden>Reveal from my wallet</button>
<button class="cta ghost syne" id="clear" type="button" hidden>Clear pins</button>
<p class="small" id="fee">0 ETH mint fee. You pay network gas.</p>
<p class="small">One roll per wallet each UTC day while supply remains. <span data-left="${left}">${fmtLeft(left)}</span> to midnight UTC.${badge}</p>`;
  } else {
    cta = `<div class="price"><span class="small">Pin fee</span><span class="syne" id="price">0 ETH</span></div><a class="cta ghost syne" href="/how">How it works</a><button class="cta ghost syne" id="clear" type="button" hidden>Clear pins</button><p class="msg" id="msg" aria-live="polite"></p><p class="small" id="fee">0 ETH mint fee. You pay network gas.</p><p class="small">${status?.configured ? "Rolling needs the chain, and the chain did not answer. Try again in a minute." : "Rolling opens with the contract."}</p>`;
  }
  const counts = `<section class="counts syne" aria-label="Counts"><div><b>${total === null ? "?" : num(total)}</b><span class="small">of ${num(MAX_SUPPLY)} rolled</span></div>${chain ? `<div><b>${num(chain.pending)}</b><span class="small">being revealed</span></div><div><b>${num(chain.poolLeft)}</b><span class="small">one of ones left</span></div><div id="yours" hidden><b>0</b><span class="small">yours</span></div>` : ""}</section>`;
  const body = `<div class="page">
<aside><div class="stick">
${crumb()}
<h1 class="syne">One face<br>a day,<br>yours to pin</h1>
<p class="lead">Roll one face per wallet each UTC day. Leave every trait to chance, or pin up to ${MAX_PINS} traits and colours for a fee.</p>
</div></aside>
<main id="main">
${staleNote(status)}
${NEW_DAY}
<section class="builder" aria-labelledby="build-h">
<h2 id="build-h" class="syne" hidden>Build your roll</h2>
<div class="stage"><div class="preview px"><img id="preview" src="/preview.svg?p=ffffffffffffffffffffffffffffffff" alt="Your pins on a grey stand-in; grey parts are luck's" width="512" height="512"></div>
<p class="sum" id="sum">No pins. Luck decides everything.</p>
<div style="display:flex;flex-direction:column;gap:10px">${cta}</div>
<p class="small hint">Grey is what luck decides. Colour is what you pin. ${pinRule().replace(/^a pin/, "A pin")}. Rare and legendary traits cannot be pinned; they come from luck or not at all.</p>
${keep}</div>
<div class="galleries">${galleries()}</div>
</section>
${counts}
<nav class="sitenav small" aria-label="Site">${menu()}</nav>
${rows.length ? rows.join("\n") : chain ? `<p class="lead" style="padding:34px">Nobody has rolled yet. The first face is yours to make.</p>` : ""}
<footer><span>This is not an investment and never will be. Images are CC0. One of the collections at <a href="https://${PARENT}">${PARENT}</a>.</span><nav aria-label="Footer">${menu([[`https://${PARENT}`, "All collections"]])}${chain ? `<a href="${openseaCollection(chain)}">OpenSea</a><a href="${explorer(chain.chainId)}/address/${chain.address}">Basescan</a>` : ""}<a href="${REPO}">Code</a></nav></footer>
</main>
</div>
${builderScript(chain)}
${chain ? YOURS : ""}
${COUNTDOWN}`;
  return layout(`${SITE}`, p, body, "/today.png", "/");
}

export function facePage(id: number, f: FaceRecord, chain: ChainState, names: Names = NO_NAMES, status: ChainStatus | null = null): string {
  const t = traitsOfRecord(f);
  const p = groundOf(t);
  const roll = chain.rolls.get(id);
  const pins = unpackPins(f.pins);
  const pinsN = Object.keys(pins).length;
  const held = heldBy(chain, id, names, true);
  const rolled = rolledBy(chain, id, names, true);
  const url = `https://${SITE}/face/${id}`;
  const text = encodeURIComponent(`Face #${id} of ${SITE}`);
  const snippet = esc(`<a href="${url}"><img src="https://${SITE}/face/${id}.svg${IMG_Q}" width="256" height="256" alt="Face #${id} of faces.onenft.click" style="image-rendering:pixelated"></a>`);
  const body = `<main class="single" id="main">
${topBar(`Face #${id}`)}
${staleNote(status)}
<div class="face px">${stripSize(svgOf(t))}</div>
<div><h2 class="num syne" style="margin:0">#${id}</h2><p class="lead">${held || "holder unknown"}${pinsN ? `, ${pinsN} ${plural(pinsN, "pin", "pins")} (${Object.keys(pins).map((k) => esc(GALLERY_LABELS[k]?.toLowerCase() ?? k)).join(", ")})` : ", no pins"}${f.one !== 255 ? ", one of one" : ""}</p></div>
${roll ? `<p class="small">${rolled ? rolled[0].toUpperCase() + rolled.slice(1) : "Rolled"} on ${dateOf(Math.floor(roll.at / 86400))}${roll.paid ? `, pin fee ${eth(roll.paid)}` : ""}, <a href="${explorer(chain.chainId)}/tx/${roll.tx}">transaction</a>.</p>` : ""}
${f.one !== 255 ? `<p class="small">A one of one is a full drawing. It kept the pinned background and ground colour, if any, and replaced every other pin.</p>` : ""}
${traitList(t)}
<p class="small" style="line-height:1.7">Seed ${f.seed.toString()}. Token ${id} of <a href="${explorer(chain.chainId)}/address/${chain.address}">${shortAddr(chain.address)}</a> on ${chainName(chain.chainId)}. The image and its rules live in the contract.</p>
${downloadBar(id, p.bg)}
<nav class="nav" aria-label="Faces">${id > 1 ? `<a href="/face/${id - 1}">previous</a>` : ""}${id < chain.totalSupply ? `<a href="/face/${id + 1}">next</a>` : ""}<a href="/">roll yours</a></nav>
<nav class="nav small" aria-label="Links"><a href="${opensea(chain, id)}">OpenSea</a><a href="${explorer(chain.chainId)}/nft/${chain.address}/${id}">Basescan</a><a href="/face/${id}.png${IMG_Q}">Link card</a><a href="/api/face/${id}">JSON</a></nav>
<nav class="share" aria-label="Share"><a href="https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(url)}">Share on Farcaster</a><a href="https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}">Share on X</a></nav>
<details><summary class="small">Put this face on your page</summary><pre class="snip">${snippet}</pre><p class="small">CC0. No credit needed.</p></details>
</main>
${downloadScript()}`;
  return layout(`Face #${id} | ${SITE}`, p, body, `/face/${id}.png${IMG_Q}`, `/face/${id}`);
}

export function howPage(chain: ChainState | null, epoch: number): string {
  const p = groundOf(pageTraits(chain, epoch));
  const body = `<main class="prose" id="main">
${topBar("How it works")}
<h2 class="syne">One roll a day, and what you may pin</h2>
<p><strong>The roll.</strong> Each wallet may roll once per UTC day while supply remains, in two steps. <code>commit</code> spends your day, fixes your pins and pays the pin fee. Two blocks later <code>reveal</code> mixes the hash of the block after your commit with your address, your pins and the commit block into a 64-bit seed, and the seed decides everything: seven layers, five colours, and whether this roll takes a one of one. Anyone may reveal for anyone. This site's keeper does it for you, so you sign once; a commit nobody reveals waits, and you can reveal it from your own wallet. A roll without pins has no mint fee; you pay the network gas of one transaction.</p>
<p><strong>The pins.</strong> ${MAX_PINS} things can be pinned: the seven layers (background, top, head, eyes, mouth, accessory, hair or hat) and five colours (skin, hair, ground, top, accent). Layers pin to common or uncommon items only; the pinnable skins are the eleven human tones; the fantasy tones are rare or legendary and come only from luck. Every other colour can be pinned. ${pinRule()[0].toUpperCase() + pinRule().slice(1)}: ${PIN_PRICES_WEI.slice(1, 4).map((w) => ethOf(w)).join(", ")} ETH for one, two, three pins. 95 percent of the fee goes to the author, 5 percent to the keeper wallet that pays gas for reveals and the treasury's rolls. Rare and legendary traits cannot be pinned.</p>
<p><strong>The layers.</strong> ${SLOTS.map((s) => `${s.items.length} ${s.trait.toLowerCase()}`).join(", ")}. Every item has a tier: common, uncommon, rare, legendary. The weight tables live in the contract; <a href="/rarity">the rarity page</a> lists each item's odds per roll. Skin, hair colour, top colour, ground and accent colour are drawn on top of that. ${num(combinations())} combinations before the one of ones.</p>
<p><strong>The one of ones.</strong> ${ONE_OF_ONES.length} full drawings sit in a pool. Any roll, pinned or not, takes one with odds of pool left over tokens left: about 1 in ${Math.round(MAX_SUPPLY / ONE_OF_ONES.length)} on the first roll, better as the end nears, so on average the whole pool is rolled by the last token. A one of one keeps the pinned background and ground colour and replaces every other pin; the pin fee is not returned. The contract removes a rolled one from the pool; each exists once. <a href="/ones">See what is left.</a></p>
<p><strong>The treasury.</strong> The author's wallet gets one free roll a day too, with the same luck as everyone. Anyone may trigger it; the keeper does.</p>
<p><strong>The image.</strong> A sprite is 32 by 32 pixels of roles, not colours: outline, fill, shade, light, a second fill, white. The token's palette turns roles into colours, so one hair sprite serves every hair colour. Layers composite bottom to top, a rim light lands where a fill sits right of an outline, and the result is one SVG of rects returned as a <code>data:</code> URI by the contract. This site shows the images; it does not hold them.</p>
<p><strong>The seed, in full.</strong> The hash of the block after your commit does not exist when your commit is mined, so nobody, you included, can pick a commit block for a known result. The reveal is allowed only from two blocks after the commit, when that hash exists, and only while the chain still serves it, 256 blocks; past that anyone may call <code>renew</code>, which moves the commit to the current block and starts the two-block wait again, so a commit is never lost and no face is ever made from a missing hash. The token number is not in the seed, so the order of reveals changes nothing. The first contract of this collection (two faces) had weaker rules; the repository documents them.</p>
<p><strong>The end.</strong> Supply stops at ${num(MAX_SUPPLY)}, counting commits not yet revealed. The image rules can change for faces not yet rolled until the author locks them; a rolled face keeps its renderer forever.</p>
<h2 class="syne">Build it yourself</h2>
<p>The generator is in <a href="${REPO}">the repository</a>, in TypeScript and in Solidity, with a test that keeps the two byte for byte equal. The draw:</p>
<pre><code>u64 mix(u64 x):
  x += 0x9e3779b97f4a7c15
  x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9
  x = (x ^ (x >> 27)) * 0x94d049bb133111eb
  return x ^ (x >> 31)

seed = keccak(blockhash(commitBlock + 1), wallet, pins, commitBlock, tokenId) as u64
draw(i) = mix(seed + i) mod 10000
for slot in 0..6: item[slot] = walk(WEIGHTS[slot], draw(slot)), or the pin
skin = walk(SKIN_WEIGHTS, draw(7)), or the pin; hair colour, top colour, ground, accent = draw(8..11) mod count, or their pins
lucky = draw(12) < pool size * 10000 / tokens left; one = pool[draw(13) mod pool size]</code></pre>
<p>Everything here is CC0. If you build on it, write to me.</p>
<p class="small"><a href="/">Back to the roll</a>. Every collection: <a href="https://${PARENT}">${PARENT}</a>.</p>
</main>`;
  return layout(`How it works | ${SITE}`, p, body, "/today.png", "/how");
}

export function notFound(chain: ChainState | null, epoch: number, why?: string): string {
  const p = groundOf(pageTraits(chain, epoch));
  return layout(`Not found | ${SITE}`, p, `<main class="single" id="main">${topBar("Not found")}<h2 class="syne">Not found</h2><p class="lead">${why ? esc(why) : chain ? `Faces run from 1 to ${chain.totalSupply}.` : "Nothing here."}</p><a href="/">Back to the roll</a></main>`, "/today.png", "/");
}
export function chainDown(chain: ChainState | null, epoch: number, why = "This page needs the chain, and the chain did not answer. Try again in a minute."): string {
  const p = groundOf(pageTraits(chain, epoch));
  return layout(`The chain did not answer | ${SITE}`, p, `<main class="single" id="main">${topBar("Unavailable")}<h2 class="syne">The chain did not answer</h2><p class="lead">${esc(why)}</p><a href="/">Back to the roll</a></main>`, "/today.png", "/");
}

export function nameHeading(name: string): string {
  const size = name.length <= 11 ? "" : name.length <= 16 ? ' style="font-size:26px"' : ' style="font-size:20px;letter-spacing:-.02em"';
  return `<span class="wname"${size}>${esc(name).replace(/\./g, "<wbr>.")}</span>`;
}
export function goTarget(who: string | null, base = "/", back = "/yours"): string {
  const w = (who ?? "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(w) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/i.test(w)) return base + w;
  return `${back}?bad=${encodeURIComponent(w.slice(0, 80))}`;
}
