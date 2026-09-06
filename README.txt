GP KOLLUND – Freight Rate Calculator Prototype v6.3

Diese Version baut auf der funktionsfähigen Demo v1 auf.

Unverändert:
- Trocellen Tarif-/Zonenlogik
- Transportarten Teilladung / FTL / Mega / Jumbo
- Minimumfracht und Floater
- Dienstleistervergleich
- Pano Entladestellen-/Empfängerlogik
- Anfrage- und Buchungs-E-Mail-Logik

Neu in v2:
- Produktorientiertes SaaS-Layout
- kompakte Navigation für spätere Module
- Workflow in 3 Schritten: Ziel, Transport, Termin & Details
- professionellere Ergebnis-/Bestpreis-Darstellung
- responsive Darstellung für Desktop/Tablet/Mobil

Lokaler Start:
Die Dateien über einen lokalen HTTP-Server ausliefern, z.B. im Projektordner:
python -m http.server 8000
Danach im Browser http://localhost:8000 öffnen.


v6.3: Neues Entladestellen-Layout mit Suche, Filtern, Anlegen/Bearbeiten sowie vorgesehenem Excel-Import/Export. Noch ohne Backend; Datenänderungen sind Demo-Sessiondaten.


v6.3: Dienstleister-Modul als Layout-Demo ergänzt: KPI-Übersicht, Suche, Filter, Anlegen/Bearbeiten, Ansprechpartner, Tarifanzahl, Floater, Logo-Feld und Aktivstatus.


v6.3: Tarife-Modul als Layout-Demo ergänzt: Tarifübersicht, Filter, Preis/Floater/Gesamt, Relation, Transportart, Anlegen/Bearbeiten sowie vorgesehener Excel-Import/Export.


v6.3: Einstellungen-Modul als Layout-Demo ergänzt: Unternehmensprofil, Benutzer/Rollen, Branding, Domains und Systemoptionen.


v6.3: Modul Anfragen & Buchungen ergänzt: Vorgangsübersicht, Status, Filter, KPI, Detailansicht und Verlauf als Layout-Demo.


v6.3: Diesel/Floater-Verwaltung unter Tarife ergänzt. Zeiträume werden mit Gültig-von/bis, Periodentyp (Woche, 2 Wochen, Monat, Halbmonat, individuell), Wert, Dienstleister und Notiz als Historie dargestellt. Grundlage für spätere Rechnungsprüfung.


v6.3: Auswertungen/KPI-Dashboard ergänzt: Kalkulationen, Buchungen, Buchungsquote, Durchschnittspreis, Einsparung, offene Vorgänge, Transportkosten-Trend, Transportarten, Dienstleister-Performance, Diesel/Floater und Top-Relationen.


v6.3: Workflow-Verknüpfung ohne Backend ergänzt. Erfolgreiche Kalkulationen werden lokal im Browser gespeichert. Verfügbarkeitsanfragen und Buchungen aus der Kalkulation erzeugen automatisch einen Vorgang in "Anfragen & Buchungen". Das KPI-Dashboard berücksichtigt diese Demo-Daten ebenfalls. Speicherung erfolgt aktuell per localStorage und ist damit browser-/gerätebezogen; später wird dieselbe Logik an die zentrale Datenbank angebunden.


v6.3: Excel/CSV-Import und Excel-Export für Entladestellen, Dienstleister, Tarife und Diesel/Floater aktiviert. Importierte und manuell geänderte Daten werden lokal im Browser (localStorage) gespeichert. XLSX-Import/-Export verwendet SheetJS, das beim ersten Excel-Vorgang über CDN geladen wird; CSV-Import funktioniert ohne die Bibliothek.


v6.3: Rechnungsprüfung als neues Layout-/Workflow-Modul ergänzt. Unterstützt Datei-Upload als vorbereiteten Einstieg sowie manuelle Rechnungserfassung. Sollpreis wird aus Tarif und gültigem Floater ermittelt, Abweichung angezeigt und die Prüfung lokal gespeichert. PDF-/Excel-Inhaltserkennung folgt später.


