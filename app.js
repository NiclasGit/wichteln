// Familien-Wichteln – läuft komplett im Browser, ohne Server.
// Die Zuteilung steckt (leicht verschleiert) im persönlichen Link jeder Person.

const $ = (id) => document.getElementById(id);
const KEY = "wichteln-ho-ho-ho";
const STORAGE = "wichteln-setup";

const TIPS = [
  "Socken gehen immer. Lustige Socken gehen immer besser.",
  "Selbstgemachtes zählt doppelt – Kekse inklusive.",
  "Ein Gutschein für „einmal Abwasch übernehmen“ ist unbezahlbar.",
  "Verpack es in fünf Kartons ineinander. Freude × 5.",
  "Kleiner Hinweis im Gespräch fallen lassen? Frag mal unauffällig nach Lieblingsschokolade.",
  "Je schräger die Verpackung, desto größer der Lacher.",
  "Ein gerahmtes peinliches Familienfoto ist ein Klassiker.",
  "Wenn gar nichts hilft: Kuschelsocken mit Rentieren. 🦌",
  "Leg einen handgeschriebenen Zettel bei – das bleibt länger als das Geschenk.",
  "Nicht vergessen: Preisschild ab! 🏷️",
];

const ELF_FIRST = ["Zuckerstange", "Glitzer", "Lebkuchen", "Schneeflocke", "Zimtstern", "Glöckchen", "Tannenduft", "Punsch"];
const ELF_LAST = ["von Nordpol", "Flinkfuß", "Wunderkeks", "Funkelnase", "Klingelbart", "Rentierflüsterer", "Schleifenzauber"];

// Weihnachts-GIFs: zufällige Reihenfolge, jedes kommt einmal dran, bevor sich eins wiederholt.
// Kaputte Links werden übersprungen.
// Bild-Links (z.B. https://media.giphy.com/media/<ID>/giphy.gif) oder Dateien aus assets/memes/.
const MEMES = [
  "https://media.giphy.com/media/WmkqburJqXziM/giphy.gif",
  "https://media.giphy.com/media/LBAv3HJDl2WwU/giphy.gif",
  "https://media.giphy.com/media/11EjiLDatd0syA/giphy.gif",
  "https://media.giphy.com/media/F3vfdvuM3mCyp7WnQr/giphy.gif",
  "https://media.giphy.com/media/2LbfRQVHs34V1Ru8Pt/giphy.gif",
  "https://media.giphy.com/media/peLaXBwYXthPVQbBne/giphy.gif",
  "https://media.giphy.com/media/KzKHlzSlfHZV44EdTy/giphy.gif",
  "https://media.giphy.com/media/5dZYGvxrjfthsL9xdN/giphy.gif",
];

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

// ---------- Organisator-Ansicht ----------

function initSetup() {
  $("setup").classList.remove("hidden");

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    for (const f of ["title", "names", "exclusions", "fixed", "budget", "date"]) if (saved[f]) $(f).value = saved[f];
  } catch {}

  $("draw").addEventListener("click", async () => {
    $("error").textContent = "";
    const values = {};
    for (const f of ["title", "names", "exclusions", "fixed", "budget", "date"]) values[f] = $(f).value.trim();
    try { localStorage.setItem(STORAGE, JSON.stringify(values)); } catch {}

    const names = [...new Set(values.names.split("\n").map((s) => s.trim()).filter(Boolean))];
    if (names.length < 3) return showError("Mindestens 3 Leute, sonst ist's kein richtiges Wichteln. 😉");

    let excluded, fixed;
    try {
      excluded = parseExclusions(values.exclusions, names);
      fixed = parseFixed(values.fixed, names, excluded);
    } catch (e) { return showError(e.message); }

    const pairs = draw(names, excluded, fixed);
    if (!pairs) return showError("Mit diesen Regeln geht's leider nicht auf. Lockert die Ausschlüsse oder festen Paare ein bisschen!");

    renderLinks(pairs, values);
    await renderAdminLink(pairs, values, $("admin-pw").value);
    shuffleAnimation();
  });
}

function showError(msg) {
  $("error").textContent = msg;
  $("results").classList.add("hidden");
}

function participantUrl(giver, receiver, values) {
  const base = location.href.split("#")[0];
  return `${base}#z=${encode({ n: giver, t: receiver, ti: values.title, b: values.budget, d: values.date })}`;
}

function shareButtons(giver, url) {
  const msg = `Hallo ${giver}! 🎅 Hier ist dein geheimer Wichtel-Zettel: ${url}`;

  const copy = document.createElement("button");
  copy.textContent = "Link kopieren";
  copy.addEventListener("click", () => copyText(url, copy));

  const wa = document.createElement("a");
  wa.className = "wa";
  wa.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  wa.target = "_blank";
  wa.rel = "noopener";
  wa.textContent = "WhatsApp";
  return [copy, wa];
}

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); btn.textContent = "Kopiert ✓"; }
  catch { prompt("Link kopieren:", text); }
}

