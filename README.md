# 🎁 Wunschliste

Meine persönliche Wunschliste für Weihnachten und Geburtstag – für Familie und Freunde, die fragen, was ich mir wünsche. Gleicher Aufbau wie die [Leseliste](https://github.com/michifrey/books): statische Seite auf GitHub Pages, kein Build-Schritt.

## Was die Seite zeigt

- Oben gross **Name und Jahr** („Michis Wunschliste 2026“) und das Datum der letzten Änderung – so sieht man sofort, dass die Liste aktuell ist. Ist das Jahr vorbei, erscheint ein Hinweis, lieber kurz nachzufragen.
- Grössen und Lieblingsfarben (`notes`) direkt im Kopf der Seite
- Karten mit **Produktbild aus dem Shop**, Preis und Shop
- Filter nach Kategorie und **Budget** (bis 25 · 25–50 · 50–100 · über 100 CHF), Suche, Sortierung nach Wichtigkeit oder Preis
- Detailseite (`#/<id>`) mit grossem Bild, Hinweis („am liebsten in Schwarz“) und **Buttons zu jedem Shop**
- Teilbare Links, Hell/Dunkel-Modus, mobil optimiert
- **„Ich besorge das“**: Wer etwas schenken will, reserviert den Wunsch. Die anderen sehen ihn dann als „Reserviert“ (mit Namen, falls angegeben) – so wird nichts doppelt gekauft. Aufheben kann nur, wer reserviert hat.
- **Überraschungsmodus** für mich: einmal `…/#ich` öffnen, dann blendet die Seite in diesem Browser alle Reservierungen aus.

## Wünsche pflegen

Alles steht in [`data/wishlist.json`](data/wishlist.json). Für ein neues Jahr `year` und `updated` anpassen.

Neuer Wunsch = neuer Eintrag in `items`:

```json
{
  "id": "eindeutige-id",
  "title": "Was ich mir wünsche",
  "brand": "Marke / Modell / Autor (optional)",
  "category": "technik",
  "priority": 1,
  "price": 49.9,
  "note": "Hinweis, z. B. Farbe oder Grösse (optional)",
  "size": "L (optional)",
  "color": "Dunkelblau (optional)",
  "shops": [
    { "name": "Galaxus", "url": "https://www.galaxus.ch/de/s1/product/…", "price": 47 },
    { "name": "Digitec", "url": "https://www.digitec.ch/de/s1/product/…" }
  ],
  "image": "https://… (optional – sonst automatisch vom Shop)",
  "related": ["andere-id"]
}
```

- `priority`: `1` = Top-Wunsch, `2` = würde mich sehr freuen, `3` = kleine Freude
- `category`: eine der `categories` oben in der Datei (dort lassen sich auch neue anlegen)
- `price` ist der ungefähre Preis; hat ein Shop einen eigenen `price`, zählt der günstigste.

### Bilder direkt aus dem Shop

Beim Veröffentlichen holt [`tools/fetch_images.py`](tools/fetch_images.py) für jeden Wunsch ohne `image` das Produktbild von der Shop-Seite (das Bild, das der Shop für Link-Vorschauen angibt) und speichert es unter `images/`. Dafür braucht es einen **Link auf die Produktseite**, nicht auf eine Suche.

Manche Shops (z. B. Amazon) blockieren solche Abrufe. Dann einfach im Shop mit Rechtsklick auf das Produktbild → „Bildadresse kopieren“ und als `image` eintragen.

Lokal ausprobieren (speichert die Bilder und trägt sie in die JSON ein):

```bash
python3 tools/fetch_images.py
```

## Reservierungen einrichten (einmalig, ca. 5 Minuten)

Die Reservierungen liegen in einem Google Sheet in meinem Google-Konto. Die Besucher brauchen kein Konto.

1. Neues Google Sheet anlegen, z. B. „Wunschliste Reservierungen“.
2. Im Sheet **Erweiterungen → Apps Script** öffnen, den Inhalt von [`tools/reservations.gs`](tools/reservations.gs) hineinkopieren und speichern.
3. **Bereitstellen → Neue Bereitstellung → Typ: Web-App**
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
   → Bereitstellen, Zugriff erlauben, die **Web-App-URL** (endet auf `/exec`) kopieren.
4. In [`data/wishlist.json`](data/wishlist.json) eintragen:
   ```json
   "reservations": { "url": "https://script.google.com/macros/s/…/exec" }
   ```
5. Committen und pushen. Ohne URL bleibt die Seite wie bisher, nur ohne Reservieren-Knopf.

Gut zu wissen:
- Das Sheet zeigt alle Reservierungen – um die Überraschung nicht zu verderben, einfach nicht hineinschauen. 🙂
- Eine Reservierung lässt sich nur im selben Browser aufheben, in dem sie gemacht wurde. Notfalls die Zeile im Sheet löschen.
- Reservierungen gelten pro Jahr: Mit einem neuen `year` ist die Liste wieder komplett frei.
- Wird `reservations.gs` geändert: **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Neue Version**, damit die URL gleich bleibt.

## Lokal ansehen

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Veröffentlichen

1. Branch nach `main` mergen.
2. Im Repo unter **Settings → Pages → Build and deployment → Source** „GitHub Actions“ wählen.
3. Der Workflow `.github/workflows/pages.yml` holt die Bilder und deployt bei jedem Push auf `main`.

## Ideen

- [x] „Ich besorge das“ reservieren, damit nichts doppelt geschenkt wird
- [ ] Mehrere Listen (z. B. für die Kinder)
