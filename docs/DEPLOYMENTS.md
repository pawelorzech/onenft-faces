# Deployments

Last verified: 2026-09-06

## Base mainnet (8453), second token contract, 2026-09-06

| Contract | Address |
|---|---|
| OneNFT (faces.onenft.click, FACE) | `0x7C745F4eA367A7A3CD596219A4E428F2eA9A8C4c` |
| FaceRenderer, stores, meta | unchanged, see below |

Reveal from block B + 2 within 256 blocks, `renew` past that, seed without the token id (see `docs/REVEAL_WINDOW.md`). Deploy block 50928740. Submitted to Sourcify. The first contract below is retired: it keeps its two faces, mints nothing more from this site, and the keeper no longer watches it.

## Base mainnet (8453), first token contract, 2026-09-05 (retired 2026-09-06)

## Base mainnet (8453), 2026-09-05

| Contract | Address |
|---|---|
| OneNFT (faces.onenft.click, FACE) | `0x37747e1c6221848807B2fA060dbf4Be798361752` |
| FaceRenderer | `0x0e5a1223042a7f266C5d22229751750861E89EBf` |
| store0 | `0x05545c0089A73eE5de1c16641489D2DbB42988c4` |
| store1 | `0xF90b5141F891FDB76663212C864eb11375Af3783` |
| store2 | `0x516279aB462b66f8911C0eDeF4F7C9593D741aAf` |
| meta | `0x2f0295a14a73034b7Bc4127dc2c401aAcd959b36` |

Author (owner, 95 percent of fees, daily treasury roll): `0x6e36Dc3ec2F9D4f3D8e616725fB6Fa184CD9aE20`. Keeper (deployer, 5 percent of fees, reveals and treasury commits): `0x7f28c8c9171b13F1E2fea21b6f2c8d4f91F892F3`. 173 sprites (123 items, 50 one of ones), meta 3502 bytes. Deploy block 50924109. Verified on Sourcify.

## Base Sepolia (84532)

Latest: OneNFT `0x97dAb0EccDAeA046f87594A07Adea29B4423bEAe` (second contract, 2026-09-06, smoke-tested with one commit and reveal), FaceRenderer `0xA5bC73727E45cb2Ad8064162343d6Fc5c868c215`; the first token contract was `0x4dF6E8778573152E373c4970995305A6A6A7E90B`; `~/.config/onenft-faces/deploy-sepolia.json` has the full record. Earlier Sepolia deployments the same day are abandoned.
