// Familien-Wichteln – läuft komplett im Browser, ohne Server.
// Auslosung, Links und Verschlüsselung stecken in lib.js.

const $ = (id) => document.getElementById(id);
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

    let result;
    try { result = await createDraw(values, $("admin-pw").value, location.href.split("#")[0]); }
    catch (e) { return showError(e.message); }

    renderLinks(result.links, result.id);
    renderAdminLink(result.adminUrl);
    shuffleAnimation();
  });
}

function showError(msg) {
  $("error").textContent = msg;
  $("results").classList.add("hidden");
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

function renderLinks(links, id) {
  const list = $("links");
  list.innerHTML = "";
  for (const { giver, url } of links) {
    const li = document.createElement("li");
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = `🎁 ${giver}`;
    li.append(who, ...shareButtons(giver, url));
    list.append(li);
  }
  $("draw-id").textContent = id;
  $("results").classList.remove("hidden");
}

// ---------- Admin-Link: komplette Auslosung, mit Passwort verschlüsselt ----------

function renderAdminLink(url) {
  const box = $("admin-link-box");
  if (!url) return box.classList.add("hidden");
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
  if (data.id) meta.push(`Auslosungs-Code ${data.id}`);
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
    li.append(who, ...shareButtons(giver, participantUrl(location.href.split("#")[0], giver, receiver, adminInfo(data))));
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
  if (data.id) $("r-draw-id").textContent = `Auslosungs-Code: ${data.id}`;

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
