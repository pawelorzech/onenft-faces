# Decisions

Last verified: 2026-09-05

- **One roll per wallet per UTC day, free or with pins.** No second paid roll the same day. (2026-09-05)
- **Pins:** background, top, eyes, hair, skin; up to three; common or uncommon only; 0.0005 / 0.0015 / 0.004 ETH to the author. Human skin tones are pinnable, fantasy tones are not.
- **1/1 odds adapt:** poolLeft / tokensLeft per unpinned roll, so on average the pool empties with the supply. A fixed 1 in 10,000 would have left most of the pool unrolled.
- **Treasury:** one random roll a day to the author wallet, triggered by anyone, done by the site loop. No tail, no every-Nth id.
- **Supply 10,000, 50 one of ones.** A second season is a new contract.
- **Art:** Ink 3 at 32x32: black outline, dithered grounds, rim light. Heads are boxes with a jaw, not ellipses.
- **No royalties, no light/dark toggle, CC0.**
- **Deploy path:** stores and meta through `forge script`, renderer and token through `forge create` (forge script cannot decode the `address[]` constructor argument). Verify on Sourcify by hand. (2026-09-05)
- **Commit-reveal (Cato's audit, 2026-09-05).** A one-step roll revealed its outcome before committing state, and a failed attempt could revert for free, so a bot could drain the 1/1 pool for dollars. Now `commit` spends the day and fee, `reveal` one block later mixes `blockhash(commitBlock + 1)` into the seed; anyone may reveal, the keeper does. Pinned rolls are pool-eligible too, so the odds denominator is honest. `_checkRenderer` probes every entrypoint and the 1/1 and pinned paths; a new renderer must know at least as many 1/1s as the pool; the renderer constructor checks the meta blob's counts and names; `sweep()` returns forced ETH to the author.
