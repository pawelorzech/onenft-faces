/** Contact sheets for review: one per slot (every item on a neutral face) and a grid of random faces. */
import { Resvg } from "@resvg/resvg-js";
import { SLOTS } from "../src/sprites.ts";
import { face, svgOf, traitsOf, combinations, type Traits } from "../src/faces.ts";

const BASE: Traits = { items: SLOTS.map((s) => (s.slot === "accessory" ? 0 : s.slot === "hair" ? 0 : s.slot === "background" ? 0 : 0)), skin: 1, hair: 1, top: 3, ground: 10, accent: 0 };
function sheet(title: string, tiles: { svg: string; label: string }[], cols: number, tw: number): string {
  const pad = 16, lh = 30, rows = Math.ceil(tiles.length / cols);
  const W = cols * (tw + pad) + pad, H = 44 + rows * (tw + lh + pad);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f1eee6"/><text x="${pad}" y="28" font-family="Helvetica, Arial" font-weight="bold" font-size="18" fill="#1c1a19">${title}</text>`;
  tiles.forEach((t, i) => {
    const x = pad + (i % cols) * (tw + pad), y = 44 + Math.floor(i / cols) * (tw + lh + pad);
    out += `<svg x="${x}" y="${y}" width="${tw}" height="${tw}" viewBox="0 0 32 32" shape-rendering="crispEdges">${t.svg.replace(/<svg[^>]*>/, "").replace("</svg>", "")}</svg>`;
    out += `<text x="${x}" y="${y + tw + 16}" font-family="Helvetica, Arial" font-size="11" fill="#1c1a19">${t.label}</text>`;
  });
  return out + "</svg>";
}
const png = (svg: string, name: string) => Bun.write(new URL(`../out/${name}`, import.meta.url), new Resvg(svg).render().asPng());
const which = process.argv[2] ?? "all";
if (which === "all" || which === "slots") for (const [k, s] of SLOTS.entries()) {
  const tiles = s.items.map((it, i) => { const t = { ...BASE, items: BASE.items.slice() }; t.items[k] = i; return { svg: svgOf(t), label: `${it.name} (${it.tier[0]})` }; });
  await png(sheet(`${s.trait}: ${s.items.length} items${s.pinnable ? ", pinnable" : ""}`, tiles, 8, 128), `slot-${s.slot}.png`);
}
if (which === "all" || which === "faces") {
  const n = Number(process.argv[3] ?? 48);
  const tiles = Array.from({ length: n }, (_, i) => { const f = face(BigInt(i + 1)); return { svg: f.svg, label: f.attributes.filter((a) => a.tier && a.tier !== "common").map((a) => `${a.value} (${a.tier![0]})`).join(", ").slice(0, 26) || "all common" }; });
  await png(sheet(`Random faces, seeds 1 to ${n}. ${combinations().toLocaleString()} combinations.`, tiles, 8, 128), "faces.png");
}
console.log("ok", which);
