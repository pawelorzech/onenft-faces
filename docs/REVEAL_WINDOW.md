# The reveal window of the deployed contract

Last verified: local source at commit 8a3678a, mainnet bytecode read 2026-09-05 | 2026-09-05

This is a finding from the local source, checked against the deployed bytecode by a read-only comparison. It is not a full audit, and no attack was run against production. The contract is immutable; nothing here changes it. The site's copy and keeper were changed so that they do not promise what the contract does not give.

## What the code does

`OneNFT.sol`, `reveal(address wallet)`:

- allowed from `block.number > commitBlock`, so from block `B + 1` on, where `B` is the commit block;
- the seed is `keccak256(blockhash(B + 1), wallet, pins, B, tokenId)` truncated to 64 bits;
- `tokenId` is `++totalSupply` at the moment of the reveal.

`blockhash(n)` returns zero for the current block and for any block more than 256 blocks back. So:

| Reveal mined in block | `blockhash(B + 1)` in the seed | Verified by |
|---|---|---|
| `B` | reverts (`TooEarly`) | `test_RevealInBlockB_Reverts` |
| `B + 1` | **zero** | `test_RevealInBlockBPlus1_UsesZeroHash` |
| `B + 2` to `B + 257` | the real hash | `test_RevealInBlockBPlus2_UsesRealHash`, `test_RevealInBlockBPlus257_LastRealHash` |
| `B + 258` and later | **zero** again | `test_RevealInBlockBPlus258_ZeroHashAgain` |

Two more properties, also verified locally:

- the token id is part of the seed and depends on the order of reveals, so the same commit can produce two different faces (`test_RevealOrderChangesTheSeed`);
- from `B + 2` on, every candidate seed can be computed before the reveal transaction is sent, one per possible token id (`test_SeedIsComputableBeforeTheRevealOnceTheHashExists`);
- the one of one draw runs on every reveal, pinned or not (`test_OneOfOneDrawRunsWithPinsToo`).

Tests: `contracts/test/RevealWindow.t.sol`, 8 passing, run with `cd contracts && forge test --match-contract RevealWindowTest`.

## Deployed bytecode

`cast code 0x37747e1c6221848807B2fA060dbf4Be798361752` on Base mainnet (public RPC, read only) has 9,065 bytes, the same as the local `forge build` of `OneNFT.sol`. With the 256 bytes of immutable references masked (author, keeper, oneOfOnes) the two are byte for byte equal, metadata included. The finding applies to the contract that is live.

Mainnet state at the time of the read: `totalSupply` 2, `pending` 0.

## What it means

The commit-reveal split does what it was designed for: a wallet cannot try a roll, look, and revert, because the day and the fee are spent at the commit. What the split does not give is a seed that nobody can know before the reveal:

1. **A roller who sends the reveal in block `B + 1`** gets a seed made of public inputs only (zero hash, their address, their pins, the commit block, the next token id). They cannot change that seed, but they can compute it and choose not to reveal yet.
2. **From `B + 2` on the hash is public.** Any roller can compute the face they would get for every token id, and reveal when `totalSupply + 1` is an id they like, or let others reveal first. A commit never expires; after 256 blocks the hash goes back to zero and the seed is again a function of public inputs and the token id.
3. **The one of one draw is part of the seed**, so the same choice applies to it: a patient roller can pick a token id whose seed hits the pool.

The effect is bounded: one wallet gets one commit per day, the fee is paid, and the roller can only choose among the token ids that come up while they wait. It is not "cannot peek", which is what the site used to say.

## What was changed on the site (this audit)

- `/how` describes the seed as it is: the reveal reads the hash of the block after the commit; in that block, and past 256 blocks, it reads as zero; the token id depends on the order of reveals. The phrase "so nobody can peek and retry" is gone.
- The keeper reveals from block `B + 1` on, so its own transaction is mined at `B + 2` or later and carries the real hash. That protects the honest path; it does not stop a roller from revealing at `B + 1` themselves. The site now offers a manual reveal from the roller's wallet only when the keeper is absent or failed, never by itself.
- The `/ones`, `/rarity` and `spec.json` texts say the one of one draw runs on every roll, pinned or not, and that a one of one keeps the pinned background and ground colour and replaces every other pin, with no refund.

## Options for the contract (a decision for the author; none of these is done)

The token contract is immutable. Any fix means a new contract and a new collection, or accepting the current rules and stating them. In order of cost:

1. **Accept and state.** Keep the contract, keep the copy honest (done). The bias is limited to one commit per wallet per day and to the token ids that come up while the roller waits.
2. **New contract, seed without `tokenId`.** Take the token id out of the seed (use `wallet`, `pins`, `B`, `blockhash`), so waiting changes nothing. The `B + 1` and `B + 258` zero-hash cases remain.
3. **New contract, reveal from `B + 2`, expire after `B + 256`.** Require `block.number >= B + 2` and `block.number <= B + 256`, with an expired commit either refunding the fee or forfeiting it. Removes both zero-hash cases. Combine with option 2.
4. **New contract, keeper-only reveal or a VRF.** Restricting who may reveal moves trust to the keeper; a VRF adds a paid dependency. Neither fits "anyone may reveal for anyone".

Whichever is chosen, the site must not claim more than the contract gives, and the change must not be presented as a UX fix.
