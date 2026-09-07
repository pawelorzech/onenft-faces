import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { builderScript } from './site.ts';
import type { ChainState } from './contract.ts';

const account = '0x2222222222222222222222222222222222222222';
const address = '0x3333333333333333333333333333333333333333';
const key = `onenft_roll:0x2105:${address}:${account}`;
async function resume(states: object[], receipt: object | null = null) {
  const storage = new Map([[key, JSON.stringify({ stage: 'sent', hash: '0x' + 'a'.repeat(64), epoch: 20701 })]]);
  const calls: string[] = [];
  const elements = new Map<string, any>();
  for (const id of ['roll', 'msg', 'preview', 'price', 'keep', 'clear', 'sum', 'check', 'manual', 'fee']) {
    elements.set(id, { textContent: '', hidden: true, disabled: false, getAttribute() { return ''; }, addEventListener() {}, querySelector() { return null; }, insertAdjacentHTML() {} });
  }
  const timers: (() => void)[] = [];
  const location = { href: '' };
  let statusIndex = 0;
  runInNewContext(builderScript({ address, chainId: 8453, epoch: 20701 } as unknown as ChainState).replace(/^<script>\s*/, '').replace(/<\/script>$/, ''), {
    document: { getElementById: (id: string) => elements.get(id), querySelectorAll: () => [], querySelector: () => null, hidden: false },
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) },
    window: { ethereum: { on() {}, async request({ method }: { method: string }) { calls.push(method); if (method === 'eth_accounts') return [account]; throw new Error('Wallet is on Ethereum, not Base'); } } },
    AbortController, location,
    setTimeout: (f: () => void, ms: number) => { if (ms !== 10000) timers.push(f); return 1; }, clearTimeout() {},
    fetch: async (url: string) => { calls.push(url); return { ok: true, json: async () => url.startsWith('https:') ? { result: receipt } : states[Math.min(statusIndex++, states.length - 1)] }; },
  });
  for (let i = 0; i < 30; i++) await Promise.resolve();
  return { storage, calls, elements, timers, location };
}

test('saved sent roll already revealed resolves from Faces even when wallet is on another chain', async () => {
  const r = await resume([{ state: 'confirmed', tokenId: 42, rolledToday: true }]);
  expect(r.elements.get('msg').textContent).toContain('Your face is #42');
  expect(r.storage.has(key)).toBe(false);
  expect(r.calls).not.toContain('eth_getTransactionReceipt');
  expect(r.calls).not.toContain('eth_sendTransaction');
  r.timers.forEach(f => f());
  expect(r.location.href).toBe('/face/42');
});

test('on-chain pending commit advances to reveal without waiting for wallet receipt', async () => {
  const r = await resume([{ state: 'waiting', revealBlock: 123 }, { state: 'confirmed', tokenId: 43 }]);
  expect(r.calls).toContain('/api/reveal/' + account);
  expect(r.elements.get('msg').textContent).toContain('#43');
  expect(r.storage.has(key)).toBe(false);
});

test('receipt fallback reads Base independently of selected wallet chain', async () => {
  const r = await resume([{ state: 'none' }, { state: 'confirmed', tokenId: 44 }], { status: '0x1' });
  expect(r.calls).toContain('https://mainnet.base.org');
  expect(r.elements.get('msg').textContent).toContain('#44');
});

test('unavailable status and missing receipt preserve sent record and prevent another mint', async () => {
  const r = await resume([{ state: 'rpc-down' }]);
  expect(JSON.parse(r.storage.get(key)!).stage).toBe('sent');
  expect(r.elements.get('roll').disabled).toBe(true);
  expect(r.calls).not.toContain('eth_sendTransaction');
});

test('reverted commit releases the saved record and unlocks the builder', async () => {
  const r = await resume([{ state: 'none' }], { status: '0x0' });
  expect(r.storage.has(key)).toBe(false);
  expect(r.elements.get('roll').disabled).toBe(false);
  expect(r.elements.get('msg').textContent).toContain('rejected');
});
