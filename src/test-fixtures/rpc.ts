import { createPublicClient, custom, decodeFunctionData, encodeFunctionResult, encodeErrorResult, multicall3Abi, parseAbi, type Hex } from "viem";
import { base } from "viem/chains";
import { ABI } from "../contract.ts";
export const TOKEN = "0x3333333333333333333333333333333333333333";
export const OWNER = "0x2222222222222222222222222222222222222222";
export const OTHER = "0x4444444444444444444444444444444444444444";
/** Exercise viem's real multicall decoder with a local RPC transport. */
export function rpcFixture() {
  const state = { total: 121, head: 10000n, now: 1_000_000, failId: 0, failOwners: false, zeroRenderer: 0, owners: new Map<number, string>(), tags: [] as string[], ids: [] as number[] };
  const values: Record<string, unknown> = { author: OWNER, renderer: TOKEN, rendererLocked: true, pending: 0n, poolLeft: 50n, secondsLeft: 100n, currentEpoch: 1000n };
  const client = createPublicClient({ chain: base, transport: custom({ request: async ({ method, params }) => {
    if (method === "eth_blockNumber") return `0x${state.head.toString(16)}`;
    if (method !== "eth_call") throw new Error(`unexpected RPC ${method}`);
    const [tx, tag] = params as [{ data: Hex }, string]; state.tags.push(tag);
    const { args } = decodeFunctionData({ abi: multicall3Abi, data: tx.data });
    const results = (args![0] as readonly { callData: Hex }[]).map(({ callData }) => {
      const { functionName: name, args: input } = decodeFunctionData({ abi: ABI, data: callData });
      const id = Number(input?.[0] ?? 0);
      let result: unknown = values[name];
      if (name === "totalSupply") result = BigInt(state.total);
      if (name === "faces" || name === "ownerOf") {
        if (name === "faces") state.ids.push(id);
        if (id === state.failId || (state.failOwners && name === "ownerOf")) return { success: false, returnData: encodeErrorResult({ abi: parseAbi(["error Unavailable()"]), errorName: "Unavailable" }) };
        result = name === "ownerOf" ? state.owners.get(id) ?? OWNER : [BigInt(id), 0n, 0, id === state.zeroRenderer ? "0x0000000000000000000000000000000000000000" : TOKEN];
      }
      return { success: true, returnData: encodeFunctionResult({ abi: ABI, functionName: name, result: result as never }) };
    });
    return encodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", result: results });
  } }) });
  return { state, client };
}
