GP KOLLUND – Freight Rate Calculator Prototype v4.0

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


v4.0: Neues Entladestellen-Layout mit Suche, Filtern, Anlegen/Bearbeiten sowie vorgesehenem Excel-Import/Export. Noch ohne Backend; Datenänderungen sind Demo-Sessiondaten.
