/**
 * PNG cards for link previews. 1200×630: the face on the left, the number and
 * site on the right, colours from the face's ground. Faces never change, so
 * cards are rasterized once and kept in memory.
 */
import { Resvg } from "@resvg/resvg-js";
import { svgOf, rarityOf, groundOf, attributesOf, type Traits } from "./faces.ts";

const fontDir = new URL("../assets/fonts/", import.meta.url).pathname;
const FONTS = [fontDir + "Syne-ExtraBold.ttf", fontDir + "Newsreader.ttf"];
const cache = new Map<string, Uint8Array>();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function cardSvg(title: string, sub: string, t: Traits): string {
  const face = svgOf(t, 570);
  const inner = face.replace(/^<svg [^>]*>/, "").replace(/<\/svg>$/, "");
  const p = groundOf(t);
  const line = attributesOf(t).slice(0, 4).map((a) => a.value).join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${p.bg}"/>
<svg x="30" y="30" width="570" height="570" viewBox="0 0 32 32" shape-rendering="crispEdges">${inner}</svg>
<rect x="30" y="30" width="570" height="570" fill="none" stroke="${p.muted}" stroke-width="2"/>
<text x="662" y="150" font-family="Newsreader" font-size="40" fill="${p.muted}">${esc(sub)}</text>
<text x="654" y="290" font-family="Syne" font-weight="800" font-size="${title.length > 6 ? 110 : 150}" fill="${p.fg}">${esc(title)}</text>
<text x="662" y="360" font-family="Newsreader" font-size="34" fill="${p.fg}">${esc(rarityOf(t))}</text>
<text x="662" y="412" font-family="Newsreader" font-size="28" fill="${p.muted}">${esc(line)}</text>
<text x="662" y="560" font-family="Syne" font-weight="800" font-size="44" fill="${p.fg}">faces.onenft.click</text>
</svg>`;
}

export function cardPng(key: string, title: string, sub: string, t: Traits, keep: boolean): Uint8Array {
  const hit = cache.get(key);
  if (hit) return hit;
  const png = new Resvg(cardSvg(title, sub, t), { fitTo: { mode: "width", value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Newsreader" } }).render().asPng();
  if (keep) cache.set(key, png);
  return png;
}

/** The face itself as a square PNG, for the download links that work without JavaScript. Pixel art, so no smoothing. */
export const SQUARE_PX = 1024;
const squares = new Map<number, Uint8Array>();
export function squarePng(id: number, t: Traits): Uint8Array {
  const hit = squares.get(id);
  if (hit) return hit;
  const png = new Resvg(svgOf(t), { fitTo: { mode: "width", value: SQUARE_PX }, imageRendering: 1 }).render().asPng();
  squares.set(id, png);
  return png;
}
