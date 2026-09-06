import type { Address } from "viem";
type CommitEvent = { wallet: Address; kind: "commit" | "reveal"; blockNumber: bigint; logIndex: number };
export function forgetPendingWallet(pending: Set<Address>, wallet: Address): void {
  for (const existing of pending) if (existing.toLowerCase() === wallet.toLowerCase()) pending.delete(existing);
}
/** A reveal and the next day's commit can land in the same scan chunk. Chain order matters. */
export function applyCommitEvents(pending: Set<Address>, events: CommitEvent[]): void {
  for (const event of [...events].sort((a,b) => a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex)) {
    const who = event.wallet.toLowerCase() as Address;
    // Earlier code stored checksum addresses; normalize both sides during transition.
    forgetPendingWallet(pending, who);
    if (event.kind === "commit") pending.add(who);
  }
}
