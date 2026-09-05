/**
 * Page HTML. The page has no palette of its own: it wears the ground colour
 * of the newest face, or of the face of the day before anyone has rolled.
 * No light or dark mode.
 *
 * Copy rules: plain words, active voice, no adverbs, no em dashes, nothing a
 * reader could misunderstand. Facts (numbers, addresses, paths) stay exact.
 */
import { SLOTS, ONE_OF_ONES } from "./sprites.ts";
import { traitsOf, svgOf, attributesOf, rarityOf, groundOf, faceOfDay, packPins, unpackPins, pinOk, skinPinOk, SKINS, PINNABLE, PIN_KEYS, MAX_PINS, PIN_PRICES_WEI, combinations, type Traits, type Pins } from "./faces.ts";
import { ROLL_SELECTOR, type ChainState, type FaceRecord } from "./contract.ts";

export type Names = Map<string, string>;
export const NO_NAMES: Names = new Map();
export type Colors = { bg: string; fg: string; muted: string };

export const SITE = "faces.onenft.click";
export const REPO = "https://github.com/pawelorzech/onenft-faces";
export const PARENT = "onenft.click";
export const MAX_SUPPLY = 10000;

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
export function label(a: string, names: Names): string {
  return names.get(a.toLowerCase()) ?? shortAddr(a);
}
export function openseaCollection(chain: ChainState): string {
  return chain.chainId === 8453 ? "https://opensea.io/collection/faces-onenft-click" : `https://testnets.opensea.io/assets/base_sepolia/${chain.address}`;
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
export const eth = (wei: bigint) => `${Number(wei) / 1e18} ETH`;
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

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
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
  const fg = p.fg, bg = p.bg;
  return `
:root{--bg:${bg};--fg:${fg};--muted:${mix(fg, bg, 0.38)};--line:${mix(fg, bg, 0.8)};--soft:${mix(fg, bg, 0.93)}}
*{box-sizing:border-box}
html{background:var(--bg);color:var(--fg);font-family:"Newsreader",Georgia,serif;font-size:17px;line-height:1.5}
body{margin:0;min-height:100vh}
a{color:inherit}
a:focus-visible,button:focus-visible{outline:3px solid var(--fg);outline-offset:3px}
.syne{font-family:"Syne",system-ui,sans-serif}
.page{display:grid;grid-template-columns:360px minmax(0,1fr);min-height:100vh}
aside{border-right:1px solid var(--line);padding:38px 32px}
aside .stick{position:sticky;top:38px;display:flex;flex-direction:column;gap:28px}
.mark{font-weight:800;font-size:20px;letter-spacing:-.01em;text-decoration:none}
h1{font-weight:800;font-size:33px;line-height:.96;letter-spacing:-.045em;margin:0;overflow-wrap:anywhere}
h2{font-weight:800;font-size:30px;line-height:1;letter-spacing:-.03em;margin:0}
h3{font-weight:700;font-size:18px;margin:0}
.lead{color:var(--muted);margin:0}
hr{border:0;border-top:1px solid var(--line);margin:0;width:100%}
.big{font-weight:700;font-size:40px;line-height:1}
.small{font-size:15px;color:var(--muted)}
.cta{display:flex;align-items:center;justify-content:center;height:58px;background:var(--fg);color:var(--bg);text-decoration:none;font-weight:700;font-size:18px}
.cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--fg)}
button.cta{border:0;cursor:pointer;width:100%;font-family:"Syne",system-ui,sans-serif}
button.cta[disabled]{opacity:.55;cursor:default}
.msg{font-size:15px;color:var(--muted);min-height:1.5em;margin:0}
.testnet{display:inline-block;padding:3px 8px;border:1px solid var(--line);font-size:13px;color:var(--muted)}
.px,.px svg,.px img{image-rendering:pixelated}
.builder{padding:38px 34px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:minmax(0,396px) minmax(280px,1fr);gap:34px;align-items:start}
.preview{width:100%;max-width:396px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line);background:var(--soft)}
.preview img{display:block;width:100%;height:100%}
.keep{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:16px;margin:0}
.keep dt{color:var(--muted)}
.keep dd{margin:0}
.keep dd b{font-weight:700}
.keep dd .luck{color:var(--muted)}
.galleries{display:flex;flex-direction:column;gap:26px}
.gallery h3{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.gallery h3 span{font-weight:400;font-size:14px;color:var(--muted)}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin-top:10px}
.items button{padding:0;border:1px solid var(--line);background:var(--soft);cursor:pointer;aspect-ratio:1;position:relative;display:block;width:100%}
.items button img{display:block;width:100%;height:100%}
.items button.on{outline:3px solid var(--fg);outline-offset:-3px}
.items button .u{position:absolute;right:3px;top:2px;font-size:11px;font-weight:700;background:var(--fg);color:var(--bg);padding:0 4px;font-family:"Syne",system-ui,sans-serif}
.items button:hover{border-color:var(--fg)}
.price{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.price .syne{font-weight:800;font-size:22px;white-space:nowrap}
.row{display:flex;align-items:center;gap:22px;padding:0 34px;height:128px;border-bottom:1px solid var(--line);text-decoration:none}
.row:hover{background:var(--soft)}
.row.yours .n::after{content:" yours";font-size:14px;font-weight:400;color:var(--muted)}
.row img{width:92px;height:92px;display:block;flex-shrink:0;box-shadow:0 0 0 1px var(--line)}
.row .n{font-weight:700;font-size:23px}
.tag{display:inline-block;padding:1px 7px;border:1px solid var(--line);font-size:13px;color:var(--muted);margin-left:8px;vertical-align:middle}
.tag.rare{border-color:var(--fg);color:var(--fg)}
.tag.legendary{background:var(--fg);color:var(--bg);border-color:var(--fg)}
footer{padding:26px 34px;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;color:var(--muted);font-size:16px}
footer nav{display:flex;gap:20px;flex-wrap:wrap}
.prose{max-width:680px;padding:38px 34px;display:flex;flex-direction:column;gap:22px}
.prose h2{margin-top:22px}
.prose p{margin:0}
.prose code{font-family:ui-monospace,Menlo,monospace;font-size:.92em}
.prose pre{margin:0;padding:18px;background:var(--soft);overflow-x:auto;font-size:14px;line-height:1.5}
.single{padding:38px 34px;display:flex;flex-direction:column;gap:22px;max-width:760px}
.single .face{width:100%;max-width:512px;aspect-ratio:1;box-shadow:0 0 0 1px var(--line)}
.single .face svg{display:block;width:100%;height:100%}
.num{font-weight:800;font-size:62px;line-height:.95;letter-spacing:-.03em}
.nav{display:flex;gap:22px;flex-wrap:wrap}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:20px;flex-wrap:wrap}
.top nav{display:flex;gap:18px;flex-wrap:wrap;font-size:16px;color:var(--muted)}
.wide{padding:38px 34px;display:flex;flex-direction:column;gap:28px;max-width:1180px}
.wide p{margin:0}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.strip a,.strip div{text-decoration:none}
.strip img,.strip svg{width:100%;aspect-ratio:1;display:block;box-shadow:0 0 0 1px var(--line)}
.strip .cap{font-size:14px;color:var(--muted);margin-top:6px}
.strip .gone img{opacity:.35}
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
@media (max-width:1180px){.builder{grid-template-columns:1fr}.preview{max-width:460px}}
@media (max-width:900px){
 .page{grid-template-columns:1fr}
 aside{border-right:0;border-bottom:1px solid var(--line);padding:18px 20px}
 aside .stick{position:static;gap:18px}
 h1{font-size:40px}
 .builder{padding:20px;gap:16px}
 .preview{max-width:100%}
 .num{font-size:44px}
 .row{height:auto;min-height:64px;padding:14px 20px;gap:16px}
 .row img{width:56px;height:56px}
 footer,.prose,.single,.wide{padding:20px}
}
@media (prefers-reduced-motion:no-preference){.row{transition:background .15s}}
`;
}

