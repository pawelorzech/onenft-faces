import { test, expect } from "bun:test";
import { shouldRoll } from "./autoclaim.ts";
test("treasury rolls only when the author can and supply remains", () => {
  const st = { totalSupply: 10, } as any;
  expect(shouldRoll(st, true)).toBe(true);
  expect(shouldRoll(st, false)).toBe(false);
  expect(shouldRoll({ totalSupply: 10000 } as any, true)).toBe(false);
  expect(shouldRoll(null, true)).toBe(false);
});
