import { test, expect } from "bun:test";
import { shouldCommitTreasury, revealDue } from "./autoclaim.ts";
test("treasury commits only when the author can and supply remains", () => {
  const st = { totalSupply: 10 } as any;
  expect(shouldCommitTreasury(st, true)).toBe(true);
  expect(shouldCommitTreasury(st, false)).toBe(false);
  expect(shouldCommitTreasury({ totalSupply: 10000 } as any, true)).toBe(false);
  expect(shouldCommitTreasury(null, true)).toBe(false);
});
test("a reveal is due from its block on", () => {
  expect(revealDue(0, 100)).toBe(false);
  expect(revealDue(101, 100)).toBe(false);
  expect(revealDue(101, 101)).toBe(true);
});
