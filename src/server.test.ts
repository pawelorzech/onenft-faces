/**
 * The server as a process, against an RPC that is dead, one that hangs, and
 * none at all. What must hold: the process starts, liveness and images answer
 * at once, ownership reads as unknown (never as gaps or zeros), holder pages
 * say 503, and a hung RPC costs a page at most the deadline.
 */
import { expect, test, afterAll } from "bun:test";

const CONTRACT = "0x1111111111111111111111111111111111111111";
const procs: ReturnType<typeof Bun.spawn>[] = [];

async function boot(env: Record<string, string>): Promise<string> {
  const p = "0";
  let actualPort = 0;
  const proc = Bun.spawn(["bun", "run", "src/server.ts"], { env: { ...process.env, PORT: p, CHAIN_DEADLINE_MS: "400", ...env }, stdout: "pipe", stderr: "pipe", ipc(message: unknown) { if (message && typeof message === "object" && "port" in message) actualPort = Number(message.port); } });
  procs.push(proc);
  for (let i = 0; i < 100; i++) {
    const base = `http://127.0.0.1:${actualPort}`;
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return base;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("server did not start");
}
afterAll(() => { for (const p of procs) p.kill(); });

/** An RPC that accepts the connection and never answers. */
function hungRpc(): { url: string; stop: () => void; hits: () => number } {
  let n = 0;
  const srv = Bun.serve({ port: 0, fetch: () => { n++; return new Promise<Response>(() => {}); } });
  return { url: `http://127.0.0.1:${srv.port}`, stop: () => srv.stop(true), hits: () => n };
}

test("dead RPC: the process boots, liveness and images answer, ownership is unknown, holder pages say 503", async () => {
  const base = await boot({ CONTRACT_ADDRESS: CONTRACT, CHAIN_ID: "84532", BASE_RPC_URL: "http://127.0.0.1:9" });
  const t0 = Date.now();
  const health = await fetch(`${base}/health`);
  expect(health.status).toBe(200);
  expect(await health.text()).toStartWith("ok, epoch");
  expect((await fetch(`${base}/today.svg`)).status).toBe(200);
  expect((await fetch(`${base}/item/hair/1.svg`)).headers.get("content-type")).toContain("image/svg+xml");
  expect((await fetch(`${base}/preview.svg?p=ffffffffffffffffffffffffffffffff`)).status).toBe(200);
  expect((await fetch(`${base}/spec.json`)).status).toBe(200);
  expect(Date.now() - t0).toBeLessThan(1500);

  const ready = await fetch(`${base}/ready`);
  expect(ready.status).toBe(503);
  const rj = await ready.json();
  expect(rj.ok).toBe(false);
  expect(rj.chain.configured).toBe(true);
  expect(rj.chain.known).toBe(false);
  expect(JSON.stringify(rj)).not.toContain("127.0.0.1:9");

  const home = await (await fetch(`${base}/`)).text();
  expect(home).toContain("Collection status is unavailable");
  expect(home).toContain("<b>?</b>");
  expect(home).not.toContain("Nobody has rolled yet");
  expect(home).not.toContain('id="roll"');

  const st = await (await fetch(`${base}/api/state`)).json();
  expect(st.totalSupply).toBeNull();
  expect(st.pending).toBeNull();
  expect(st.chain.known).toBe(false);
  // A face that cannot be read is 503, not "no such face".
  const face = await fetch(`${base}/face/1`);
  expect(face.status).toBe(503);
  expect((await fetch(`${base}/face/1.svg`)).status).toBe(503);
  const faceJ = await fetch(`${base}/api/face/1`);
  expect(faceJ.status).toBe(503);
  expect(faceJ.headers.get("content-type")).toContain("application/json");
  // The roll status endpoint says rpc-down and sends nothing.
  const roll = await fetch(`${base}/api/reveal/0x2222222222222222222222222222222222222222`, { method: "POST" });
  expect(roll.status).toBe(503);
  expect((await roll.json()).state).toBe("rpc-down");

  const holder = await fetch(`${base}/0x2222222222222222222222222222222222222222`);
  expect(holder.status).toBe(503);
  expect(await holder.text()).toContain("The chain did not answer");
  const hj = await fetch(`${base}/api/holder/0x2222222222222222222222222222222222222222`);
  expect(hj.status).toBe(503);
  expect(hj.headers.get("content-type")).toContain("application/json");
  expect((await hj.json()).error).toBe("the chain did not answer");

  expect((await fetch(`${base}/nope`)).status).toBe(404);
  const apiNope = await fetch(`${base}/api/nope`);
  expect(apiNope.status).toBe(404);
  expect(apiNope.headers.get("content-type")).toContain("application/json");
  const go = await fetch(`${base}/go?who=junk`, { redirect: "manual" });
  expect(go.status).toBe(302);
  expect(go.headers.get("location")).toBe("/yours?bad=junk");
});

test("hung RPC: a page costs at most the deadline, twenty concurrent requests share one read, static paths do not wait at all", async () => {
  const rpc = hungRpc();
  try {
    const base = await boot({ CONTRACT_ADDRESS: CONTRACT, CHAIN_ID: "84532", BASE_RPC_URL: rpc.url, CHAIN_DEADLINE_MS: "300", RPC_TIMEOUT_MS: "60000" });
    let t0 = Date.now();
    expect((await fetch(`${base}/item/hair/1.svg`)).status).toBe(200);
    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(200);
    t0 = Date.now();
    const pages = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/`)));
    const took = Date.now() - t0;
    expect(pages.every((r) => r.status === 200)).toBe(true);
    expect(took).toBeLessThan(1500);
    // One read in flight for the whole burst: the boot read plus at most one more, never twenty.
    expect(rpc.hits()).toBeLessThanOrEqual(2);
    expect(await pages[0].text()).toContain("Collection status is unavailable");
  } finally {
    rpc.stop();
  }
});

test("no contract: a plain renderer, ready, claiming 'opens today'", async () => {
  const base = await boot({});
  expect((await fetch(`${base}/ready`)).status).toBe(200);
  const home = await (await fetch(`${base}/`)).text();
  expect(home).toContain("Rolling opens with the contract");
  expect(home).not.toContain("Collection status is unavailable");
  expect((await fetch(`${base}/0x2222222222222222222222222222222222222222`)).status).toBe(404);
  const r = await fetch(`${base}/`);
  expect(r.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(r.headers.get("x-content-type-options")).toBe("nosniff");
});
