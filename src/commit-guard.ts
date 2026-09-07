/** Embedded verbatim in the browser. Recheck the wallet session after the chain read,
 * so switching accounts or networks while it is in flight cannot approve another wallet's roll. */
export async function hasPendingCommit(provider: { request(args: { method: string; params?: unknown[] }): Promise<unknown> }, from: string, chainHex: string, address: string, selector: string, readPending?: () => Promise<boolean>): Promise<boolean> {
  async function checkSession() {
    const network = await provider.request({ method: "eth_chainId" });
    if (typeof network !== "string" || BigInt(network) !== BigInt(chainHex)) throw Object.assign(new Error("wrong network"), { code: 4901 });
    const accounts = await provider.request({ method: "eth_accounts" });
    if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || accounts[0].toLowerCase() !== from.toLowerCase()) throw Object.assign(new Error("wallet account changed"), { code: 4100 });
  }
  await checkSession();
  let pending: boolean;
  if (readPending) {
    pending = await readPending();
    if (typeof pending !== "boolean") throw new Error("The commitment could not be checked. No transaction was sent.");
  } else {
    const result = await provider.request({ method: "eth_call", params: [{ to: address, data: selector + from.slice(2).toLowerCase().padStart(64, "0") }, "latest"] });
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]{192}$/.test(result)) throw new Error("The commitment could not be checked. No transaction was sent.");
    pending = BigInt("0x" + result.slice(66, 130)) !== 0n;
  }
  await checkSession();
  return pending;
}
