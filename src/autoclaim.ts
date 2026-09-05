/**
 * The author's daily roll. The contract lets anyone trigger it; this loop
 * does, from the deployer wallet, so the treasury never misses a day. Runs
 * only when DEPLOYER_KEY is set.
 */
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ABI, CONTRACT, chain, chainState, canRoll, type ChainState } from "./contract.ts";

/** Pure decision, so it can be tested without a chain. */
export function shouldRoll(state: ChainState | null, authorCanRoll: boolean): boolean {
  if (!state) return false;
  return authorCanRoll && state.totalSupply < 10000;
}

export function startAutoclaim(key: Hex, everyMs = 5 * 60_000): void {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(process.env.BASE_RPC_URL) });
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const st = await chainState();
      if (!st) return;
      const { canRoll: ok } = await canRoll(st.author);
      if (shouldRoll(st, ok)) {
        const hash = await wallet.writeContract({ address: CONTRACT as Address, abi: ABI, functionName: "rollForTreasury" });
        console.log(`autoclaim: treasury roll, tx ${hash}`);
      }
    } catch (e) {
      console.error("autoclaim:", (e as Error).message);
    } finally {
      busy = false;
    }
  };
  void tick();
  setInterval(tick, everyMs);
  console.log(`autoclaim armed from ${account.address}, every ${everyMs / 60000} min`);
}
