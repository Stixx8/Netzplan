# 🕸️ Netzplan Editor

Ein interaktives Web-Tool zur Erstellung, Berechnung und Visualisierung von Netzplänen (Projektmanagement). Diese App hilft dabei, Vorgänge logisch zu verknüpfen und wichtige Kennzahlen wie den kritischen Pfad zu ermitteln.

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen.svg)](https://stixx8.github.io/Netzplan/)
[![Hosting: GitHub Pages](https://img.shields.io/badge/Host-GitHub%20Pages-blue)](https://stixx8.github.io/Netzplan/)

---

## 🚀 Funktionen

* **Interaktive Erstellung:** Vorgänge direkt im Browser hinzufügen und bearbeiten.
* **Automatische Berechnung:** Ermittlung von:
    * Frühestem Anfangs- & Endzeitpunkt (FAZ/FEZ)
    * Spätestem Anfangs- & Endzeitpunkt (SAZ/SEZ)
    * Gesamtpuffer (GP) und freiem Puffer (FP)
* **Drag & Drop:** Frei verschiebbare Vorgangskarten auf einer großen Arbeitsfläche.
* **Import/Export:** Speichern und Laden von Projekten als JSON-Datei.
* **Zoom & Navigation:** Komfortable Steuerung mittels Mausrad und Tastenkombinationen.
* **Kein Server nötig:** Läuft komplett clientseitig als statische Website.

---

## 🛠️ Installation & Lokale Entwicklung

Da das Projekt nur aus statischen Dateien besteht, ist keine komplexe Installation nötig.

1.  **Repository klonen:**
    ```bash
    git clone [https://github.com/Stixx8/Netzplan.git](https://github.com/Stixx8/Netzplan.git)
    ```
2.  **Starten:**
    Einfach die `index.html` in einem modernen Browser deiner Wahl öffnen.

---

## 📂 Projektstruktur

* `index.html`: Das Grundgerüst der Anwendung.
* `styles.css`: Design der Benutzeroberfläche und der Netzplan-Karten.
* `app.js`: Die Logik zur Berechnung der Zeitwerte und die UI-Interaktionen.
* `.nojekyll`: Deaktiviert Jekyll für GitHub Pages (wichtig für die korrekte Pfad-Verarbeitung).
* `netlify.toml`: Konfigurationsdatei für das Deployment auf Netlify (optional).

---

## 📝 Bedienung

1.  Trage für jeden Vorgang eine **ID**, eine **Bezeichnung** und die **Dauer** ein.
2.  Definiere die **Vorgänger** (IDs kommagetrennt), um die Abhängigkeiten zu erzeugen.
3.  Klicke auf **Prüfen & berechnen**, um die Netzplan-Werte zu aktualisieren.
4.  Nutze `Strg` + `Mausrad`, um in die Ansicht hinein- oder herauszuzoomen.

---

## 🏗️ Geplante Features / To-Do

- [ ] Visualisierung des kritischen Pfads (Markierung der kritischen Vorgänge).
- [ ] Export der Ansicht als PDF oder Bild.
- [ ] Unterstützung für verschiedene Kalendermodelle.

---

## 📄 Lizenz

Dieses Projekt wurde zu Bildungszwecken erstellt. Siehe die Dateien im Repository für weitere Details.

---
*Erstellt von [Stixx8](https://github.com/Stixx8)*
