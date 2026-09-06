/** This function is also embedded verbatim in the browser. The last check precedes wallet approval;
 * it cannot stop another tab or a direct contract call racing the submitted transaction. */
export async function hasPendingCommit(provider: { request(args: { method: string; params?: unknown[] }): Promise<unknown> }, from: string, chainHex: string, address: string, selector: string): Promise<boolean> {
  const network = await provider.request({ method: "eth_chainId" });
  if (typeof network !== "string" || BigInt(network) !== BigInt(chainHex)) throw Object.assign(new Error("wrong network"), { code: 4901 });
  const accounts = await provider.request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || accounts[0].toLowerCase() !== from.toLowerCase()) throw Object.assign(new Error("wallet account changed"), { code: 4100 });
  const result = await provider.request({ method: "eth_call", params: [{ to: address, data: selector + from.slice(2).toLowerCase().padStart(64, "0") }, "latest"] });
  if (typeof result !== "string" || !/^0x[0-9a-fA-F]{192}$/.test(result)) throw new Error("The commitment could not be checked. No transaction was sent.");
  return BigInt("0x" + result.slice(66, 130)) !== 0n;
}
