GP KOLLUND – Freight Rate Calculator Prototype v6.22

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


v6.15: Neues Entladestellen-Layout mit Suche, Filtern, Anlegen/Bearbeiten sowie vorgesehenem Excel-Import/Export. Noch ohne Backend; Datenänderungen sind Demo-Sessiondaten.


v6.15: Dienstleister-Modul als Layout-Demo ergänzt: KPI-Übersicht, Suche, Filter, Anlegen/Bearbeiten, Ansprechpartner, Tarifanzahl, Floater, Logo-Feld und Aktivstatus.


v6.15: Tarife-Modul als Layout-Demo ergänzt: Tarifübersicht, Filter, Preis/Floater/Gesamt, Relation, Transportart, Anlegen/Bearbeiten sowie vorgesehener Excel-Import/Export.


v6.15: Einstellungen-Modul als Layout-Demo ergänzt: Unternehmensprofil, Benutzer/Rollen, Branding, Domains und Systemoptionen.


v6.15: Modul Anfragen & Buchungen ergänzt: Vorgangsübersicht, Status, Filter, KPI, Detailansicht und Verlauf als Layout-Demo.


v6.15: Diesel/Floater-Verwaltung unter Tarife ergänzt. Zeiträume werden mit Gültig-von/bis, Periodentyp (Woche, 2 Wochen, Monat, Halbmonat, individuell), Wert, Dienstleister und Notiz als Historie dargestellt. Grundlage für spätere Rechnungsprüfung.


v6.15: Auswertungen/KPI-Dashboard ergänzt: Kalkulationen, Buchungen, Buchungsquote, Durchschnittspreis, Einsparung, offene Vorgänge, Transportkosten-Trend, Transportarten, Dienstleister-Performance, Diesel/Floater und Top-Relationen.


v6.15: Workflow-Verknüpfung ohne Backend ergänzt. Erfolgreiche Kalkulationen werden lokal im Browser gespeichert. Verfügbarkeitsanfragen und Buchungen aus der Kalkulation erzeugen automatisch einen Vorgang in "Anfragen & Buchungen". Das KPI-Dashboard berücksichtigt diese Demo-Daten ebenfalls. Speicherung erfolgt aktuell per localStorage und ist damit browser-/gerätebezogen; später wird dieselbe Logik an die zentrale Datenbank angebunden.


v6.15: Excel/CSV-Import und Excel-Export für Entladestellen, Dienstleister, Tarife und Diesel/Floater aktiviert. Importierte und manuell geänderte Daten werden lokal im Browser (localStorage) gespeichert. XLSX-Import/-Export verwendet SheetJS, das beim ersten Excel-Vorgang über CDN geladen wird; CSV-Import funktioniert ohne die Bibliothek.


v6.15: Rechnungsprüfung als neues Layout-/Workflow-Modul ergänzt. Unterstützt Datei-Upload als vorbereiteten Einstieg sowie manuelle Rechnungserfassung. Sollpreis wird aus Tarif und gültigem Floater ermittelt, Abweichung angezeigt und die Prüfung lokal gespeichert. PDF-/Excel-Inhaltserkennung folgt später.


v6.15 – Konsolidierungs-Version:
- Einheitliche Navigation auf allen Modulen.
- Gemeinsame lokale Speicher-Keys und Hilfsfunktionen über gpk-core.js.
- Importdaten werden bei Entladestellen, Dienstleistern, Tarifen und Floatern dedupliziert.
- Lokale Datenquellen sind zentral benannt und für den späteren Wechsel auf Backend/API vorbereitet.
- Einstellungen enthalten einen neuen Datenstatus-Bereich mit Übersicht der lokal gespeicherten Datensätze.
- Alle Seiten wurden auf Prototype v6.15 vereinheitlicht.


