import { test, expect } from "bun:test";
import { createFacesReader } from "./contract.ts";
import { refreshAllowed } from "./contract.ts";
import { rpcFixture, TOKEN, OWNER, OTHER } from "./test-fixtures/rpc.ts";

test("a burst beyond the recent window reads every face and owner at the same block", async () => {
  const { state, client } = rpcFixture(); const reader = createFacesReader(client, TOKEN, () => state.now);
  const first = await reader.read(); state.total = 281; state.head++; state.now += 12000; state.tags = [];
  const next = await reader.read();
  expect(next.faces.size).toBe(281); expect(next.owners.size).toBe(281);
  expect(first.faces.size).toBe(121); expect(first.owners.size).toBe(121);
  expect(new Set(state.tags)).toEqual(new Set(["0x2711"]));
});

test("a late revert and a missing renderer cannot commit a partial snapshot", async () => {
  const { state, client } = rpcFixture(); const reader = createFacesReader(client, TOKEN, () => state.now);
  const first = await reader.read(); state.total = 900; state.failId = 700;
  await expect(reader.read()).rejects.toThrow("faces(700) failed");
  state.failId = 0; state.zeroRenderer = 800;
  await expect(reader.read()).rejects.toThrow("missing face in supply");
  state.zeroRenderer = 0; state.failOwners = true;
  await expect(reader.read()).rejects.toThrow("ownerOf");
  expect(first.faces.size).toBe(121); expect(first.owners.size).toBe(121);
  state.failOwners = false;
  const recovered = await reader.read(); expect(recovered.faces.size).toBe(900); expect(recovered.owners.size).toBe(900);
});

test("recent refresh preserves old ownership age; explicit full refresh updates all owners", async () => {
  const { state, client } = rpcFixture(); state.total = 281;
  const reader = createFacesReader(client, TOKEN, () => state.now); const first = await reader.read();
  state.now += 12000; state.owners.set(1, OTHER); state.owners.set(281, OTHER);
  const recent = await reader.read();
  expect(recent.owners.get(1)).toBe(OWNER); expect(recent.owners.get(281)).toBe(OTHER);
  expect(recent.ownersReadAt).toBe(first.readAt); expect(recent.ownerReadAt!.get(1)).toBe(first.readAt);
  reader.requestAll(); const all = await reader.read();
  expect(all.owners.get(1)).toBe(OTHER); expect(all.ownersReadAt).toBe(state.now);
  expect(first.owners.get(281)).toBe(OWNER);
});

test("a supply rollback drops orphaned face and owner records", async () => {
  const { state, client } = rpcFixture(); const reader = createFacesReader(client, TOKEN, () => state.now);
  await reader.read(); state.total = 100; const next = await reader.read();
  expect(next.faces.size).toBe(100); expect(next.owners.size).toBe(100); expect(next.ownerReadAt!.has(121)).toBe(false);
});

test("explicit refreshes back off after RPC errors and resume at the retry boundary", () => {
  expect(refreshAllowed({ error: "RPC unavailable", errorAt: 1000, failures: 1 }, 3999)).toBe(false);
  expect(refreshAllowed({ error: "RPC unavailable", errorAt: 1000, failures: 1 }, 4000)).toBe(true);
  expect(refreshAllowed({ error: "RPC unavailable", errorAt: 1000, failures: 8 }, 60999)).toBe(false);
  expect(refreshAllowed({ error: "RPC unavailable", errorAt: 1000, failures: 8 }, 61000)).toBe(true);
  expect(refreshAllowed({ error: null, errorAt: 1000, failures: 0 }, 1001)).toBe(true);
});
