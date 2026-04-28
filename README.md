# Netzplan Editor

Eine Web-App, mit der du Netzpläne direkt im Browser erstellen und prüfen kannst.

## Lokal starten

1. Öffne [index.html](/C:/Codex/Netzplan/index.html) im Browser.
2. Trage pro Vorgang `ID`, `Bezeichnung`, `Dauer`, `Vorgänger` und bei Bedarf auch `FAZ`, `FEZ`, `SAZ`, `SEZ`, `GP`, `FP` ein.
3. Klicke auf `Prüfen & berechnen`.

## Funktionen

- Verschiebbare Vorgangskarten auf großer Arbeitsfläche
- Zoom per `Strg` + Mausrad
- Prüfung deiner eingetragenen Netzplanwerte
- Knopf zum Anzeigen der Lösung bei Fehlern
- JSON-Import und JSON-Export
- Läuft komplett ohne Serverlogik als statische Website

## Als Website veröffentlichen

Die App ist statisch und kann deshalb sehr leicht online gestellt werden.

### GitHub Pages

1. Erstelle auf GitHub ein neues Repository.
2. Öffne in diesem Ordner ein Terminal.
3. Führe diese Befehle aus:

```powershell
git init
git branch -M main
git add .
git commit -m "Netzplan Editor"
git remote add origin https://github.com/DEIN-NAME/DEIN-REPO.git
git push -u origin main
```

4. Öffne auf GitHub `Settings` → `Pages`.
5. Wähle bei `Source` die Option `GitHub Actions`.
6. Nach dem ersten Push wird die Website automatisch veröffentlicht.
7. Danach ist sie öffentlich über eine URL wie `https://dein-name.github.io/dein-repo/` erreichbar.

Die Datei [.nojekyll](/C:/Codex/Netzplan/.nojekyll) ist schon vorbereitet.
Der automatische Deploy ist in [.github/workflows/pages.yml](/C:/Codex/Netzplan/.github/workflows/pages.yml) vorbereitet.

### Netlify

1. Erstelle bei Netlify eine neue Site.
2. Verbinde dein GitHub-Repository oder ziehe den Ordner direkt in Netlify hinein.
3. Als Veröffentlichungsordner wird einfach das Projektverzeichnis verwendet.

Die Datei [netlify.toml](/C:/Codex/Netzplan/netlify.toml) ist schon vorbereitet.

## Hinweise

- Die App braucht kein Backend und keine Datenbank.
- Jeder mit der Website-URL kann sie im Browser öffnen.
- Wenn du willst, kann ich dir als Nächstes auch noch eine schöne Startseite mit Titel, Logo und Impressum/Kontakt vorbereiten, damit sie noch mehr wie eine richtige öffentliche Website wirkt.