function renderLinks(pairs, values) {
  const list = $("links");
  list.innerHTML = "";
  for (const [giver, receiver] of pairs) {
    const li = document.createElement("li");
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = `🎁 ${giver}`;
    li.append(who, ...shareButtons(giver, participantUrl(giver, receiver, values)));
    list.append(li);
  }
  $("results").classList.remove("hidden");
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

async function renderAdminLink(pairs, values, password) {
  const box = $("admin-link-box");
  if (!password) return box.classList.add("hidden");
  const data = { p: pairs, ti: values.title, b: values.budget, d: values.date, at: new Date().toISOString() };
  const url = `${location.href.split("#")[0]}#admin=${await encryptAdmin(data, password)}`;
  const btn = $("admin-copy");
  btn.textContent = "Admin-Link kopieren";
  btn.onclick = () => copyText(url, btn);
  box.classList.remove("hidden");
}

function initAdmin(blob) {
  $("admin").classList.remove("hidden");
  $("admin-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    let data;
    try { data = await decryptAdmin(blob, $("admin-login-pw").value); }
    catch { $("admin-error").textContent = "Falsches Passwort – netter Versuch! 😏"; return; }
    $("admin-login").classList.add("hidden");
    renderAdminPanel(data);
  });
}

function renderAdminPanel(data) {
  if (data.ti) $("admin-title").textContent = `🔐 ${data.ti}`;
  const meta = [`${data.p.length} Personen`];
  if (data.b) meta.push(`Budget ${data.b}`);
  if (data.d) meta.push(`Bescherung ${new Date(data.d + "T00:00:00").toLocaleDateString("de-DE")}`);
  meta.push(`ausgelost am ${new Date(data.at).toLocaleString("de-DE")}`);
  $("admin-meta").textContent = meta.join(" · ");

  const list = $("admin-pairs");
  list.innerHTML = "";
  for (const [giver, receiver] of data.p) {
    const li = document.createElement("li");
    const who = document.createElement("span");
    who.className = "who";
    who.append(`${giver} → `);
    const secret = document.createElement("button");
    secret.className = "secret";
    secret.title = "Antippen zum Aufdecken";
    secret.textContent = receiver;
    secret.addEventListener("click", () => secret.classList.toggle("shown"));
    who.append(secret);
    li.append(who, ...shareButtons(giver, participantUrl(giver, receiver, { title: data.ti, budget: data.b, date: data.d })));
    list.append(li);
  }

  $("admin-reveal-all").addEventListener("click", () => {
    const secrets = list.querySelectorAll(".secret");
    const show = [...secrets].some((s) => !s.classList.contains("shown"));
    secrets.forEach((s) => s.classList.toggle("shown", show));
    $("admin-reveal-all").textContent = show ? "🙈 Alle wieder verstecken" : "👀 Alle aufdecken";
  });
  $("admin-panel").classList.remove("hidden");
}

function shuffleAnimation() {
  const btn = $("draw");
  const labels = ["🎲 Zettel werden gemischt …", "🧦 Socken werden sortiert …", "🦌 Rentiere werden befragt …", "✅ Ausgelost!"];
  labels.forEach((l, i) => setTimeout(() => (btn.textContent = l), i * 450));
  setTimeout(() => {
    btn.textContent = "🎲 Nochmal auslosen";
    $("results").scrollIntoView({ behavior: "smooth" });
  }, labels.length * 450 + 600);
}

// ---------- Teilnehmer-Ansicht ----------

function initReveal(data) {
  $("reveal").classList.remove("hidden");
  if (data.ti) $("r-title").textContent = `🎄 ${data.ti}`;
  $("r-name").textContent = data.n;
  $("r-name2").textContent = data.n;
  $("r-yes").textContent = `Ich schwöre, ich bin ${data.n} 🤞`;

  const show = (step) => {
    for (const s of ["confirm", "gift", "wrong", "result"]) $(`r-step-${s}`).classList.toggle("hidden", s !== step);
  };

  $("r-no").addEventListener("click", () => show("wrong"));
  $("r-yes").addEventListener("click", () => show("gift"));

  const hints = ["Nochmal!", "Fester! 💪", "Fast …", "Es wackelt schon!"];
  const needed = 3 + Math.floor(Math.random() * 3);
  let taps = 0;
  $("gift").addEventListener("click", () => {
    taps++;
    const gift = $("gift");
    gift.classList.add("shake");
    setTimeout(() => gift.classList.remove("shake"), 350);
    if (taps < needed) {
      $("gift-hint").textContent = hints[Math.min(taps - 1, hints.length - 1)];
      return;
    }
    $("r-target").textContent = data.t;
    if (data.b) { $("r-budget").textContent = `💰 Budget: ${data.b}`; $("r-budget").classList.remove("hidden"); }
    renderCountdown(data.d);
    nextTip();
    $("r-elf").textContent = `Dein Wichtelname: ${pick(ELF_FIRST)} ${pick(ELF_LAST)} 🧝`;
    nextMeme();
    show("result");
    confetti();
  });

  $("r-tip-next").addEventListener("click", nextTip);
  $("meme-next").addEventListener("click", nextMeme);
}