const UMAMI_URL = process.env.UMAMI_URL ?? "";
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? "";
const ANALYTICS = UMAMI_URL && UMAMI_WEBSITE_ID ? `<script defer src="${UMAMI_URL}/script.js" data-website-id="${UMAMI_WEBSITE_ID}"></script>` : "";
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Newsreader:opsz,wght@6..72,400&display=swap">`;
const DESC = "One face a day per wallet, rolled on chain. Pin what you want, luck does the rest. 10,000 faces, then it stops.";

export function layout(title: string, p: Colors, body: string, image = "/today.png", path = "/"): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="${p.bg}">
<link rel="icon" href="/today.svg" type="image/svg+xml">
<link rel="canonical" href="https://${SITE}${path}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="https://${SITE}${image}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://${SITE}${path}">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${ANALYTICS}
<style>${css(p)}</style>
</head>
<body>${body}</body>
</html>`;
}

export function topBar(): string {
  return `<div class="top"><a class="mark syne" href="/">${SITE}</a><nav><a href="/rarity">Rarity</a><a href="/ones">1/1</a><a href="/assets">Assets</a><a href="/how">How it works</a></nav></div>`;
}

const COUNTDOWN = `<script>
(function(){var el=document.querySelector('[data-left]');if(!el)return;var s=+el.getAttribute('data-left');var t0=Date.now();function f(x){var h=Math.floor(x/3600),m=Math.floor(x%3600/60);return h?h+' h '+m+' min':m+' min'}setInterval(function(){var r=s-Math.floor((Date.now()-t0)/1000);if(r<0){location.reload();return}el.textContent=f(r)},15000)})();
</script>`;
const YOURS = `<script>
(function(){var eth=window.ethereum;if(!eth||!eth.request)return;eth.request({method:'eth_accounts'}).then(function(accs){if(!accs||!accs.length)return;var mine={};accs.forEach(function(a){mine[a.toLowerCase()]=1});var n=0;document.querySelectorAll('[data-owner]').forEach(function(el){if(mine[el.getAttribute('data-owner')]){el.classList.add('yours');n++}});var box=document.getElementById('yours');if(box&&n){box.hidden=false;box.querySelector('.syne').textContent=n}}).catch(function(){})})();
</script>`;

export function tierTag(tier: string): string {
  return tier === "common" ? "" : `<span class="tag ${tier}">${tier}</span>`;
}

/** The traits of a face as a definition list, with tiers. */
export function traitList(t: Traits): string {
  const rows = attributesOf(t).map((a) => `<dt>${esc(a.trait_type.toLowerCase())}</dt><dd>${esc(a.value)}${a.tier ? tierTag(a.tier) : ""}</dd>`);
  rows.push(`<dt>rarity</dt><dd>${rarityOf(t)}</dd>`);
  return `<dl class="traits">${rows.join("")}</dl>`;
}

/** The builder script: pins, price, preview, and the roll transaction. */
function builderScript(chain: ChainState | null): string {
  const cfg = JSON.stringify({
    address: chain?.address ?? null,
    chainHex: chain ? "0x" + chain.chainId.toString(16) : null,
    name: chain ? chainName(chain.chainId) : null,
    rpc: chain?.chainId === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org",
    explorer: chain ? explorer(chain.chainId) : "",
    selector: ROLL_SELECTOR,
    prices: PIN_PRICES_WEI.map((p) => p.toString()),
    keys: Array.from({ length: 8 }, (_, k) => PIN_KEYS[k] ?? null),
    maxPins: MAX_PINS,
  });
  return `<script>
