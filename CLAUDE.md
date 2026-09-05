# faces.onenft.click

One face a day per wallet, rolled on chain. A collection of onenft.click, built from `~/Programowanie/onenft-chainrun` on 2026-09-05. Contract on Base (Sepolia first). Operational identifiers that should not be public live in `CLAUDE.local.md` (gitignored).

## What this is

- Every wallet may roll once per UTC day, free (gas only), as **commit then reveal**: `commit(pins)` spends the day and the fee, `reveal(wallet)` one block later mixes `blockhash(commitBlock + 1)` with the wallet, pins, commit block and token id into a 64-bit seed. Anyone may reveal for anyone; the site's keeper (`src/autoclaim.ts`, deployer key) does, so the roller signs once. Supply stops at 10,000 counting pending commits. The author's wallet gets one free roll a day too (`commitForTreasury`, anyone may call; the keeper does).
- A roll may pin any of twelve things: the seven layers and five colours (skin, hair, ground, top, accent). Layer pins go to common or uncommon items only (skins: the human tones); colour pins are free of tiers. The price doubles with every pin, 0.0005 ETH for one up to 1.024 for all twelve; 95 percent goes to the author and 5 percent to the keeper (deployer) wallet at commit. Rare and legendary items come only from luck.
- Any roll may take a one of one from the pool with odds `poolLeft / tokensLeft`, so on average the pool empties with the supply. Each 1/1 exists once. Cato's audit (2026-09-05) is why rolls are two-step: a one-step roll could be tried, inspected and reverted for free.
- Sprites are 32x32 maps of roles (outline, fill, shade, light, second fill, white), three bits per pixel, 384 bytes each, in `DataStore` contracts. The token's palette turns roles into colours, so one hair sprite serves every hair colour. Weights, tiers, palettes and names sit in a meta blob (`contracts/fixtures.ts` documents the layout).
- `src/faces.ts` and `contracts/src/FaceRenderer.sol` produce the same SVG and JSON byte for byte; a Foundry test enforces it against fixtures from TS. **TypeScript is the source of truth.** Sprites are drawn in `src/sprites.ts` with the DSL in `src/pixels.ts`.
- The site has no palette of its own: it wears the ground of the newest face, or of the face of the day before anyone has rolled. No light/dark toggle. Everything is CC0.

## Stack and commands

- Bun + TypeScript for the site (`src/`), Foundry for contracts (`contracts/`), OpenZeppelin 5.x via submodule. Never npm/npx, never Python for project code.
- `bun test` · `bun run contracts/fixtures.ts` (regenerates the data blobs and the cases; run after any change to `src/sprites.ts` or `src/faces.ts`) · `cd contracts && forge test` (needs `via_ir`) · `bun run scripts/sheet.ts [slots|faces|ones]` renders review sheets into `out/`.
- `PORT=3000 bun run src/server.ts`. With `CONTRACT_ADDRESS` + `CHAIN_ID` it reads chain state and shows the roll button; without them the builder works and rolling is off.
- `contracts/deploy.sh sepolia|mainnet` deploys stores + renderer + token and writes `~/.config/onenft-faces/deploy-<net>.json`. `contracts/check.sh <net>` compares on-chain bytes and three SVGs with TS. `contracts/wire.sh <net>` writes the addresses into the hosting env and redeploys. `scripts/status.sh` prints state.
- Deploy of the site = `git push origin master` then trigger the hosting redeploy (see `CLAUDE.local.md`).

## Rules that bite

- **Do not change `src/sprites.ts` or `src/faces.ts` output casually.** Rolled faces are drawn by the on-chain renderer pinned per token. A change means a new renderer (new stores, new meta) and `setRenderer` from the author wallet; it affects future rolls only. The 1/1 pool is fixed in the token contract at deploy; more 1/1s need a new token contract.
- **Pins are a uint128**, one byte per key high byte first: background, top, head, eyes, mouth, accessory, hair, skin, hair colour, ground, top colour, accent, four spare bytes; 0xff is no pin. `PIN_KEYS` in `src/faces.ts` is the order; the renderer and the site follow it.
- **All copy in English**, plain words, active voice, no adverbs, no em dashes. Same anti-slop design rules as the sisters.
- Public repo: never commit keys or hosting tokens. Pin fees are revenue; see the tax note in the plan before mainnet.

## Frontend Theme

Inherited from onenft.click: Syne 700/800 for display and numbers, Newsreader 400 for text; no border radius, 1px hairlines in `--line`, solid CTA in `--fg` on `--bg`; sidebar 360px sticky; pixel art with `image-rendering: pixelated`; no motion beyond a 150 ms row hover. `--bg` is the newest face's ground, `--fg` near-black or near-white by luma.

## Where things are

| Thing | Path |
|---|---|
| Sprites, tiers, slots, 1/1s | `src/sprites.ts` |
| Canvas DSL, 3-bit codec | `src/pixels.ts` |
| Generator (source of truth) | `src/faces.ts` |
| Page HTML, CSS, builder, copy | `src/site.ts` |
| Inner pages: rarity, 1/1, holders, assets | `src/pages.ts` |
| JSON API, spec | `src/api.ts` |
| Server, routes | `src/server.ts` |
| Chain reads (viem, multicall), roll log | `src/contract.ts` |
| Treasury daily roll loop | `src/autoclaim.ts` |
| PNG cards | `src/image.ts` |
| Review sheets | `scripts/sheet.ts` |
| Contracts, tests, deploy | `contracts/` |