v6.15 – Daten-Admin:
- Komplettes lokales Backup als JSON herunterladen.
- Backup-Datei wiederherstellen.
- Gesamten lokalen Datenstand zurücksetzen.
- Einzelne Datenbereiche gezielt leeren.
- Import-Historie für Excel-/CSV-Importe anzeigen.
- Datenstatus und Adminfunktionen befinden sich unter Einstellungen.


v6.15 – Import-Manager:
- Importvorschau für Entladestellen, Dienstleister, Tarife und Diesel/Floater.
- Automatische Spaltenzuordnung anhand bekannter Bezeichnungen.
- Manuelle Spaltenzuordnung vor dem Import.
- Pflichtfeldprüfung und Fehleranzeige pro Zeile.
- Vorschau der ersten Datensätze.
- Dubletten werden beim bestätigten Import übersprungen.
- Import wird erst nach expliziter Bestätigung in den lokalen Datenbestand übernommen.


v6.15 – Backend-/Login-Grundlage:
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


v6.15 – Backend-Anbindung:
- Gemeinsamer Daten-Bridge-Layer über gpk-data.js.
- Entladestellen, Dienstleister, Tarife, Diesel/Floater, Kalkulationen, Vorgänge und Rechnungsprüfungen werden bei laufendem Backend automatisch mit SQLite synchronisiert.
- Beim ersten Backend-Start werden vorhandene lokale Demo-Daten in die Datenbank übernommen, wenn die jeweilige Tabelle noch leer ist.
- Bei vorhandenen Backend-Daten werden diese als zentrale Datenquelle in den Browser geladen.
- Dashboard-KPIs können direkt aus der Datenbank geladen werden.
- Ohne gestarteten Server funktioniert die bisherige Browser-Demo weiterhin.


v6.15: Benutzerverwaltung und Rollen (Admin, Disposition, Vertrieb, Controlling) ergänzt; Benutzer anlegen/bearbeiten/deaktivieren, Passwort setzen, Navigation nach Rolle einschränken.


v6.15 – Individuelle Rechte & Audit:
- Rollen sind Vorlagen; Rechte werden pro Benutzer gespeichert.
- Vollzugriff möglich.
- Aktivitätslog mit Benutzer, Zeitpunkt, Aktion und Referenz.
- Tour-Buchungen behalten ihren ursprünglichen Ersteller.
- Dashboard zeigt Buchungen, Buchungsvolumen und Ø Preis je Benutzer.


v6.15 – erste gemeinsame Seitenüberarbeitung:
- Navigation mit Hover-Effekt.
- Kalkulation erhält sichtbaren Seitenkopf.
- Anfragen & Buchungen: Zeitraumfilter Heute / Woche / Monat / 30 Tage / eigener Zeitraum.
- Dienstleister: Firmenadresse und mehrere Ansprechpartner mit mehreren E-Mail-Adressen, Verwendungszweck und Länderzuordnung.
- Tarife: sichtbare Unterbereiche Tarife / Diesel-Floater / Nebenkosten.
- Drei-Punkte-Menü bei Tarifen hat echte Aktionen: duplizieren und aktivieren/deaktivieren.
- Nebenkosten-Grundpflege mit Betrag/Prozent, Land, Zone, Transportart und Gültigkeit.


v6.15 – Seitenüberarbeitung:
- Kalkulation: Seitenkopf sitzt jetzt innerhalb derselben Karte wie das Formular; Modusauswahl im Kopfbereich.
- Anfragen & Buchungen: Zeitraum wird über einen sichtbaren Anwenden-Button bestätigt; KPI-Karten reagieren auf die aktuell gefilterte Ansicht.
- Entladestellen: Drei-Punkte-Menü funktioniert (Bearbeiten, Aktivieren/Deaktivieren, Löschen); Löschen zusätzlich direkt im Bearbeiten-Dialog.
- Dienstleister: Drei-Punkte-Menü und Löschfunktion ergänzt; beim Löschen werden zugehörige lokale Tarife/Floater nach Bestätigung mit entfernt.
- Tarife-Seite selbst wurde in diesem Schritt bewusst nicht weiter überarbeitet.


