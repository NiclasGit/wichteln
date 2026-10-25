# 🎁 Familien-Wichteln

Ein kleines Online-Tool zum Wichteln mit der Familie – ganz ohne Server, Anmeldung oder Datenbank.

## So funktioniert's

1. Seite öffnen, alle Namen eintragen (optional: Paare, die sich nicht ziehen sollen, Budget, Datum der Bescherung).
2. **Auslosen** klicken.
3. Jede Person bekommt ihren **eigenen geheimen Link** (per „Link kopieren“ oder direkt per WhatsApp).
4. Wer den Link öffnet, muss schwören, dass er es wirklich ist 🤞, das Päckchen ein paar Mal schütteln – und sieht dann, wen er beschenkt. Mit Konfetti. 🎉

Die Zuteilung steckt verschlüsselt im Link selbst. Für die Familie reicht das völlig – wer unbedingt schummeln will, könnte es technisch entschlüsseln. Der Organisator sieht die Zuteilung nicht und kann selbst mitmachen.

## 🔐 Admin-Bereich (nur für dich)

Beim Auslosen ein **Admin-Passwort** eintragen. Danach gibt's zusätzlich einen **Admin-Link**:

- Er enthält die komplette Auslosung, verschlüsselt mit deinem Passwort (AES-256-GCM, Schlüssel per PBKDF2 aus dem Passwort abgeleitet) – ohne Passwort ist nichts lesbar.
- Nach dem Login siehst du, wer wen beschenkt. Die Namen sind verschwommen und werden erst beim Antippen aufgedeckt, damit du dich nicht aus Versehen selbst spoilerst.
- Hat jemand seinen Link verloren, kannst du ihn dort nochmal verschicken.

Das Passwort wird nirgends gespeichert. Vergisst du es, kann niemand die Auslosung wiederherstellen – auch du nicht.

## Extras

- Familienfoto als Hintergrund
- Schneefall ❄️
- Päckchen schütteln & Konfetti beim Aufdecken
- „Bist du's wirklich?“-Abfrage gegen versehentliches Spicken
- Countdown bis zur Bescherung & Budget-Anzeige
- Zufällige Wichtel-Tipps und ein persönlicher Wichtelname 🧝
- Weihnachts-GIFs zum Durchklicken 🦌

## GIFs einbauen

Die GIFs stehen in `app.js` in der Liste `MEMES` und werden genau in dieser Reihenfolge gezeigt („Nächstes GIF“ springt eins weiter, am Ende geht's von vorn los). Links, die nicht laden, werden übersprungen.

```js
const MEMES = [
  "https://media.giphy.com/media/WmkqburJqXziM/giphy.gif",
  "assets/memes/opa-mit-muetze.jpg",
];
```

Den Link zu einem GIPHY-GIF bekommst du so: die ID ist der Teil nach dem letzten Bindestrich in `giphy.com/gifs/...-WmkqburJqXziM` → `https://media.giphy.com/media/WmkqburJqXziM/giphy.gif`.

## Familienfoto einbauen

Das Foto als `assets/family.jpg` ablegen – fertig. Ohne Foto gibt's einen winterlichen Farbverlauf.

> ⚠️ Wenn das Repo öffentlich ist, ist auch das Foto öffentlich sichtbar.

## Online stellen (GitHub Pages)

Im Repo unter **Settings → Pages** als Quelle den Branch `main` und den Ordner `/ (root)` wählen.
Danach ist die Seite unter `https://<benutzername>.github.io/wichteln/` erreichbar.

Lokal testen: einfach `index.html` im Browser öffnen.
