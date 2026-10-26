# faces.onenft.click

Last verified: 1d5950e | 2026-10-26

One face a day per wallet, rolled on chain. Built from `~/Programowanie/onenft/chainrun` on 2026-09-05. Live at https://faces.onenft.click, contract `0x7C745F4eA367A7A3CD596219A4E428F2eA9A8C4c` on Base mainnet (second contract, 2026-09-06; the first, `0x37747e1c6221848807B2fA060dbf4Be798361752`, holds two faces and is retired; see `docs/DEPLOYMENTS.md`). Shared rules (stack, deploy, copy, design, secrets, TS = source of truth): `../CLAUDE.md`. Operational identifiers: `CLAUDE.local.md` (gitignored).

## What this is

- Every wallet may roll once per UTC day, free (gas only), as **commit then reveal**: `commit(pins)` spends the day and the fee, `reveal(wallet)` from two blocks later (and within 256) mixes `blockhash(commitBlock + 1)` with the wallet, pins and commit block into a 64-bit seed; past the window anyone may `renew` the commit. The first contract had weaker rules, see `docs/REVEAL_WINDOW.md`. Anyone may reveal for anyone; the site's keeper (`src/autoclaim.ts`, deployer key) does, so the roller signs once. Supply stops at 10,000 counting pending commits. The author's wallet gets one free roll a day too (`commitForTreasury`, anyone may call; the keeper does).
- A roll may pin any of twelve things: the seven layers and five colours (skin, hair, ground, top, accent). Layer pins go to common or uncommon items only (skins: the human tones); colour pins are free of tiers. The price doubles with every pin, 0.0005 ETH for one up to 1.024 for all twelve; 95 percent goes to the author and 5 percent to the keeper (deployer) wallet at commit. Rare and legendary items come only from luck.
- Any roll may take a one of one from the pool with odds `poolLeft / tokensLeft`, so on average the pool empties with the supply. Cato's audit (2026-09-05) is why rolls are two-step: a one-step roll could be tried, inspected and reverted for free.
- Sprites are 32x32 maps of roles (outline, fill, shade, light, second fill, white), three bits per pixel, 384 bytes each, in `DataStore` contracts. The token's palette turns roles into colours. Weights, tiers, palettes and names sit in a meta blob (`contracts/fixtures.ts` documents the layout).
- `src/faces.ts` and `contracts/src/FaceRenderer.sol` produce the same SVG and JSON byte for byte. Sprites are drawn in `src/sprites.ts` with the DSL in `src/pixels.ts`.
- The site wears the ground of the newest face, or of the face of the day before anyone has rolled. Everything is CC0.

## Commands and rules that bite

- `bun run contracts/fixtures.ts` regenerates data blobs and cases; run after any change to `src/sprites.ts` or `src/faces.ts`. `bun run scripts/sheet.ts [slots|faces|ones]` renders review sheets into `out/`. `contracts/check.sh <net>` compares on-chain bytes and three SVGs with TS. Foundry tests need `via_ir`.
- Without `CONTRACT_ADDRESS` + `CHAIN_ID` the builder works and rolling is off.
- **Do not change `src/sprites.ts` or `src/faces.ts` output casually.** Rolled faces are drawn by the on-chain renderer pinned per token. A change means a new renderer (new stores, new meta) and `setRenderer` from the author wallet; it affects future rolls only. The 1/1 pool is fixed in the token contract at deploy; more 1/1s need a new token contract.
- **Pins are a uint128**, one byte per key high byte first: background, top, head, eyes, mouth, accessory, hair, skin, hair colour, ground, top colour, accent, four spare bytes; 0xff is no pin. `PIN_KEYS` in `src/faces.ts` is the order; the renderer and the site follow it.
- Pin fees are revenue; see the tax note in the plan before mainnet.

## Frontend Theme

Inherited from onenft.click: Syne 700/800 for display and numbers, Newsreader 400 for text; no border radius, 1px hairlines in `--line`, solid CTA in `--fg` on `--bg`; sidebar 360px sticky; pixel art with `image-rendering: pixelated`; no motion beyond a 150 ms row hover. `--bg` is the newest face's ground, `--fg` near-black or near-white by luma.