v6.15:
- Dienstleister-KPIs reagieren jetzt auf Suche, Status- und Tariffilter. Beispiel: Bei Filter „Inaktiv“ zeigen die KPI-Karten nur Werte der inaktiven Auswahl.
- Kalkulation wurde in Breite, oberem Abstand, Kartenkopf und Bedienelement-Höhe an Entladestellen sowie Anfragen & Buchungen angeglichen.
- Die Modus-Schalter in Kalkulation haben jetzt dieselbe kompakte Bedienhöhe wie die Aktionsbuttons der übrigen Seiten.


v6.15:
- Kalkulation nutzt jetzt exakt dasselbe äußere Workspace-Raster wie Anfragen & Buchungen, Entladestellen und Dienstleister.
- Gleicher Abstand zur Sidebar, gleicher Abstand nach oben und gleiche verfügbare Kartenbreite.
- Der Kalkulations-Card-Header verwendet weiterhin denselben Toolbar-Abstand wie die übrigen Modul-Seiten.


v6.15 – Dienstleister:
- Logos können im Dienstleister-Dialog als PNG/JPG/WebP hochgeladen und lokal gespeichert werden.
- Hochgeladene Logos werden in der Dienstleisterliste angezeigt; ohne Logo bleibt das Kürzel als Fallback.
- Tarif-Länder eines Dienstleisters werden automatisch aus den hinterlegten Tarifen ermittelt.
- Ansprechpartner können nur aus den tatsächlich vorhandenen Tarif-Ländern wählen oder „Alle Tarifländer“ verwenden.
- In der Dienstleisterliste werden die vorhandenen Tarif-Länder beim Ansprechpartner angezeigt.
- Unter der Tarifanzahl steht jetzt „+ Tarif hinzufügen“ statt „Tarife hinterlegt“.
- „+ Tarif hinzufügen“ öffnet die Tarifseite direkt mit dem betreffenden Dienstleister und dem Dialog „Neuer Tarif“.


v6.15:
- Dienstleister-Seite repariert; Liste, Neuer Dienstleister, Import/Export funktionieren wieder.
- Logo-Upload und Tarif-Länder bleiben erhalten.
- Nebenkosten unterstützen Pauschale, Prozent, €/km, €/Lademeter, €/Stunde, €/Stopp und €/Palette sowie automatisch/bei Bedarf.


v6.15 – Fehlerkorrektur / Layout-Konsolidierung:
- Alle Hauptseiten verwenden jetzt denselben äußeren Seitenabstand, dieselbe maximale Breite und denselben oberen Abstand.
- Dienstleister: Tarifanzahl wird robust aus dem lokalen Tarifbestand gelesen; wenn noch kein Tarifbestand initialisiert ist, bleibt der vorhandene Zähler erhalten.
- Dienstleister: aktueller Diesel/Floater wird aus den zeitabhängigen Floater-Zeiträumen ermittelt und angezeigt.
- Dienstleister-Dialog schließt nicht mehr beim Klick neben das Fenster. Der X-Button wurde entfernt; geschlossen wird über Abbrechen, Speichern oder bewusstes Löschen.
- Auch andere Bearbeitungsdialoge schließen nicht mehr versehentlich per Backdrop-Klick.
- Tarife wurden inhaltlich nicht weiter überarbeitet.


