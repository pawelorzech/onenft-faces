import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { hasPendingCommit } from "./commit-guard.ts";
const guard = runInNewContext(`(${hasPendingCommit.toString()})`) as typeof hasPendingCommit;
const who = `0x${"a".repeat(40)}`, contract = `0x${"b".repeat(40)}`;
test("browser refuses a previous day's pending commit regardless of today's allowance", async () => {
  const calls: string[] = [];
  const provider = { request: async ({method}: {method: string}) => { calls.push(method); return method === "eth_chainId" ? "0x2105" : method === "eth_accounts" ? [who] : "0x" + "0".repeat(64) + "1".padStart(64,"0") + "0".repeat(64); } };
  expect(await guard(provider,who,"0x2105",contract,"0x12345678")).toBe(true);
  expect(calls).toEqual(["eth_chainId","eth_accounts","eth_call"]);
  provider.request = async ({method}) => method === "eth_chainId" ? "0x2105" : method === "eth_accounts" ? [who] : "0x" + "0".repeat(192);
  expect(await guard(provider,who,"0x2105",contract,"0x12345678")).toBe(false);
});
test("browser fails closed on changed account, wrong chain or malformed commitment read", async () => {
  for (const bad of ["chain","account","read"]) {
    const provider = {request: async({method}: {method:string}) => method === "eth_chainId" ? bad === "chain" ? "0x1" : "0x2105" : method === "eth_accounts" ? bad === "account" ? [contract] : [who] : "0x"};
    await expect(guard(provider,who,"0x2105",contract,"0x12345678")).rejects.toThrow();
  }
});

test("the generated builder checks a commitment before send and resumes it across midnight", async () => {
  const { homePage } = await import("./site.ts");
  const html = homePage({ address: contract, chainId:8453, author:who, renderer:contract, rendererLocked:false,totalSupply:0,pending:0,poolLeft:50,secondsLeft:100,epoch:2,readAt:0,faces:new Map(),owners:new Map(),rolls:new Map() } as any,2);
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]!).find(s=>s.includes("var pins={}"))!;
  expect(script).toBeDefined();
  const elements = new Map<string, any>();
  const node = (id:string) => { if(!elements.has(id))elements.set(id,{textContent:"",disabled:false,hidden:false,handlers:new Map(),getAttribute:()=>"",querySelector:()=>null,addEventListener(event:string,fn:Function){this.handlers.set(event,fn);},insertAdjacentHTML(){}});return elements.get(id); };
  const calls:string[]=[];let accountReads=0,checks=0;
  const provider={request:async({method}:{method:string})=>{calls.push(method);if(method==="eth_accounts")return ++accountReads===1?[]:[who];if(method==="eth_requestAccounts")return[who];if(method==="eth_chainId")return"0x2105";if(method==="eth_call")return"0x"+"0".repeat(64)+"1".padStart(64,"0")+"0".repeat(64);return null;}};
  const storage=new Map<string,string>();
  runInNewContext(script,{window:{ethereum:provider},document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>null},localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)},fetch:async()=>({ok:true,json:async()=>++checks===1?{state:"none",revealBlock:0,rolledToday:false,soldOut:false}:{state:"no-keeper",revealBlock:101,epoch:1}}),setTimeout,clearTimeout,URLSearchParams,console});
  await node("roll").handlers.get("click")();
  expect(calls).toContain("eth_call");
  expect(calls).not.toContain("eth_sendTransaction");
  expect(node("msg").textContent).toContain("reveal service is not running");
  expect(storage.size).toBe(1);
});
