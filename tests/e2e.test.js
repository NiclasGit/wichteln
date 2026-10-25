// Ende-zu-Ende im echten Browser: auslosen, jeden Link öffnen und aufdecken,
// dann im Admin-Bereich nachschauen – beides muss übereinstimmen.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let chromium;
try { ({ chromium } = require("playwright")); } catch {}

const PAGE = pathToFileURL(path.join(__dirname, "..", "index.html")).href;
const PASSWORD = "geheim123";

async function drawInBrowser(page) {
  await page.click("#draw");
  await page.waitForSelector("#admin-link-box:not(.hidden)");
  await page.waitForFunction(() => document.getElementById("draw").textContent.includes("Nochmal"));
  const links = await page.$$eval("#links a.wa", (as) => as.map((a) => decodeURIComponent(a.href).match(/(file:\S+)/)[1]));
  await page.click("#admin-copy");
  const adminUrl = await page.evaluate(() => navigator.clipboard.readText());
  const id = await page.textContent("#draw-id");
  return { links, adminUrl, id };
}

async function revealAll(context, links) {
  const pairs = new Map();
  const ids = new Set();
  for (const url of links) {
    const page = await context.newPage();
    await page.goto(url);
    await page.click("#r-yes");
    while (await page.isVisible("#gift")) await page.click("#gift");
    pairs.set(await page.textContent("#r-name"), await page.textContent("#r-target"));
    ids.add(await page.textContent("#r-draw-id"));
    await page.close();
  }
  return { pairs, ids };
}

async function readAdmin(context, adminUrl) {
  const page = await context.newPage();
  await page.goto(adminUrl);
  await page.fill("#admin-login-pw", PASSWORD);
  await page.click("#admin-login button");
  await page.waitForSelector("#admin-panel:not(.hidden)");
  const rows = await page.$$eval("#admin-pairs .who", (els) => els.map((el) => [
    el.firstChild.textContent.replace(" → ", ""), el.querySelector(".secret").textContent,
  ]));
  const meta = await page.textContent("#admin-meta");
  await page.close();
  return { pairs: new Map(rows), meta };
}

test("Im Browser: Zettel und Admin-Bereich zeigen dieselbe Auslosung – auch nach „Nochmal auslosen“",
  { skip: !chromium && "playwright ist nicht installiert" }, async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
      await context.route(/^https?:/, (route) => route.abort());
      const page = await context.newPage();
      await page.goto(PAGE);
      await page.fill("#names", "Oma\nOpa\nMama\nPapa\nAnna-Lena\nTim");
      await page.fill("#exclusions", "Mama - Papa");
      await page.fill("#fixed", "Oma -> Tim");
      await page.fill("#admin-pw", PASSWORD);

      for (let round = 0; round < 2; round++) {
        const { links, adminUrl, id } = await drawInBrowser(page);
        const revealed = await revealAll(context, links);
        const admin = await readAdmin(context, adminUrl);

        assert.equal(revealed.pairs.size, 6);
        assert.deepEqual(revealed.pairs, admin.pairs, "Zettel und Admin-Bereich weichen voneinander ab");
        assert.equal(admin.pairs.get("Oma"), "Tim");
        assert.deepEqual([...revealed.ids], [`Auslosungs-Code: ${id}`]);
        assert.match(admin.meta, new RegExp(`Auslosungs-Code ${id}`));
      }
    } finally {
      await browser.close();
    }
  });