function renderCountdown(date) {
  if (!date) return;
  const target = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  const el = $("r-countdown");
  el.textContent = days > 1 ? `📅 Noch ${days} Tage bis zur Bescherung`
    : days === 1 ? "📅 Morgen ist Bescherung! Schon eingepackt?"
    : days === 0 ? "🎉 Heute ist Bescherung!"
    : "🎄 Die Bescherung ist schon vorbei";
  el.classList.remove("hidden");
}

let lastTip = -1;
function nextTip() {
  let i;
  do { i = Math.floor(Math.random() * TIPS.length); } while (i === lastTip);
  lastTip = i;
  $("r-tip").textContent = TIPS[i];
}

let memeOrder = [];
let lastMeme = null;
const brokenMemes = new Set();

function nextMeme() {
  const img = $("meme-img");
  const emoji = $("meme-emoji");
  const working = MEMES.filter((m) => !brokenMemes.has(m));
  if (!working.length) {
    img.classList.add("hidden");
    emoji.classList.remove("hidden");
    emoji.textContent = "🎄";
    $("meme-next").classList.add("hidden");
    return;
  }
  $("meme-next").classList.toggle("hidden", working.length < 2);

  // Neue zufällige Runde, wenn alle einmal dran waren – ohne das letzte GIF direkt zu wiederholen
  memeOrder = memeOrder.filter((m) => !brokenMemes.has(m));
  if (!memeOrder.length) {
    memeOrder = shuffle(working);
    if (memeOrder.length > 1 && memeOrder[0] === lastMeme) memeOrder.push(memeOrder.shift());
  }
  const m = memeOrder.shift();
  lastMeme = m;

  // Platzhalter, bis das GIF geladen ist
  emoji.textContent = "⏳";
  emoji.classList.remove("hidden");
  img.classList.add("hidden");
  img.onload = () => { emoji.classList.add("hidden"); img.classList.remove("hidden"); };
  img.onerror = () => { brokenMemes.add(m); nextMeme(); };
  img.src = m;

  const card = $("meme");
  card.classList.remove("flip");
  void card.offsetWidth;
  card.classList.add("flip");
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- Schnee & Konfetti ----------

function fitCanvas(c) {
  c.width = innerWidth;
  c.height = innerHeight;
}

function snow() {
  const c = $("snow");
  const ctx = c.getContext("2d");
  fitCanvas(c);
  addEventListener("resize", () => fitCanvas(c));
  const flakes = Array.from({ length: 90 }, () => ({
    x: Math.random() * c.width, y: Math.random() * c.height,
    r: 1 + Math.random() * 3, s: 0.4 + Math.random(), w: Math.random() * Math.PI * 2,
  }));
  (function frame() {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const f of flakes) {
      f.y += f.s;
      f.w += 0.01;
      f.x += Math.sin(f.w) * 0.5;
      if (f.y > c.height) { f.y = -5; f.x = Math.random() * c.width; }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  })();
}

function confetti() {
  const c = $("confetti");
  const ctx = c.getContext("2d");
  fitCanvas(c);
  const colors = ["#c0392b", "#1e6b46", "#e8b64c", "#ffffff", "#2e86c1"];
  const parts = Array.from({ length: 160 }, () => ({
    x: c.width / 2, y: c.height / 3,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 2,
    size: 5 + Math.random() * 6, rot: Math.random() * 6, color: pick(colors),
  }));
  let t = 0;
  (function frame() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.3;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (++t < 220) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, c.width, c.height);
  })();
}

// ---------- Start ----------

snow();
const match = location.hash.match(/z=([\w-]+)/);
const adminMatch = location.hash.match(/admin=([\w-]+)/);
if (adminMatch) {
  initAdmin(adminMatch[1]);
} else if (match) {
  try { initReveal(decode(match[1])); }
  catch { document.body.insertAdjacentHTML("beforeend", "<p class='card' style='margin:20px auto'>Dieser Link ist leider kaputt. 🥲 Frag nochmal nach.</p>"); }
} else {
  initSetup();
}
