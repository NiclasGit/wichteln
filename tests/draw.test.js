// Prüft, dass Teilnehmer-Links und Admin-Link immer dieselbe Auslosung zeigen.
// Start: npm test (oder: node --test tests/*.test.js)

const test = require("node:test");
const assert = require("node:assert/strict");
const { decode, createDraw, decryptAdmin, participantUrl, adminInfo } = require("../lib.js");

const BASE = "https://example.org/wichteln/";
const PASSWORD = "geheim123";
const NAMES = ["Oma", "Opa", "Mama", "Papa", "Anna-Lena", "Tim", "Jörg", "Zoë"];

// Liest aus allen Teilnehmer-Links ab, wer wen beschenkt
function pairsFromLinks(links) {
  const map = new Map();
  for (const { giver, url } of links) {
    const data = decode(url.split("#z=")[1]);
    assert.equal(data.n, giver, "Link gehört zur falschen Person");
    map.set(data.n, data.t);
  }
  return map;
}

async function adminData(adminUrl) {
  return decryptAdmin(adminUrl.split("#admin=")[1], PASSWORD);
}

const CONFIGS = [
  { names: NAMES.slice(0, 3).join("\n") },
  { names: NAMES.join("\n") },
  { names: NAMES.join("\n"), exclusions: "Mama - Papa\nOma & Opa" },
  { names: NAMES.join("\n"), fixed: "Oma -> Tim\nTim → Opa" },
  { names: NAMES.join("\n"), exclusions: "Mama - Papa", fixed: "Jörg -> Zoë\nZoë => Mama" },
];

for (const [i, config] of CONFIGS.entries()) {
  test(`Links und Admin-Bereich zeigen dieselbe Auslosung (Variante ${i + 1})`, async () => {
    for (let run = 0; run < 5; run++) {
      const values = { title: "Wichteln 2026", budget: "30 €", date: "2026-12-24", ...config };
      const result = await createDraw(values, PASSWORD, BASE);

      const fromLinks = pairsFromLinks(result.links);
      const admin = await adminData(result.adminUrl);
      const fromAdmin = new Map(admin.p);

      assert.deepEqual(fromLinks, fromAdmin, "Teilnehmer-Links und Admin-Bereich weichen voneinander ab");
      assert.deepEqual(fromAdmin, new Map(result.pairs));

      // Gleicher Auslosungs-Code und gleiche Infos überall
      for (const { url } of result.links) {
        const data = decode(url.split("#z=")[1]);
        assert.equal(data.id, admin.id);
        assert.equal(data.ti, admin.ti);
        assert.equal(data.b, admin.b);
        assert.equal(data.d, admin.d);
      }

      // Gültige Auslosung: jeder schenkt und bekommt genau einmal, niemand sich selbst
      const names = values.names.split("\n");
      assert.deepEqual([...fromAdmin.keys()].sort(), [...names].sort());
      assert.deepEqual([...fromAdmin.values()].sort(), [...names].sort());
      for (const [giver, receiver] of fromAdmin) assert.notEqual(giver, receiver);
    }
  });
}

test("Feste Paare und Ausschlüsse stimmen in Links und Admin-Bereich", async () => {
  for (let run = 0; run < 10; run++) {
    const result = await createDraw(
      { names: NAMES.join("\n"), exclusions: "Mama - Papa", fixed: "Oma -> Tim\nTim -> Opa" }, PASSWORD, BASE);
    const fromLinks = pairsFromLinks(result.links);
    const fromAdmin = new Map((await adminData(result.adminUrl)).p);
    for (const pairs of [fromLinks, fromAdmin]) {
      assert.equal(pairs.get("Oma"), "Tim");
      assert.equal(pairs.get("Tim"), "Opa");
      assert.notEqual(pairs.get("Mama"), "Papa");
      assert.notEqual(pairs.get("Papa"), "Mama");
    }
  }
});

test("Links, die im Admin-Bereich nochmal verschickt werden, sind identisch mit den Original-Links", async () => {
  const result = await createDraw({ names: NAMES.join("\n"), title: "Wichteln", budget: "20 €", date: "2026-12-24" }, PASSWORD, BASE);
  const admin = await adminData(result.adminUrl);
  const resent = admin.p.map(([giver, receiver]) => participantUrl(BASE, giver, receiver, adminInfo(admin)));
  assert.deepEqual(resent, result.links.map((l) => l.url));
});

test("Nochmal auslosen gibt einen neuen Code, damit alte Links erkennbar sind", async () => {
  const a = await createDraw({ names: NAMES.join("\n") }, PASSWORD, BASE);
  const b = await createDraw({ names: NAMES.join("\n") }, PASSWORD, BASE);
  assert.notEqual(a.id, b.id);
  const adminB = await adminData(b.adminUrl);
  for (const { url } of a.links) assert.notEqual(decode(url.split("#z=")[1]).id, adminB.id);
});

test("Falsches Passwort öffnet den Admin-Bereich nicht", async () => {
  const result = await createDraw({ names: NAMES.join("\n") }, PASSWORD, BASE);
  await assert.rejects(decryptAdmin(result.adminUrl.split("#admin=")[1], "falsch"));
});
