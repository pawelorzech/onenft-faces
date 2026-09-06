import { test, expect } from "bun:test";
import { applyCommitEvents } from "./commit-log.ts";
import type { Address } from "viem";
const wallet = `0x${"a".repeat(40)}` as Address;
test("a reveal followed by next-day commit in one chunk stays pending", () => {
  const pending = new Set<Address>();
  applyCommitEvents(pending,[{wallet,kind:"commit",blockNumber:100n,logIndex:0},{wallet,kind:"commit",blockNumber:200n,logIndex:2},{wallet,kind:"reveal",blockNumber:200n,logIndex:1}]);
  expect(pending.has(wallet)).toBe(true);
  applyCommitEvents(pending,[{wallet,kind:"reveal",blockNumber:201n,logIndex:0}]);
  expect(pending.size).toBe(0);
});

test("clearing an observed commitment removes checksum and lowercase aliases", async () => {
  const { forgetPendingWallet } = await import("./commit-log.ts");
  const checksum = `0x${"aA".repeat(20)}` as Address;
  const pending = new Set<Address>([wallet,checksum]);
  forgetPendingWallet(pending,checksum);
  expect(pending.size).toBe(0);
});