(function(){
var CFG=${cfg};var pins={};var btn=document.getElementById('roll');var out=document.getElementById('msg');var prev=document.getElementById('preview');var price=document.getElementById('price');var keep=document.getElementById('keep');var clear=document.getElementById('clear');
function say(t){if(out)out.textContent=t}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function packed(){var v='';CFG.keys.forEach(function(s){var p=s?pins[s]:undefined;v+=(p===undefined?'ff':('0'+p.toString(16)).slice(-2))});return v}
function count(){return Object.keys(pins).length}
function fmt(wei){var n=Number(wei)/1e18;return n?n+' ETH':'free'}
function update(){
  document.querySelectorAll('.items button').forEach(function(b){b.classList.toggle('on',pins[b.dataset.slot]===+b.dataset.item)});
  prev.src='/preview.svg?p='+packed();
  var n=count();if(price)price.textContent=fmt(CFG.prices[n]);
  if(btn)btn.textContent=n?'Roll with '+n+(n===1?' pin':' pins'):'Roll for free';
  CFG.keys.forEach(function(s){if(!s)return;var dd=keep.querySelector('[data-keep="'+s+'"]');var b=document.querySelector('.items button.on[data-slot="'+s+'"]');dd.innerHTML=b?'<b>'+b.getAttribute('title')+'</b>':'<span class="luck">luck decides</span>'});
  if(clear)clear.hidden=!n;
}
document.querySelectorAll('.items button').forEach(function(b){b.addEventListener('click',function(){var s=b.dataset.slot,i=+b.dataset.item;if(pins[s]===i){delete pins[s]}else{if(pins[s]===undefined&&count()>=CFG.maxPins){say('Three pins at most. Luck keeps the rest.');return}pins[s]=i}say('');update()})});
if(clear)clear.addEventListener('click',function(){pins={};update()});
if(btn)btn.addEventListener('click',async function(){
  var eth=window.ethereum;
  if(!eth){say('You need a wallet in your browser, like Rabby, MetaMask or Coinbase Wallet.');return}
  btn.disabled=true;
  try{
    var accs=await eth.request({method:'eth_requestAccounts'});var from=accs[0];
    try{await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:CFG.chainHex}]})}
    catch(e){if(e&&e.code===4902){await eth.request({method:'wallet_addEthereumChain',params:[{chainId:CFG.chainHex,chainName:CFG.name,rpcUrls:[CFG.rpc],nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},blockExplorerUrls:[CFG.explorer]}]})}else{throw e}}
    var can=await fetch('/api/can-roll/'+from).then(function(r){return r.json()});
    if(!can.canRoll){say('This wallet rolled today already. Midnight UTC resets it.');btn.disabled=false;return}
    var n=count();var wei=BigInt(CFG.prices[n]);
    say(n?'Confirm in your wallet: '+fmt(wei)+' plus gas.':'Confirm in your wallet. You pay gas, nothing else.');
    var data=CFG.selector+packed().padStart(64,'0');
    var tx={from:from,to:CFG.address,data:data};if(wei>0n)tx.value='0x'+wei.toString(16);
    var hash=await eth.request({method:'eth_sendTransaction',params:[tx]});
    say('Sent. Waiting for the network.');
    for(var i=0;i<90;i++){await sleep(2000);var r=await eth.request({method:'eth_getTransactionReceipt',params:[hash]});
      if(r){if(r.status==='0x1'){var log=(r.logs||[]).filter(function(l){return l.topics&&l.topics.length>2&&l.address.toLowerCase()===CFG.address.toLowerCase()})[0];var id=log?parseInt(log.topics[1],16):0;say('Rolled. Face #'+id+' is yours.');await sleep(1200);location.href=id?'/face/'+id:'/'}else{say('The network rejected it.');btn.disabled=false}return}}
    say('Still waiting. Refresh the page in a moment.');
  }catch(e){say(e&&e.code===4001?'Cancelled in the wallet.':'Failed: '+((e&&e.message)||e));btn.disabled=false}
});
update();
})();
</script>`;
}

function galleries(): string {
  return PINNABLE.map((k) => {
    const s = SLOTS[k];
    const items = s.items.map((it, i) => pinOk(k, i) ? `<button type="button" data-slot="${s.slot}" data-item="${i}" title="${esc(it.name)}"><img src="/item/${s.slot}/${i}.svg" alt="${esc(it.name)}" width="72" height="72" loading="lazy">${it.tier === "uncommon" ? `<span class="u">u</span>` : ""}</button>` : "").join("");
    const rareCount = s.items.filter((it) => it.tier === "rare" || it.tier === "legendary").length;
    return `<div class="gallery"><h3 class="syne">${esc(s.trait)}<span>${s.items.filter((it, i) => pinOk(k, i)).length} to pin, ${rareCount} only by luck</span></h3><div class="items px">${items}</div></div>`;
  }).join("") + skinGallery();
}
function skinGallery(): string {
  const items = SKINS.map((sk, i) => skinPinOk(i) ? `<button type="button" data-slot="skin" data-item="${i}" title="${esc(sk.name)}"><img src="/skin/${i}.svg" alt="${esc(sk.name)}" width="72" height="72" loading="lazy">${sk.tier === "uncommon" ? `<span class="u">u</span>` : ""}</button>` : "").join("");
  const rare = SKINS.filter((sk) => sk.tier === "rare" || sk.tier === "legendary").length;
  return `<div class="gallery"><h3 class="syne">Skin<span>${SKINS.filter((_, i) => skinPinOk(i)).length} to pin, ${rare} only by luck</span></h3><div class="items px">${items}</div></div>`;
}

export function homePage(chain: ChainState | null, epoch: number, names: Names = NO_NAMES): string {
  const t = pageTraits(chain, epoch);
  const p = groundOf(t);
  const total = chain?.totalSupply ?? 0;
  const rows: string[] = [];
  if (chain) {
    for (let id = total; id >= Math.max(1, total - 40); id--) {
      const f = chain.faces.get(id);
      if (!f) continue;
      const ft = traitsOfRecord(f);
      const owner = chain.owners.get(id);
      const who = owner ? (isAuthor(chain, owner) ? "the treasury's daily roll" : `rolled by ${label(owner, names)}`) : "";
      const pinsN = Object.keys(unpackPins(f.pins)).length;
      const r = rarityOf(ft);
      rows.push(`<a class="row" href="/face/${id}"${owner ? ` data-owner="${owner.toLowerCase()}"` : ""}><img class="px" src="/face/${id}.svg" alt="" loading="lazy" width="92" height="92"><span><span class="n syne">#${id}</span>${tierTag(r)}<br><span class="small">${who}${pinsN ? `, ${pinsN} ${plural(pinsN, "pin", "pins")}` : ""}${f.one !== 255 ? ", one of one" : ""}</span></span></a>`);
    }
  }
  const badge = chain && chain.chainId !== 8453 ? ` <span class="testnet">${chainName(chain.chainId)} testnet</span>` : "";
  const left = chain ? chain.secondsLeft : 86400 - (Math.floor(Date.now() / 1000) % 86400);
  const keep = `<dl class="keep" id="keep">${PINNABLE.map((k) => `<dt>${esc(SLOTS[k].trait.toLowerCase())}</dt><dd data-keep="${SLOTS[k].slot}"><span class="luck">luck decides</span></dd>`).join("")}<dt>skin</dt><dd data-keep="skin"><span class="luck">luck decides</span></dd>${SLOTS.filter((s) => !s.pinnable).map((s) => `<dt>${esc(s.trait.toLowerCase())}</dt><dd><span class="luck">luck, always</span></dd>`).join("")}<dt>other colours</dt><dd><span class="luck">luck, always</span></dd></dl>`;
  const cta = chain
    ? `<div class="price"><span class="small">Today's roll</span><span class="syne" id="price">free</span></div>
<button class="cta syne" id="roll">Roll for free</button>
<p class="msg" id="msg" aria-live="polite"></p>
<button class="cta ghost syne" id="clear" hidden>Clear pins</button>
<p class="small">One roll per wallet a day. Pins cost 0.0005, 0.0015 or 0.004 ETH for one, two or three. ${fmtLeft(left)} to midnight UTC.${badge}</p>`
    : `<div class="price"><span class="small">Today's roll</span><span class="syne" id="price">free</span></div><a class="cta ghost syne" href="/how">How it works</a><button class="cta ghost syne" id="clear" hidden>Clear pins</button><p class="small">Rolling opens with the contract.</p>`;
  const body = `<div class="page">
<aside><div class="stick">
<a class="mark syne" href="/">${SITE}</a>
<h1 class="syne">One face<br>a day,<br>yours to pin</h1>
<p class="lead">Every wallet rolls one face a day, free. Pin a background, a top, eyes, hair or a skin tone and pay a little; the rest is luck. Rare things cannot be bought. A roll without pins can land on a one of one.</p>
<hr>
<div style="display:flex;gap:34px"><div><div class="big syne">${num(total)}</div><div class="small">of ${num(MAX_SUPPLY)} rolled</div></div>${chain ? `<div><div class="syne" style="font-weight:700;font-size:26px;line-height:1">${chain.poolLeft}</div><div class="small">1/1 left</div></div><div id="yours" hidden><div class="syne" style="font-weight:700;font-size:26px;line-height:1">0</div><div class="small">yours</div></div>` : ""}</div>
<div style="display:flex;flex-direction:column;gap:12px">${cta}</div>
<nav class="nav small"><a href="/rarity">Rarity</a><a href="/ones">1/1</a><a href="/assets">Assets</a><a href="/how">How it works</a></nav>
</div></aside>
<main>
<section class="builder">
<div><div class="preview px"><img id="preview" src="/preview.svg?p=ffffffffffffffff" alt="Your pins on a grey stand-in; grey parts are luck's" width="512" height="512"></div>
<p class="small" style="margin-top:12px">Grey is what luck decides. Colour is what you pin. Head, mouth, accessory and the other colours are always luck.</p>
${keep}</div>
<div class="galleries">${galleries()}</div>
</section>
${rows.length ? rows.join("\n") : chain ? `<p class="lead" style="padding:34px">Nobody has rolled yet. The first face is yours to make.</p>` : ""}
<footer><span>This is not an investment and never will be. Everything is CC0. One of the collections at <a href="https://${PARENT}">${PARENT}</a>.</span><nav><a href="/rarity">Rarity</a><a href="/ones">1/1</a><a href="/assets">Assets</a>${chain ? `<a href="${openseaCollection(chain)}">OpenSea</a><a href="${explorer(chain.chainId)}/address/${chain.address}">Basescan</a>` : ""}<a href="${REPO}">Code</a></nav></footer>
</main>
</div>
${builderScript(chain)}
${chain ? YOURS : ""}
${COUNTDOWN}`;
  return layout(`${SITE}`, p, body, "/today.png", "/");
}

