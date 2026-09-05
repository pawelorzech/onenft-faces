/**
 * The keeper. Two jobs from the deployer wallet, so nobody has to sign twice
 * and the treasury never misses a day: reveal every commit that is old enough
 * (anyone may, the contract allows it) and commit the author's daily roll.
 * Runs only when DEPLOYER_KEY is set.
 */
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ABI, CONTRACT, chain, chainState, canRoll, unrevealed, publicClient, type ChainState } from "./contract.ts";

/** Pure decision, so it can be tested without a chain. */
export function shouldCommitTreasury(state: ChainState | null, authorCanRoll: boolean): boolean {
  if (!state) return false;
  return authorCanRoll && state.totalSupply < 10000;
}
export function revealDue(revealBlock: number, head: number): boolean {
  return revealBlock > 0 && head >= revealBlock;
}

let wallet: ReturnType<typeof createWalletClient> | null = null;
let busy = false;

/** Reveal one wallet's commit if it is due. Returns the transaction hash or null. */
export async function revealFor(who: Address): Promise<Hex | null> {
  if (!wallet) return null;
  const { revealBlock, head } = await canRoll(who);
  if (!revealDue(revealBlock, head)) return null;
  const hash = await wallet.writeContract({ address: CONTRACT as Address, abi: ABI, functionName: "reveal", args: [who], chain, account: wallet.account! });
  unrevealed.delete(who);
  console.log(`keeper: revealed for ${who}, tx ${hash}`);
  return hash;
}

export function startAutoclaim(key: Hex, everyMs = 60_000): void {
  const account = privateKeyToAccount(key);
  wallet = createWalletClient({ account, chain, transport: http(process.env.BASE_RPC_URL) });
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const st = await chainState();
      if (!st) return;
      const { canRoll: ok } = await canRoll(st.author);
      if (shouldCommitTreasury(st, ok)) {
        const hash = await wallet!.writeContract({ address: CONTRACT as Address, abi: ABI, functionName: "commitForTreasury", chain, account });
        console.log(`keeper: treasury commit, tx ${hash}`);
        unrevealed.add(st.author);
      }
      for (const who of [...unrevealed]) {
        try { await revealFor(who); } catch (e) { console.error(`keeper: reveal ${who}:`, (e as Error).message); }
      }
    } catch (e) {
      console.error("keeper:", (e as Error).message);
    } finally {
      busy = false;
    }
  };
  void tick();
  setInterval(tick, everyMs);
  console.log(`keeper armed from ${account.address}, every ${everyMs / 1000} s`);
}
