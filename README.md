# faces.onenft.click

One face a day per wallet, rolled on chain. Pin what you want, luck does the rest. 10,000 faces, then it stops. CC0.

- Every wallet rolls one face per UTC day, free. Up to three pins (background, top, eyes, hair, skin) for 0.0005 / 0.0015 / 0.004 ETH.
- Rare and legendary items come only from luck. A roll without pins can take a one of one from the pool.
- The image is drawn by the contract from the seed: 32x32 pixel sprites, palettes, weights, all on Base.

`bun test` · `cd contracts && forge test` · `PORT=3000 bun run src/server.ts`

Part of [onenft.click](https://onenft.click).
