/** Review sheets: many random faces, and combinations that are likely to collide. */
import { Resvg } from "@resvg/resvg-js";
import { SLOTS } from "../src/sprites.ts";
import { face, svgOf, traitsOf, BASE_TRAITS, type Traits } from "../src/faces.ts";

const idx = (slot: string, name: string) => { const k = SLOTS.findIndex((s) => s.slot === slot); const i = SLOTS[k].items.findIndex((it) => it.name === name); if (i < 0) throw new Error(`${slot}/${name}`); return [k, i] as const; };
function build(spec: Record<string, string>, colours: Partial<Traits> = {}): Traits {
  const t: Traits = { ...BASE_TRAITS, items: BASE_TRAITS.items.slice(), ...colours };
  for (const [slot, name] of Object.entries(spec)) { const [k, i] = idx(slot, name); t.items[k] = i; }
  return t;
}
function sheet(title: string, tiles: { svg: string; label: string }[], cols: number, tw: number): string {
  const pad = 14, lh = 26, rows = Math.ceil(tiles.length / cols);
  const W = cols * (tw + pad) + pad, H = 40 + rows * (tw + lh + pad);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f1eee6"/><text x="${pad}" y="26" font-family="Helvetica, Arial" font-weight="bold" font-size="16" fill="#1c1a19">${title}</text>`;
  tiles.forEach((t, i) => { const x = pad + (i % cols) * (tw + pad), y = 40 + Math.floor(i / cols) * (tw + lh + pad); out += `<svg x="${x}" y="${y}" width="${tw}" height="${tw}" viewBox="0 0 32 32" shape-rendering="crispEdges">${t.svg.replace(/<svg[^>]*>/, "").replace("</svg>", "")}</svg><text x="${x}" y="${y + tw + 14}" font-family="Helvetica, Arial" font-size="10" fill="#1c1a19">${t.label.slice(0, 30)}</text>`; });
  return out + "</svg>";
}
const png = (svg: string, name: string) => Bun.write(new URL(`../out/${name}`, import.meta.url), new Resvg(svg).render().asPng());
const start = Number(process.argv[2] ?? 1000);
const random = Array.from({ length: 96 }, (_, i) => { const f = face(BigInt(start + i)); return { svg: f.svg, label: f.attributes.filter((a) => a.tier && a.tier !== "common").map((a) => a.value).join(", ") || String(start + i) }; });
await png(sheet(`96 random faces, seeds ${start} to ${start + 95}`, random, 12, 120), "random.png");
const combos: [string, Record<string, string>, Partial<Traits>?][] = [
  ["mask + joint", { accessory: "Mask", mouth: "Joint" }], ["mask + beard", { accessory: "Mask", mouth: "Beard" }], ["headphones + top hat", { accessory: "Headphones", hair: "Top hat" }],
  ["headphones + afro", { accessory: "Headphones", hair: "Afro" }], ["beard + scarf", { mouth: "Beard", top: "Scarf" }], ["beard + turtleneck", { mouth: "Beard", top: "Turtleneck" }],
  ["monocle + glasses", { accessory: "Monocle", eyes: "Glasses" }], ["eyepatch + shades", { accessory: "Eyepatch", eyes: "Shades" }], ["eyepatch + visor", { accessory: "Eyepatch", eyes: "Visor" }],
  ["halo + crown", { hair: "Crown" }], ["horns + cap", { hair: "Cap", accessory: "Halo dot" }], ["helmet + headphones", { hair: "Helmet", accessory: "Headphones" }],
  ["tall + long hair", { head: "Tall", hair: "Long" }], ["tall + cap", { head: "Tall", hair: "Cap" }], ["block + bob", { head: "Block", hair: "Bob" }],
  ["block + shades + beard", { head: "Block", eyes: "Shades", mouth: "Beard" }], ["wide + pigtails", { head: "Wide", hair: "Pigtails" }], ["narrow + afro + hoops", { head: "Narrow", hair: "Afro", accessory: "Hoops" }],
  ["chin + mustache", { head: "Chin", mouth: "Mustache" }], ["egg + cyclops", { head: "Egg", eyes: "Cyclops" }], ["laser + glasses", { eyes: "Laser" }],
  ["face paint + glasses", { accessory: "Face paint", eyes: "Glasses" }], ["third eye + bandana", { accessory: "Third eye", hair: "Bandana" }], ["third eye + wizard", { accessory: "Third eye", hair: "Wizard" }],
  ["bow tie + suit", { accessory: "Bow tie", top: "Suit" }], ["bow tie + tank", { accessory: "Bow tie", top: "Tank" }], ["chain + collar", { accessory: "Chain", top: "Collar" }],
  ["pearls + robe", { accessory: "Pearls", top: "Robe" }], ["choker + turtleneck", { accessory: "Choker", top: "Turtleneck" }], ["choker + scarf", { accessory: "Choker", top: "Scarf" }],
  ["gum + mustache?", { mouth: "Gum" }], ["pipe + beard", { mouth: "Pipe" }], ["lollipop + mask", { mouth: "Lollipop", accessory: "Mask" }],
  ["whistle + freckles", { mouth: "Whistle", accessory: "Freckles" }], ["bindi + headband", { accessory: "Bindi", hair: "Headband" }], ["piercing + shades", { accessory: "Piercing", eyes: "Shades" }],
  ["night + storm bg on dark skin", { background: "Night", hair: "Bald" }, { skin: 6 }], ["sticker + tear", { accessory: "Sticker" }], ["bandaid + blush", { accessory: "Bandaid" }],
  ["halo dot + hoops", { accessory: "Halo dot" }], ["cowboy + mustache", { hair: "Cowboy", mouth: "Mustache" }], ["bucket + shades", { hair: "Bucket", eyes: "Shades" }],
  ["beret + glasses", { hair: "Beret", eyes: "Glasses" }], ["ponytail + headphones", { hair: "Ponytail", accessory: "Headphones" }], ["spiky + horns", { hair: "Horns" }],
  ["curly + crown", { hair: "Curly" }], ["long + scarf", { hair: "Long", top: "Scarf" }], ["long + hoodie", { hair: "Long", top: "Hoodie" }],
];
const tiles = combos.map(([label, spec, col]) => ({ svg: svgOf(build(spec, col)), label }));
await png(sheet("Combinations likely to collide", tiles, 12, 120), "combos.png");
console.log("ok");
