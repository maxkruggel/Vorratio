# Deep-Research-Bericht: Rechtslage der inoffiziellen Picnic-API für Vorratio

Recherche 5 · Stand: 01.08.2026 · Neuauflage, unabhängig von den Annahmen der Projektdoku erstellt.
Vier parallele Recherche-Stränge: (1) Picnic-AGB, (2) deutsche/EU-Rechtslage, (3) Zustand des
Community-API-Ökosystems, (4) reale Durchsetzungsfälle. **Keine Rechtsberatung** – Einordnung auf
Basis öffentlich zugänglicher Quellen, Rechtsprechung und Kommentarliteratur.

## TL;DR

- **Für Maxens Szenario – Privatnutzer, eigenes Konto, Login + 2FA mit eigenen Zugangsdaten, Abruf der eigenen Bestellhistorie und Befüllen des eigenen Warenkorbs – ist das rechtliche Risiko niedrig.** Strafrecht greift nicht (eigene Daten, keine Überwindung einer Sicherung), Urheber-/Datenbankrecht nicht (keine wesentliche Entnahme), UWG nicht (keine geschäftliche Handlung). Das realistische Maximalrisiko ist rein zivilrechtlich: **Kontosperrung durch Picnic**.
- **Es gibt weltweit keinen einzigen dokumentierten Fall, in dem ein Privatnutzer mit eigenem Konto wegen inoffizieller API-Nutzung juristisch belangt wurde.** Klagen treffen kommerzielle Weiterverwerter (Instacart/Cornershop, Air Canada/Seats.aero); Abmahnungen treffen die *Veröffentlichung* (Repos/Maintainer: Haier/hOn, Mazda); Lebensmittelhändler in DE/NL/AT reagieren ausschließlich technisch (API-Änderung, mTLS, Login-Verschärfung).
- **Picnic duldet die Community-Clients seit ~2019 stillschweigend** – keine Takedowns, keine C&Ds, keine Bans auffindbar; die Home-Assistant-Core-Integration läuft offiziell (seitens HA) auf der inoffiziellen Bibliothek. Aber: 1–3 brechende API-Änderungen pro Jahr, seit Anfang 2026 faktisch 2FA-Pflicht. Die Anbindung muss als gekapseltes, ausfalltolerantes Modul gebaut werden.
- **Rote Linien, die das Risikobild ändern würden:** systematischer Massenabruf des Sortiments (§§ 87a ff. UrhG), Umgehung echter technischer Schutzmaßnahmen (gibt es bei Picnic derzeit nicht – anders als REWEs mTLS), und ein kommerzieller Marktgang, der Picnic-Konten Dritter automatisiert (dann UWG + C&D-Risiko).

## Key Findings

### 1. Picnic-AGB: kein explizites Bot-Verbot, aber Lizenz nur für die offizielle App