export function facePage(id: number, f: FaceRecord, chain: ChainState, names: Names = NO_NAMES): string {
  const t = traitsOfRecord(f);
  const p = groundOf(t);
  const owner = chain.owners.get(id);
  const roll = chain.rolls.get(id);
  const pins = unpackPins(f.pins);
  const pinsN = Object.keys(pins).length;
  const who = owner ? (isAuthor(chain, owner) ? "the treasury's daily roll" : `held by <a href="/${label(owner, names)}">${label(owner, names)}</a>`) : "";
  const url = `https://${SITE}/face/${id}`;
  const text = encodeURIComponent(`Face #${id} of ${SITE}`);
  const snippet = esc(`<a href="${url}"><img src="https://${SITE}/face/${id}.svg" width="256" height="256" alt="Face #${id} of faces.onenft.click" style="image-rendering:pixelated"></a>`);
  const body = `<main class="single">
${topBar()}
<div class="face px">${stripSize(svgOf(t))}</div>
<div><div class="num syne">#${id}</div><p class="lead">${who}${pinsN ? `, ${pinsN} ${plural(pinsN, "pin", "pins")} (${Object.keys(pins).join(", ")})` : ", no pins"}${f.one !== 255 ? ", one of one" : ""}</p></div>
${roll ? `<p class="small">Rolled ${dateOf(Math.floor(roll.at / 86400))}${roll.paid ? `, paid ${eth(roll.paid)}` : ""}, <a href="${explorer(chain.chainId)}/tx/${roll.tx}">transaction</a>.</p>` : ""}
${traitList(t)}
<p class="small" style="line-height:1.7">Seed ${f.seed.toString()}. Token ${id} of <a href="${explorer(chain.chainId)}/address/${chain.address}">${shortAddr(chain.address)}</a> on ${chainName(chain.chainId)}. The image lives in the contract.</p>
<nav class="nav">${id > 1 ? `<a href="/face/${id - 1}">previous</a>` : ""}${id < chain.totalSupply ? `<a href="/face/${id + 1}">next</a>` : ""}<a href="/">roll yours</a></nav>
<nav class="nav small"><a href="${opensea(chain, id)}">OpenSea</a><a href="${explorer(chain.chainId)}/nft/${chain.address}/${id}">Basescan</a><a href="/face/${id}.svg" download="face-${id}.svg">SVG</a><a href="/face/${id}.png">PNG</a><a href="/api/face/${id}">JSON</a></nav>
<nav class="share"><a href="https://warpcast.com/~/compose?text=${text}&embeds[]=${encodeURIComponent(url)}">Share on Farcaster</a><a href="https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}">Share on X</a></nav>
<details><summary class="small">Put this face on your page</summary><pre class="snip">${snippet}</pre><p class="small">CC0. No credit needed.</p></details>
</main>`;
  return layout(`Face #${id} | ${SITE}`, p, body, `/face/${id}.png`, `/face/${id}`);
}

