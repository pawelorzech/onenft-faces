import { test, expect } from "bun:test";
import * as site from "./site.ts";
import * as pages from "./pages.ts";
import { handle } from "./server.ts";
import { ONE_OF_ONES } from "./sprites.ts";
import { BASE_TRAITS, GROUNDS, svgOf } from "./faces.ts";
const yours = () => pages.yoursPage(null, 20726);
const how = () => site.howPage(null, 20726);
const assets = () => pages.assetsPage(null, 20726);

test("wallet form validates ENS and addresses with the browser v flag", () => {
  const pattern = yours().match(/pattern="([^"]+)"/)![1];
  const re = new RegExp(pattern, "v");
  for (const value of ["name.eth", "some-name.eth", "0x" + "a".repeat(40), " name.eth "]) expect(re.test(value)).toBe(true);
  for (const value of ["not-a-wallet", "name.com", "0x1234"]) expect(re.test(value)).toBe(false);
});

test("server failures render recovery actions and stay out of the index", () => {
  const html = site.serviceError();
  expect(html).toContain('<a href="">Try again</a>');
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).toContain("<h1");
  expect(html).not.toContain("stack trace");
});
test("wallet entry is excluded from indexing", () => {
  expect(yours()).toContain('<meta name="robots" content="noindex">');
});
test("public information pages have descriptions matching their content", () => {
  const description = (html: string) => html.match(/name="description" content="([^"]+)"/)![1];
  expect(description(how())).not.toBe(description(assets()));
});

test("sitemap is served as XML with public canonical origins and no internal pages", async () => {
  const response = await handle(new Request("http://localhost/sitemap.xml"));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("xml");
  const body = await response.text();
  expect(body).toContain("https://faces.onenft.click/");
  for (const value of ["localhost", "/yours", "/wallet", "/api/", "<lastmod>"]) expect(body).not.toContain(value);
  const robots = await (await handle(new Request("http://localhost/robots.txt"))).text();
  expect(robots).toContain("Sitemap: https://faces.onenft.click/sitemap.xml");
});

test("wallet validation keeps safely escaped input for correction", () => {
  const html = site.whoBlock(null, null, 'bad"<input>');
  expect(html).toContain('value="bad&quot;&lt;input&gt;"');
});

test("the one-of-one gallery defers its drawings without changing their artwork", async () => {
  const html = pages.onesPage(null, 20726);
  expect(html).toContain('src="/one-of-one/0.svg"');
  expect(html).toContain('loading="lazy"');
  expect(html.length).toBeLessThan(60000);
  for (let id = 0; id < ONE_OF_ONES.length; id++) {
    const response = await handle(new Request(`http://localhost/one-of-one/${id}.svg`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toBe(svgOf({ ...BASE_TRAITS, one: id, ground: (id * 3) % GROUNDS.length }, 240));
  }
  expect((await handle(new Request(`http://localhost/one-of-one/${ONE_OF_ONES.length}.svg`))).status).toBe(404);
});