- Vertragskonstellation: Warenkauf mit der **Picnic GmbH** (Düsseldorf), Nutzungsvertrag über App/Dienste mit der **Picnic Technologies B.V.** (NL). Deutsche AGB: `https://picnic.app/de/agb/` (Teile I–V); niederländische Fassung zuletzt aktualisiert 16.02.2026.
- **Kein ausdrückliches Scraping-/Bot-/„nur offizielle App"-Verbot** in den AGB nachweisbar. Die Abdeckung läuft indirekt über die Lizenzklausel: eingeräumt wird nur ein „nicht-exklusives, nicht übertragbares und nicht unterlizenzierbares Recht, die App auf deinem Smartphone oder Tablet zu nutzen" – Zugriff auf die Backend-Endpunkte außerhalb der App ist davon nicht gedeckt.
- **Explizites Reverse-Engineering-Verbot**: Die App darf „nicht disassembliert, dekompiliert oder einem Reverse Engineering unterzogen" werden (DE + NL wortgleich). Relevant für eigenes Dekompilieren – die Nutzung fertiger Community-Clients erfordert kein eigenes Reverse Engineering.
- **Sanktionsrahmen**: Bei Missbrauch temporäre oder permanente Kontosperrung/-löschung, bei Wiederholung Aufnahme auf eine interne Sperrliste; automatisierte Fraud-Systeme können Bestellungen stornieren oder Konten sperren. **Keine Schadensersatz- oder Vertragsstrafenklauseln gefunden.** Konto-Teilung im Haushalt ist sogar ausdrücklich vorgesehen (eigener AGB-Teil „Family").
- **Keine offizielle API, kein Entwicklerprogramm, keine offiziellen Integrationen** (Stand 08/2026).
- *Methodischer Vorbehalt:* Der AGB-Volltext war aus der Recherche-Umgebung nicht direkt abrufbar (Proxy-Sperre); Klauseln wurden über Suchindex-Snippets und Exakt-Phrasen-Treffer verifiziert. Vor einer finalen Entscheidung einmal am Original gegenlesen.

### 2. Deutsche/EU-Rechtslage: privat unkritisch, Grenzen klar benennbar

| Rechtsgebiet | Risiko (privater Fall) | Kernaussage |
|---|---|---|
| § 202a StGB (Ausspähen) | **niedrig** | Eigene Bestelldaten sind „für den Täter bestimmt"; Login mit eigenen gültigen Zugangsdaten + 2FA ist bestimmungsgemäße Nutzung, kein „Überwinden" einer Sicherung. Abgrenzung: LG Aachen 60 Qs 16/23 („Modern Solution") betraf fremde Kundendaten via verstecktem Fremdpasswort – nicht übertragbar. |
| §§ 303a/b StGB | **niedrig** | Warenkorb-Befüllung im eigenen Konto ist autorisierte Datenänderung; Computersabotage scheidet mangels Störung aus (anders nur bei DoS-artigen Request-Massen). |
| §§ 87a ff. UrhG (Datenbankrecht) | **niedrig** privat / **mittel–hoch** bei Sortiments-Spiegelung | Eigene Bestellhistorie = quantitativ unwesentlich. Kritisch erst bei systematischem Komplettabruf des Katalogs (BGH I ZR 159/10 „Automobil-Onlinebörse"; EuGH C-762/19 „CV-Online Latvia"). |
| § 95a UrhG (techn. Schutzmaßnahmen) | **praktisch nicht einschlägig** | Schützt Werke, nicht Kundenkonten; Login mit eigenen Daten ist Nutzung, nicht Umgehung. Picnic hat zudem keine mTLS-/Attestation-Sperre (anders als REWE seit 03/2024). |
| UWG | **unanwendbar** privat | Setzt geschäftliche Handlung voraus. Maßstab für den kommerziellen Fall bleibt BGH I ZR 224/12 „Flugvermittlung im Internet" (2014): Scraping zulässig, solange keine technische Schutzvorrichtung umgangen wird; AGB sind keine technische Schutzmaßnahme. Keine neuere BGH-Leitentscheidung zu App-APIs hinter Login/2FA. |
| Vertragsrecht/AGB | **mittel – das reale Risiko** | Folge eines Verstoßes ist rein zivilrechtlich: Abmahnung, Kündigung, Sperrung („virtuelles Hausrecht"). Schadensersatz scheidet mangels bezifferbaren Schadens faktisch aus. Pauschale „nur offizielle App"-Verbote gegenüber Verbrauchern wären nach §§ 305c, 307 BGB angreifbar (ungeklärt); Picnic hat ohnehin keines. Größtes praktisches Risiko: **automatische Sperrung durch Fraud-Erkennung bei ungewöhnlichen Zugriffsmustern.** |
| EU Data Act (VO 2023/2854) | **nicht einschlägig** | Gilt für vernetzte Produkte/IoT; eine Shopping-App fällt nicht darunter – verschafft keinen API-Anspruch, verschärft aber auch nichts. |
| DSGVO Art. 15/20 | **wirkt zugunsten des Nutzers** | Anspruch auf Kopie/portable Herausgabe der eigenen Bestellhistorie besteht ohnehin (gegen Picnic, nicht als API-Zugriffsrecht) – stützt wertungsmäßig die Harmlosigkeit des privaten Selbst-Abrufs. |

Wichtigste offene Flanke: Es gibt **keine höchstrichterliche Rechtsprechung speziell zu inoffiziellen Clients hinter Login/2FA**; die Bewertung überträgt die Screen-Scraping-Rechtsprechung (BGH I ZR 224/12, I ZR 159/10; EuGH C-30/14, C-762/19).

### 3. Durchsetzungspraxis: Maßnahmen treffen Veröffentlichung und Kommerz, nie Privatnutzer

- **Klagen** nur gegen kommerzielle Weiterverwerter: Instacart vs. Cornershop (2020–22, Vergleich), Air Canada vs. Seats.aero (2023–26, einstweilige Verfügung abgelehnt).
- **Cease-and-Desist** nur gegen öffentliche Repos/Maintainer: Haier vs. `Andre0512/hon` (01/2024 – nach massivem Backlash Einigung, Integration blieb online), Mazda vs. HA-Integration (10/2023 – DMCA, Integration entfernt, Fork existiert weiter). In beiden Fällen ging es um die *Veröffentlichung*, nie um die private Nutzung.
- **Lebensmittelhändler DE/NL/AT/UK agieren ausschließlich technisch**: REWE mTLS seit 03/2024, Lidl Login-Änderungen, Albert Heijn API-Abschaltung 2021, Tesco API-Einstellung. Der öffentliche Preis-Scraper „Heisse Preise" (AT, inkl. REWE-Tochter Billa, >170.000 Produkte) läuft seit 2023 unbehelligt.
- **Der in der bisherigen Projektannahme kursierende „REWE-Abmahnfall 2022/23" ließ sich nicht belegen** (kein GitHub-DMCA-Eintrag, alle REWE-API-Repos unbehelligt online) und sollte nicht als Präzedenzfall zitiert werden. Belegt ist nur REWEs technische Eskalation (API-Schließung ~2022, mTLS 2024).
- **Kein einziger dokumentierter Fall weltweit**, in dem ein Privatnutzer (eigenes Konto, moderates Volumen) belangt wurde. Praxis-Maximum: Kontosperrung + technische Aussperrung.

### 4. Technisches Ökosystem: aktiv gepflegt, aber fragil – 1–3 Breakages/Jahr

- **`python-picnic-api2`** (Fork `codesalatdev/python-picnic-api`, PyPI) ist die robusteste Wahl: aktiv gepflegt, **v2.0.0 vom 21.07.2026** (Pydantic-Models, Python ≥ 3.13), DE via `country_code="DE"`, alle relevanten Funktionen (`login`/2FA, `get_deliveries`, `get_delivery`, `search`, `get_article_by_gtin`, `add_product`, `get_cart`, `get_delivery_slots`), CI-Integrationstests gegen die echte API. Rückgrat der **Home-Assistant-Core-Integration** (seit HA 2021.5; Lib-Wechsel auf api2 02/2025; 2FA im Config-Flow seit 04/2026). Das Original `MikeBrink/python-picnic-api` ist seit 05/2023 tot.
- **`MRVDH/picnic-api`** (Node) ist das Pendant mit dem breitesten Funktionsumfang: v4.6.0 (02.07.2026), NL/DE/FR, hoher Release-Takt.
- **API-Basis (DE):** `https://storefront-prod.de.picnicinternational.com/api/15` (API-Version seit Jahren stabil 15). Auth: `POST /user/login` mit MD5-Hex des Passworts → langlebiges Token im Header `x-picnic-auth`; **seit Anfang 2026 bei neuen Logins faktisch 2FA-Pflicht** (`/user/2fa/generate` + `/verify`, SMS/E-Mail). `User-Agent: okhttp/4.9.0` genügt weiterhin; seit 05/2026 spielt der Geräte-Header `x-picnic-did` eine Rolle (Indiz beginnender Gerätebindung, aber keine harte App-Attestation, kein Cloudflare-Bot-Schutz).
- **Breakage-Historie:** 2022 Endpoint-Löschung, 2024 Such-API (≈10 Monate Dysfunktion, da Original-Lib verwaist), 02/2025 Login-Gateway-Umstellung, 10–12/2025 neues Artikelformat + Such-Endpoint, 02–03/2026 2FA-Verschärfung, 06/2026 Rezept-Routen. Seit der Fork-Übernahme 2025 werden Fixes in Tagen statt Monaten geliefert.
- **Picnics faktisches Verhalten: stille Duldung.** Keine Takedowns, keine C&Ds, keine dokumentierten Bans; die Breakages wirken wie normale API-Evolution, nicht wie gezielte Gegenmaßnahmen.

## Empfehlungen für Vorratio

**Freigabe-Empfehlung:** Die private Picnic-Anbindung kann umgesetzt werden. Das Restrisiko (Kontosperrung) ist bekannt, begrenzt und betrifft nur den Picnic-Account, nicht Vorratio.

**Stufe 1 – Lese-Pfad (zuerst):** `get_deliveries`/`get_delivery(id)` → Bestellhistorie → Bestandsbuchung. Nur eigene Daten, DSGVO-wertungskonform, geringstes Risiko, größter Nutzen (ersetzt den Bon-Scan für Picnic-Bestellungen).

**Stufe 2 – Schreib-Pfad (danach):** Einkaufsliste → `search`/`add_product` → Warenkorb. Aktiverer Eingriff, aber im privaten Rahmen ebenso unkritisch; der Kauf wird ohnehin manuell in der Picnic-App abgeschlossen.

**Schonende Nutzung (senkt das Sperrrisiko durch Fraud-Systeme):**
- Abrufe ereignisgesteuert (nach Lieferung / auf Nutzeraktion), kein Dauer-Polling; niedrige einstellige Requests pro Tag genügen für den Anwendungsfall.
- Token wiederverwenden (`x-picnic-auth` ist langlebig) statt wiederholter Logins; 2FA-Flow sauber implementieren.
- Kein Sortiments-Crawling: Produktsuche nur gezielt je Listenposition (das hält auch §§ 87a ff. UrhG sicher auf Abstand).

**Architektur:** Gekapseltes Modul mit manuellem Fallback (bestehender Einkaufsfluss/Bon-Scan), da 1–3 Breakages pro Jahr einzuplanen sind. Da Vorratio eine rein lokale PWA ist, braucht der API-Zugriff eine Brücke außerhalb des Browsers (CORS): lokales Python-Skript auf Basis `python-picnic-api2` mit JSON-Übergabe an den bestehenden Import, langfristig der ohnehin angedachte Server-Ausbau.

**Umschaltpunkte / rote Linien:**
- **Marktgang:** Vor einer Veröffentlichung, die Picnic-Konten Dritter automatisiert, neu bewerten (UWG wird anwendbar, C&D-Risiko nach Haier/Mazda-Muster) – dann anwaltlich prüfen oder Picnic aktiv um Kooperation fragen.
- **Technische Eskalation durch Picnic** (mTLS, App-Attestation, Bot-Schutz): nicht umgehen – das wäre die Grenze, ab der aus der Grauzone ein echtes Rechtsrisiko wird (BGH-Maßstab). Dann auf den manuellen Fallback zurückfallen.
- **AGB-Änderung** mit explizitem Automatisierungs-Verbot: Neubewertung.

## Caveats

- Keine Rechtsberatung; keine höchstrichterliche Rechtsprechung speziell zur Konstellation „inoffizieller Client hinter Login/2FA mit eigenem Konto".
- Die AGB-Zitate beruhen auf Suchindex-Verifikation, nicht auf dem Volltext (Abruf aus der Recherche-Umgebung blockiert) – vor Verlass einmal `https://picnic.app/de/agb/` direkt gegenlesen.
- Stille Duldung ist keine Zusage: Picnic kann jederzeit technisch sperren oder die AGB ändern; alle Community-Clients tragen „use at your own risk".

## Quellen (Auswahl)

**AGB/Picnic:** picnic.app/de/agb/ · picnic.app/nl/algemene-voorwaarden/ (16.02.2026) · Picnic-AGB Deel II Sep 2024 (CloudFront-PDF)

**Rechtslage:** BGH I ZR 224/12 „Flugvermittlung im Internet" (30.04.2014) · BGH I ZR 159/10 „Automobil-Onlinebörse" · BGH I ZR 39/08 „Session-ID" · EuGH C-30/14 „Ryanair/PR Aviation" · EuGH C-762/19 „CV-Online Latvia" · LG Aachen 60 Qs 16/23 („Modern Solution") · BGH VI ZR 10/24 (Facebook-Scraping, DSGVO-Schadensersatz) · BGH III ZR 179/20 (Kontosperren) · §§ 202a, 303a/b StGB · §§ 69d/e, 87a ff., 95a UrhG · § 3 GeschGehG · VO (EU) 2023/2854 (Data Act) · DSGVO Art. 15, 20

**Ökosystem:** github.com/codesalatdev/python-picnic-api (v2.0.0, 21.07.2026) · pypi.org/project/python-picnic-api2 · github.com/MRVDH/picnic-api (v4.6.0) · home-assistant.io/integrations/picnic · home-assistant/core PR #139111, #167636; Issues #115351, #138735, #164537, #169156

**Durchsetzungsfälle:** github.com/Andre0512/hon/blob/main/takedown_timeline.md (Haier) · home-assistant.io/blog/2023/10/13 (Mazda) · home-assistant.io/blog/2023/11/06 (Chamberlain/MyQ) · Grocery Dive/Bloomberg Law (Instacart/Cornershop) · Techdirt/View from the Wing (Air Canada/Seats.aero) · github.com/ByteSizedMarius/rewerse-engineering (REWE mTLS) · fm4.orf.at/stories/3034417 (Heisse Preise) · github/dmca (kein Eintrag zu REWE/Lidl/Kaufland/Edeka)