export function howPage(chain: ChainState | null, epoch: number): string {
  const p = groundOf(pageTraits(chain, epoch));
  const body = `<main class="prose">
${topBar()}
<h2 class="syne">One roll a day, and what you may pin</h2>
<p><strong>The roll.</strong> Every wallet may call <code>roll</code> once per UTC day. The contract mixes the block's randomness, your address and the token number into a 64-bit seed, and the seed decides everything: seven layers, five colours, and whether this roll takes a one of one. A free roll costs gas and nothing else.</p>
<p><strong>The pins.</strong> Five things can be pinned: background, top, eyes, hair or hat, and skin tone. You may pin up to three of them, to any common or uncommon item; the pinnable skins are the human tones. One pin costs 0.0005 ETH, two cost 0.0015, three cost 0.004. The fee goes to the author. Rare and legendary items cannot be pinned; they come from luck or not at all. A roll with pins never lands on a one of one.</p>
<p><strong>The layers.</strong> ${SLOTS.map((s) => `${s.items.length} ${s.trait.toLowerCase()}`).join(", ")}. Every item has a tier: common, uncommon, rare, legendary. The weight tables live in the contract; <a href="/rarity">the rarity page</a> lists each item's odds per roll. Skin, hair colour, top colour, ground and accent colour are drawn on top of that. ${num(combinations())} combinations before the one of ones.</p>
<p><strong>The one of ones.</strong> ${ONE_OF_ONES.length} full drawings sit in a pool. A roll without pins takes one with odds of pool left over tokens left: about 1 in ${Math.round(10000 / ONE_OF_ONES.length)} on the first roll, better as the end nears, so on average the whole pool is rolled by the last token. The contract removes a rolled one from the pool; each exists once. <a href="/ones">See what is left.</a></p>
<p><strong>The treasury.</strong> The author's wallet gets one free roll a day too, with the same luck as everyone. Anyone may trigger it; the site does, at midnight UTC.</p>
<p><strong>The image.</strong> A sprite is 32 by 32 pixels of roles, not colours: outline, fill, shade, light, a second fill, white. The token's palette turns roles into colours, so one hair sprite serves every hair colour. Layers composite bottom to top, a rim light lands where a fill sits right of an outline, and the result is one SVG of rects returned as a <code>data:</code> URI by the contract, with no server in between.</p>
<p><strong>The end.</strong> Supply stops at 10,000. The image rules can change for faces not yet rolled until the author locks them; a rolled face keeps its renderer forever.</p>
<h2 class="syne">Build it yourself</h2>
<p>The generator is in <a href="${REPO}">the repository</a>, in TypeScript and in Solidity, with a test that keeps the two byte for byte equal. The draw:</p>
<pre><code>u64 mix(u64 x):
  x += 0x9e3779b97f4a7c15
  x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9
  x = (x ^ (x >> 27)) * 0x94d049bb133111eb
  return x ^ (x >> 31)

seed = keccak(prevrandao, wallet, tokenId, block) as u64
draw(i) = mix(seed + i) mod 10000
for slot in 0..6: item[slot] = walk(WEIGHTS[slot], draw(slot)), or the pin
skin = walk(SKIN_WEIGHTS, draw(7)), or the pin; hair, top, ground, accent = draw(8..11) mod count
lucky = no pins and draw(12) < pool size * 10000 / tokens left; one = pool[draw(13) mod pool size]</code></pre>
<p>Everything here is CC0. If you build on it, write to me.</p>
<p class="small"><a href="/">Back to the roll</a>. Every collection: <a href="https://${PARENT}">${PARENT}</a>.</p>
</main>`;
  return layout(`How it works | ${SITE}`, p, body, "/today.png", "/how");
}

export function notFound(chain: ChainState | null, epoch: number): string {
  const p = groundOf(pageTraits(chain, epoch));
  return layout(`Not here | ${SITE}`, p, `<main class="single">${topBar()}<h2 class="syne">No such face</h2><p class="lead">${chain ? `Faces run from 1 to ${chain.totalSupply}.` : "Nothing has been rolled yet."}</p><a href="/">Back to the roll</a></main>`);
}
