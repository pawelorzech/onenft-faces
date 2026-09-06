/**
 * What the chain says about one wallet's faces, as tiles: a figure and a line
 * under it. Every fact is a count or an id read from ownership, rolls and the
 * face records; none of them is worth anything, and there is nothing to
 * unlock. A wallet with no faces has no facts.
 */
import { rarityOf, unpackPins } from "./faces.ts";
import { traitsOfRecord } from "./site.ts";
import type { ChainState } from "./contract.ts";
import type { Address } from "viem";

export type Fact = {
  kind: string;
  /** The big figure of the tile, e.g. "3 of 12". */
  figure: string;
  /** The line under the figure. */
  label: string;
  /** The same fact as one plain sentence, for JSON and screen readers. */
  text: string;
  /** The faces the fact points at, ascending. */
  ids: number[];
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function list(ids: number[], max = 3): string {
  return `#${ids.slice(0, max).join(", #")}${ids.length > max ? " and more" : ""}`;
}

export function holderFacts(who: Address, chain: ChainState): Fact[] {
  const me = who.toLowerCase();
  const mine = [...chain.owners].filter(([, o]) => o.toLowerCase() === me).map(([id]) => id).sort((a, b) => a - b);
  if (!mine.length) return [];
  const facts: Fact[] = [];

  if (mine.includes(1)) facts.push({ kind: "first", figure: "#1", label: "the first face rolled", text: "Holds face #1, the first face rolled.", ids: [1] });

  // Rolled here or from earlier holders. Only faces the log scan has reached count.
  const known = mine.filter((id) => chain.rolls.has(id));
  const rolled = known.filter((id) => chain.rolls.get(id)!.to.toLowerCase() === me);
  const later = known.filter((id) => chain.rolls.get(id)!.to.toLowerCase() !== me);
  if (rolled.length) facts.push({ kind: "rolled", figure: String(rolled.length), label: "rolled by this wallet", text: `Rolled ${rolled.length} ${plural(rolled.length, "face", "faces")}.`, ids: rolled });
  if (later.length) facts.push({ kind: "later", figure: String(later.length), label: "from earlier holders", text: `Took ${later.length} ${plural(later.length, "face", "faces")} from earlier holders.`, ids: later });

  // Days in a row with a roll by this wallet.
  const days = [...new Set(rolled.map((id) => Math.floor(chain.rolls.get(id)!.at / 86400)))].sort((a, b) => a - b);
  if (days.length >= 2) {
    let best = 1, cur = 1;
    for (let i = 1; i < days.length; i++) {
      cur = days[i] === days[i - 1] + 1 ? cur + 1 : 1;
      if (cur > best) best = cur;
    }
    if (best >= 2) facts.push({ kind: "streak", figure: String(best), label: "days in a row rolled, the longest streak", text: `Rolled ${best} days in a row, the longest streak.`, ids: rolled });
  }

  const traits = mine.map((id) => [id, traitsOfRecord(chain.faces.get(id)!)] as const);
  const ones = traits.filter(([, t]) => t.one !== undefined).map(([id]) => id);
  if (ones.length) facts.push({ kind: "ones", figure: String(ones.length), label: `one of one, ${list(ones)}`, text: `${ones.length} one of one: ${list(ones, 99)}.`, ids: ones });
  const rare = traits.filter(([, t]) => { const r = rarityOf(t); return r === "rare" || r === "legendary"; }).map(([id]) => id);
  if (rare.length) facts.push({ kind: "rare", figure: String(rare.length), label: `rare or legendary, ${list(rare)}`, text: `${rare.length} rare or legendary: ${list(rare, 99)}.`, ids: rare });

  // Luck alone: faces rolled with no pins at all.
  const luck = mine.filter((id) => Object.keys(unpackPins(chain.faces.get(id)!.pins)).length === 0);
  if (luck.length && mine.length >= 2) facts.push({ kind: "luck", figure: `${luck.length} of ${mine.length}`, label: "rolled with no pins, luck alone", text: `${luck.length} of ${mine.length} rolled with no pins, luck alone.`, ids: luck });

  return facts;
}
