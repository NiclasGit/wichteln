// Kern-Logik fürs Wichteln: Auslosung, Teilnehmer-Links und verschlüsselter Admin-Link.
// Wird von der Seite (app.js) und von den Tests (tests/) gleichermaßen benutzt,
// damit Links und Admin-Bereich garantiert aus derselben Auslosung entstehen.

const KEY = "wichteln-ho-ho-ho";

// ---------- Kodierung der Links ----------

function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const k = new TextEncoder().encode(KEY);
  const x = bytes.map((b, i) => b ^ k[i % k.length]);
  return btoa(String.fromCharCode(...x)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const k = new TextEncoder().encode(KEY);
  const bytes = Uint8Array.from(bin, (c, i) => c.charCodeAt(0) ^ k[i % k.length]);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ---------- Auslosung ----------

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseExclusions(text, names) {
  const pairs = new Set();
  for (const line of text.split("\n")) {
    const parts = line.split(/\s+[-–]\s+|\s*[&,]\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    for (const p of parts) {
      if (!names.includes(p)) throw new Error(`„${p}“ steht nicht in der Teilnehmerliste.`);
    }
    // Alle Namen einer Zeile ziehen sich gegenseitig nicht
    for (const a of parts) for (const b of parts) if (a !== b) pairs.add(a + "\u0000" + b);
  }
  return pairs;
}

function parseFixed(text, names, excluded) {
  const fixed = new Map();
  const taken = new Set();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split(/\s*(?:->|→|=>|>)\s*/).map((s) => s.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`„${line.trim()}“ verstehe ich nicht – bitte so schreiben: „Oma -> Tim“.`);
    const [giver, receiver] = parts;
    for (const p of parts) {
      if (!names.includes(p)) throw new Error(`„${p}“ steht nicht in der Teilnehmerliste.`);
    }
    if (giver === receiver) throw new Error(`${giver} kann sich nicht selbst beschenken. 😄`);
    if (fixed.has(giver)) throw new Error(`${giver} ist bei den festen Paaren doppelt als Schenker eingetragen.`);
    if (taken.has(receiver)) throw new Error(`${receiver} wird bei den festen Paaren von zwei Leuten beschenkt.`);
    if (excluded.has(giver + "\u0000" + receiver)) throw new Error(`${giver} -> ${receiver} ist gleichzeitig fest und ausgeschlossen.`);
    fixed.set(giver, receiver);
    taken.add(receiver);
  }
  return fixed;
}

function draw(names, excluded, fixed) {
  // Feste Paare stehen, der Rest wird unter den übrigen Leuten ausgelost
  const freeGivers = names.filter((n) => !fixed.has(n));
  const taken = new Set(fixed.values());
  const freeReceivers = names.filter((n) => !taken.has(n));
  for (let attempt = 0; attempt < 10000; attempt++) {
    const receivers = shuffle(freeReceivers);
    const ok = freeGivers.every((giver, i) => giver !== receivers[i] && !excluded.has(giver + "\u0000" + receivers[i]));
    if (ok) {
      const result = new Map(fixed);
      freeGivers.forEach((giver, i) => result.set(giver, receivers[i]));
      return names.map((giver) => [giver, result.get(giver)]);
    }
  }
  return null;
}

// ---------- Links ----------

function participantUrl(base, giver, receiver, info) {
  return `${base}#z=${encode({ n: giver, t: receiver, ti: info.title, b: info.budget, d: info.date, id: info.id })}`;
}

// Alle Infos, die im Admin-Link stecken, im selben Format wie beim Erstellen der Teilnehmer-Links
function adminInfo(data) {
  return { title: data.ti, budget: data.b, date: data.d, id: data.id };
}

function newDrawId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => chars[b % chars.length]).join("");
}

// Eine komplette Auslosung: Paare, Teilnehmer-Links und (mit Passwort) Admin-Link – alles aus denselben Paaren
async function createDraw(values, password, base) {
  const names = [...new Set(values.names.split("\n").map((s) => s.trim()).filter(Boolean))];
  if (names.length < 3) throw new Error("Mindestens 3 Leute, sonst ist's kein richtiges Wichteln. 😉");

  const excluded = parseExclusions(values.exclusions || "", names);
  const fixed = parseFixed(values.fixed || "", names, excluded);
  const pairs = draw(names, excluded, fixed);
  if (!pairs) throw new Error("Mit diesen Regeln geht's leider nicht auf. Lockert die Ausschlüsse oder festen Paare ein bisschen!");

  const info = { title: values.title, budget: values.budget, date: values.date, id: newDrawId() };
  const links = pairs.map(([giver, receiver]) => ({ giver, url: participantUrl(base, giver, receiver, info) }));
  let adminUrl = null;
  if (password) {
    const data = { p: pairs, ti: info.title, b: info.budget, d: info.date, id: info.id, at: new Date().toISOString() };
    adminUrl = `${base}#admin=${await encryptAdmin(data, password)}`;
  }
  return { pairs, id: info.id, links, adminUrl };
}

// ---------- Admin-Link: komplette Auslosung, mit Passwort verschlüsselt ----------

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (str) => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

async function encryptAdmin(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(data))));
  return b64url(new Uint8Array([...salt, ...iv, ...cipher]));
}

async function decryptAdmin(str, password) {
  const bytes = unb64url(str);
  const key = await deriveKey(password, bytes.slice(0, 16));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(16, 28) }, key, bytes.slice(28));
  return JSON.parse(new TextDecoder().decode(plain));
}

if (typeof module !== "undefined") {
  module.exports = { encode, decode, shuffle, parseExclusions, parseFixed, draw, participantUrl, adminInfo, createDraw, encryptAdmin, decryptAdmin };
}
