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

function draw(names, excluded) {
  for (let attempt = 0; attempt < 10000; attempt++) {
    const receivers = shuffle(names);
    const ok = names.every((giver, i) => giver !== receivers[i] && !excluded.has(giver + "\u0000" + receivers[i]));
    if (ok) return names.map((giver, i) => [giver, receivers[i]]);
  }
  return null;
}

// ---------- Organisator-Ansicht ----------

function initSetup() {
  $("setup").classList.remove("hidden");

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    for (const f of ["title", "names", "exclusions", "budget", "date"]) if (saved[f]) $(f).value = saved[f];
  } catch {}

  $("draw").addEventListener("click", () => {
    $("error").textContent = "";
    const values = {};
    for (const f of ["title", "names", "exclusions", "budget", "date"]) values[f] = $(f).value.trim();
    try { localStorage.setItem(STORAGE, JSON.stringify(values)); } catch {}

    const names = [...new Set(values.names.split("\n").map((s) => s.trim()).filter(Boolean))];
    if (names.length < 3) return showError("Mindestens 3 Leute, sonst ist's kein richtiges Wichteln. 😉");

    let excluded;
    try { excluded = parseExclusions(values.exclusions, names); }
    catch (e) { return showError(e.message); }

    const pairs = draw(names, excluded);
    if (!pairs) return showError("Mit diesen Ausschlüssen geht's leider nicht auf. Lockert die Regeln ein bisschen!");

    renderLinks(pairs, values);
    shuffleAnimation();
  });
}

function showError(msg) {
  $("error").textContent = msg;
  $("results").classList.add("hidden");
}

function renderLinks(pairs, values) {
  const base = location.href.split("#")[0];
  const list = $("links");
  list.innerHTML = "";
  for (const [giver, receiver] of pairs) {
    const url = `${base}#z=${encode({ n: giver, t: receiver, ti: values.title, b: values.budget, d: values.date })}`;
    const msg = `Hallo ${giver}! 🎅 Hier ist dein geheimer Wichtel-Zettel: ${url}`;

    const li = document.createElement("li");
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = `🎁 ${giver}`;

    const copy = document.createElement("button");
    copy.textContent = "Link kopieren";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(url); copy.textContent = "Kopiert ✓"; }
      catch { prompt("Link kopieren:", url); }
    });

    const wa = document.createElement("a");
    wa.className = "wa";
    wa.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.textContent = "WhatsApp";

    li.append(who, copy, wa);
    list.append(li);
  }
  $("results").classList.remove("hidden");
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
    show("result");
    confetti();
  });

  $("r-tip-next").addEventListener("click", nextTip);
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
if (match) {
  try { initReveal(decode(match[1])); }
  catch { document.body.insertAdjacentHTML("beforeend", "<p class='card' style='margin:20px auto'>Dieser Link ist leider kaputt. 🥲 Frag nochmal nach.</p>"); }
} else {
  initSetup();
}