v6.15 – Automatische Tariferkennung (Step 1)
- Tarife > „Tarif automatisch importieren“ akzeptiert XLSX/XLS/XLSM/XLSB/CSV.
- Erkennt erste Rate-Modelle automatisch: WEIGHT_STEP, PER_KG, PER_100KG, LDM_STEP, PER_LDM, PALLET_STEP, PER_PALLET, DISTANCE_STEP, PER_KM, FIXED_RELATION, FULL_LOAD, PACKAGE_WEIGHT_ZONE.
- Zerlegt erkannte Tabellenblöcke, bewertet Confidence und trennt AUTO_CANDIDATE von REVIEW.
- Normalisiert Preiszeilen in gpk_demo_rate_output_v1.
- Normalisiert PLZ-/Länder-/Fixrelations-Zonen in gpk_demo_zone_rules_v1.
- Separate Exportbuttons für normalisierte Raten und Zonen (für das andere Tool).
- Alte manuelle Tarifpflege bleibt unverändert und wird nicht mit Tausenden Matrixzellen überladen.
- Scope bewusst begrenzt: Params/Sperrigkeit, Nebenkosten und Floater folgen nach Preis-/Zonenlogik.

v6.15 – Tarifimport / Benchmark-Ausgabe
- bestätigte Autoimporte erscheinen zusätzlich in der normalen Tarifübersicht unten
- pro Import: direkter Benchmark-Vordruck-Export und Zonen-CSV
- Benchmark-Export im etablierten Aufbau mit Sheets Rates + Zones
- Rates: Forwarder/Product/Service/Sub-Service/Version/Cost Item/CLL Type/Origin/Dest/CHG from-to/step/per/Unit/base + Zone 1..150
- Zones: etablierte Zonenstruktur mit Forwarder/Product/Service/Sub-Service/Version/.../Dest From/To/Zone/Label
- interne normalisierte Preislogik bleibt unverändert als Datenbasis


v6.22 – Multi-Rate Preisrechner:
- Freigegebene Autoimporte können jetzt WEIGHT_STEP, PER_KG, PER_100KG, LDM_STEP, PER_LDM, PALLET_STEP, PER_PALLET, FULL_LOAD und PACKAGE_WEIGHT_ZONE an den Preisrechner übergeben.
- Kalkulation um Gewicht sowie Paletten/Stellplätze erweitert.
- Direkte €/kg-, €/100kg-, €/LDM- und €/Palette-Logik wird im Preisrechner berechnet; Staffelmodelle wählen den passenden Fixpreis.
- Distanz-/km-Tarife bleiben bewusst außen vor, bis eine verlässliche Kilometerquelle angebunden ist.


v6.22 – Sperrigkeits-/Frachtgewichtslogik (erste Stufe):
- Autoimport erkennt zusätzliche Umrechnungsregeln aus einem Benchmark-Params-Blatt (z. B. kg/m³, kg/LDM, Mindestgewicht je Palette, LDM ab x Paletten, nicht stapelbar).
- Freigegebene Regeln werden zusammen mit dem Tarifset an den Preisrechner übergeben.
- Die Regeln greifen bewusst nur bei gewichtsbasierten Tarifmodellen (WEIGHT_STEP, PER_KG, PER_100KG). Stellplatz- und LDM-Offerten werden nicht pauschal mit Gewichtssperrigkeit belastet.
- Kalkulation hat neue optionale Eingaben Volumen (m³) und Nicht stapelbar.
- Der Preisrechner ermittelt je Dienstleister das frachtpflichtige Gewicht aus den tatsächlich vorhandenen Regeln und zeigt die angewandte Basis in der Angebotskarte.
- Ohne erkannte/freigegebene Params bleibt die bisherige Berechnung unverändert; es werden keine generischen Sperrigkeitsfaktoren erfunden.

v6.22 – Importprüfung als Ratenblatt
- Autoimport-Vorschau nach Land und Tarifbereich filterbar.
- Ratenblatt als Matrix mit von/bis/Einheit und Zonen als Spalten.
- Zonenheader zweizeilig, z. B. DE01 / Zone 1.
- Separates Zonenblatt pro Land/Bereich bleibt verfügbar.
- Sperrigkeiten/Umrechnungen werden beim Tarifimport nicht angewendet und bei neuen Importen nicht mitgeführt; sie gehören ausschließlich in die spätere Kalkulation.
