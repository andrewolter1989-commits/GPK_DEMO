GP Kollund Preisrechner Demo – Version 1

Grundlage:
- Trocellen: Länder-/PLZ-Zonen, Transportarten Teilladung/FTL/Mega/Jumbo, Lademeter, Tarifbänder, Minimumfracht, Floater, Spediteursvergleich.
- Pano: Auswahl einer bekannten Entladestelle anhand Land + PLZ sowie Möglichkeit, einen neuen Empfänger manuell einzugeben.

Start lokal:
1. Ordner entpacken.
2. Im Ordner einen lokalen Webserver starten, z. B. mit Python:
   python -m http.server 8080
3. Browser öffnen: http://localhost:8080

Hinweis:
Die Demo ist bewusst ohne Backend gebaut. Die Entladestellen werden direkt aus data/Adressen.csv geladen.
