# Pending commitments on the deployed Faces contract

The deployed contract checks the UTC day but does not reject a new commit when that wallet still has a commitment from an earlier day. A direct call can overwrite it and increment `pending` again. The contract is unchanged. These application guards reduce exposure; they do not repair historical overwrites or enforce a new on-chain rule.

The browser keeps a local transaction across midnight, resumes its receipt/reveal, and checks the wallet's actual `commits(address)` through the connected provider immediately before requesting a new send. A pending commitment is resumed instead. The check also rejects a changed account or wrong network and fails closed on an unreadable response. The server's `canRoll` read combines the daily allowance with no pending commitment at a single fresh block.

The keeper always checks the author's commitment even if the log window missed it. Each cycle services known reveals or expired renewals before attempting a treasury commit. Treasury calls share one in-flight operation and recheck the author's commitment inside the serialized transaction queue. A still-known unresolved renewal is not resent solely because its receipt was slow.

The event scanner now processes commits and reveals in block/log order. Processing all commits before all reveals used to remove a newer commitment when the same scan chunk also contained the previous day's reveal.

`/health` and `/ready` keeper diagnostics include the chain pending count, number of observed outstanding commitments, expired commitments, oldest overdue block count, observation timestamp, and `pendingGap`. A persistent gap warrants investigation. It is a diagnostic disagreement, not proof of corruption: the chain snapshot and wallet reads can straddle blocks, startup scans may be incomplete, and the default log window is finite. A full historical index is not implemented. The author is checked independently of this window.

Limits: another tab or direct contract call can race the interval between checking and mining, including wallet approval across midnight. Third parties can call `commitForTreasury` themselves. A reveal may arrive between a read and a send; the new checks favor rechecking on the next cycle over overwriting. After a process restart, pending transaction tracking is in memory, so the contract remains the final protection against duplicate reveals; this is not a durable nonce ledger. No application change can restore a commitment already overwritten or remove an orphaned on-chain `pending` count.

## Bounded keeper diagnostics (2026-09-08)

Public status reads no longer retain addresses with no commitment. Successful reveal receipts also remove stale observations immediately. Outstanding observations expire after five minutes and are capped at 10,000, evicting the least recently refreshed entry. Summary calculation uses a bounded single pass without copying the map or spreading it into function arguments.

These observations are diagnostic only: eviction never deletes the pending transaction table or the event scanner's `unrevealed` set. `observationsLimited` becomes true once any observation has expired or been evicted during this process lifetime. `pendingGap` remains a diagnostic difference, not proof of orphaned supply; expired/evicted observations can increase it. No addresses, keys or transaction hashes are added to public diagnostics.

The `/how` page now distinguishes ordinary seed-derived traits from order-dependent one-of-one allocation and tells users to finish an existing roll before starting another after midnight. This corrects the description; it does not repair either contract limitation. No contract code, renderer, ABI or deployment is changed.

Validation: all 112 Bun tests passed (16 files, 1,046 assertions), including four new keeper regressions and the roll-instructions regression. The unused-address regression failed before the fix with 20,000 retained entries and passes afterward with zero. Existing cross-midnight, wallet-session and treasury recheck tests pass. Typecheck, shared-code manifest check, Bun server build and `git diff --check` pass. HTTP tests required execution outside the sandbox to bind local ports; signing credentials were removed from their environment. Contract tests and deployments were not run for this backend/documentation change.