v6.3 – Konsolidierungs-Version:
- Einheitliche Navigation auf allen Modulen.
- Gemeinsame lokale Speicher-Keys und Hilfsfunktionen über gpk-core.js.
- Importdaten werden bei Entladestellen, Dienstleistern, Tarifen und Floatern dedupliziert.
- Lokale Datenquellen sind zentral benannt und für den späteren Wechsel auf Backend/API vorbereitet.
- Einstellungen enthalten einen neuen Datenstatus-Bereich mit Übersicht der lokal gespeicherten Datensätze.
- Alle Seiten wurden auf Prototype v6.3 vereinheitlicht.


v6.3 – Daten-Admin:
- Komplettes lokales Backup als JSON herunterladen.
- Backup-Datei wiederherstellen.
- Gesamten lokalen Datenstand zurücksetzen.
- Einzelne Datenbereiche gezielt leeren.
- Import-Historie für Excel-/CSV-Importe anzeigen.
- Datenstatus und Adminfunktionen befinden sich unter Einstellungen.


v6.3 – Import-Manager:
- Importvorschau für Entladestellen, Dienstleister, Tarife und Diesel/Floater.
- Automatische Spaltenzuordnung anhand bekannter Bezeichnungen.
- Manuelle Spaltenzuordnung vor dem Import.
- Pflichtfeldprüfung und Fehleranzeige pro Zeile.
- Vorschau der ersten Datensätze.
- Dubletten werden beim bestätigten Import übersprungen.
- Import wird erst nach expliziter Bestätigung in den lokalen Datenbestand übernommen.


v6.3 – Backend-/Login-Grundlage:
- Lokaler Node.js-/Express-Server.
- SQLite-Datenbank mit Tabellen für Mandanten, Benutzer, Entladestellen, Dienstleister, Tarife, Floater, Vorgänge, Kalkulationen und Rechnungsprüfungen.
- Login mit bcrypt-Passworthash und JWT-Session-Cookie.
- Demo-Benutzer: admin@gpk.local / demo1234.
- API-Grundgerüst für Stammdaten.
- Frontend erkennt automatisch, ob der Backend-Server läuft. Ohne Server bleibt die bisherige lokale Demo nutzbar.
- Einstellungen enthalten einen neuen Backend-Status-/Setup-Bereich.

Lokaler Start:
1. Node.js installieren.
2. Im Projektordner: npm install
3. npm start
4. http://localhost:3000 öffnen


v6.3 – Backend-Anbindung:
- Gemeinsamer Daten-Bridge-Layer über gpk-data.js.
- Entladestellen, Dienstleister, Tarife, Diesel/Floater, Kalkulationen, Vorgänge und Rechnungsprüfungen werden bei laufendem Backend automatisch mit SQLite synchronisiert.
- Beim ersten Backend-Start werden vorhandene lokale Demo-Daten in die Datenbank übernommen, wenn die jeweilige Tabelle noch leer ist.
- Bei vorhandenen Backend-Daten werden diese als zentrale Datenquelle in den Browser geladen.
- Dashboard-KPIs können direkt aus der Datenbank geladen werden.
- Ohne gestarteten Server funktioniert die bisherige Browser-Demo weiterhin.


v6.3: Benutzerverwaltung und Rollen (Admin, Disposition, Vertrieb, Controlling) ergänzt; Benutzer anlegen/bearbeiten/deaktivieren, Passwort setzen, Navigation nach Rolle einschränken.


v6.3 – Individuelle Rechte & Audit:
- Rollen sind Vorlagen; Rechte werden pro Benutzer gespeichert.
- Vollzugriff möglich.
- Aktivitätslog mit Benutzer, Zeitpunkt, Aktion und Referenz.
- Tour-Buchungen behalten ihren ursprünglichen Ersteller.
- Dashboard zeigt Buchungen, Buchungsvolumen und Ø Preis je Benutzer.
