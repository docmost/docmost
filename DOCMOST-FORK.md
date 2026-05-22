# Docmost-Fork: nativer „Datenbank-Tabelle"-Block (Baserow + NocoDB)

> Eigener Docmost-Build mit einem zusätzlichen Editor-Block, der einen **Baserow- oder NocoDB-Public-View-Link**
> entgegennimmt und die Daten als **native Docmost-Tabelle** rendert (kein iframe). Beliebig viele pro Seite,
> aktualisiert sich beim Laden. Entwickelt + isoliert getestet am 2026-05-21.

## Warum
- iframe-Embeds wirken träge (Scrollbar/Ladezeit) und sind keine echten Seiteninhalte.
- Ziel-UX: **Link einfügen → native Tabelle**, mehrere pro Seite, keine Zwischentabelle, kein externer Dienst.
- Docmost hat (noch) **kein Plugin-System** → der Block lebt direkt im Quellcode (Fork). Vorbild: der vorhandene
  `embed`-Node und der `Subpages`-Node (rendert ebenfalls live geholte Daten nativ).

## Version
- **Gepinnt auf Docmost `v0.80.2`** (= die produktiv laufende Version). Quelle: `git clone --depth 1 --branch v0.80.2`.
- Arbeitskopie: `/opt/stack/docmost-fork`. Patch: `databaseTable-block.patch`. Custom-Image-Tag: `docmost-custom:local`.

## Was gebaut wurde (Patch-Oberfläche, rein additiv — **`databaseTable-block.patch`**, 7 Dateien)
> Maßgeblich ist der Patch `databaseTable-block.patch`. Geprüft: lässt sich mit `git apply` sauber auf einen frischen
> `v0.80.2`-Klon anwenden. Node-Attribute: `src, source, title, widthMode, headerRow, headerColumn, rowNumbers, showTitle, bgMode, borderMode`.

| Datei | Änderung |
|---|---|
| `packages/editor-ext/src/lib/database-table.ts` | **NEU** — Tiptap-Node `databaseTable` (Attribute s. o.), `detectDatabaseSource`, Paste-Rule (Baserow/NocoDB-Public-Link → Node), `setDatabaseTable`-Command. Vorlage: `embed.ts`. |
| `packages/editor-ext/src/index.ts` | Export `./lib/database-table`. |
| `apps/client/.../database-table/database-table-view.tsx` | **NEU** — React-NodeView: Fetch (Baserow/NocoDB Public-API) → native Mantine-`Table`; Werkzeug-Blase (bei Selektion/aktiv), Titel editierbar, Breite/Header/Hintergrund/Rahmen-Toggles, Zellauswahl + Kopieren (Clipboard-API **mit `execCommand`-Fallback für HTTP**), Baserow-Edit-Deeplink via kb-sync-Resolver. |
| `apps/client/.../database-table/database-table-view.module.css` | **NEU** — Blasen-Position, Link-Unterstrich-Fix, Rahmen-Modi (`.bAll`/`.bH`/`.bNone`). |
| `apps/client/src/features/editor/extensions/extensions.ts` | Import `DatabaseTable` + `DatabaseTableView`; `DatabaseTable.configure({ view: DatabaseTableView })`. |
| `apps/client/src/features/editor/components/slash-menu/menu-items.ts` | Slash-Eintrag „Datenbank-Tabelle" (`setDatabaseTable({})`). |
| `apps/server/src/collaboration/collaboration.util.ts` | `DatabaseTable` in Import **und** `tiptapExtensions`-Array (serverseitige Schema-Registrierung — sonst „unknown node type" beim Speichern/Collab). |

**Wichtig:** Client liefert die React-View per `.configure({view})`; der Server registriert den Node **bar** (ohne View) —
`getSchema()` ruft `addNodeView` nie auf, daher kein React im Server. CORS bei Baserow **und** NocoDB ist `*` →
der Browser darf die Public-API direkt laden (kein Proxy nötig).

## Bauen & isoliert testen (DEV-Instanz :3003)
```bash
bash /opt/stack/docmost-fork/build.sh      # docker build docmost-custom:local + startet docmost-dev (:3003)
```
- Eigene, **isolierte** Instanz: `docmost-dev` + `docmost-dev-db` + `docmost-dev-redis` (Compose), eigene Volumes,
  Port **3003**. **Produktive Docmost (:3002) bleibt unangetastet.**
- Login DEV: `daniel.brunthaler@skidata.com` / `13371337` (Workspace „DEV").

## Testen (im Browser, :3003)
1. Seite öffnen/anlegen → `/` tippen → **„Datenbank-Tabelle"** wählen → im Popover einen Public-Link einfügen:
   - Baserow: `http://<IP>:8888/public/grid/<slug>` (View teilen → „Create public link").
   - NocoDB: `http://<IP>:8080/dashboard/#/nc/view/<uuid>` (Grid-View → Share).
2. Alternativ: einen solchen Link **direkt in die Seite einfügen** (Paste-Rule → wird automatisch zum Block).
3. Erwartung: native Tabelle mit Spalten/Zeilen + „aktualisieren"-Button. Mehrere Blöcke pro Seite möglich.
- Server-Akzeptanz bereits verifiziert: Seite mit 2 `databaseTable`-Nodes (Baserow+NocoDB) per API angelegt & zurückgelesen ✓.

## Produktiv umstellen (ERST nach Freigabe)
In `/opt/stack/docker-compose.yml` beim Service `docmost` das Image tauschen:
```yaml
  docmost:
    image: docmost-custom:local      # statt docmost/docmost:latest
```
dann `docker compose up -d docmost`. **DB/Daten kompatibel** (gleiche v0.80.2, der Block ist nur Seiteninhalt).
**Rollback:** Image-Zeile zurück auf `docmost/docmost:latest`, `docker compose up -d docmost` — vorhandene
`databaseTable`-Blöcke werden vom Standard-Docmost dann als unbekannter Node ggf. entfernt → vor Rollback Seiten beachten.

## Bekannte Trade-offs
- **Suche:** Die live geholten Tabellendaten stehen nicht im gespeicherten Seitentext → **nicht volltextsuchbar**.
- **IP-Wechsel:** Der `src` (Public-Link) steht fest im Seiteninhalt → bei IP-Wechsel brechen die Links (wie bei Embeds).
  Produktiv: Hostnamen/DNS statt IP. (Server-`SERVER_IP` ist hier DHCP-dynamisch.)
- **Browser-Erreichbarkeit:** Der Block lädt im Browser des Betrachters → dessen Browser muss Baserow/NocoDB erreichen.
- **Baserow „bearbeiten"-Deeplink:** Baserow versteckt im Public-Link die IDs. Der Block fragt daher den
  **kb-sync-Resolver** (`GET http://<host>:8090/resolve?slug=<slug>`, authentifiziert, CORS `*`) → liefert
  `…/database/<db>/table/<tbl>/<view>`. **Deployment-spezifische Kopplung** (kb-sync auf :8090, gleicher Host);
  fällt ohne Resolver sauber auf die Baserow-Startseite zurück. NocoDB braucht das nicht (IDs stehen im Public-Meta).
- **Wartung:** Custom-Image muss bei Docmost-Updates neu gebaut/gepatcht werden → siehe unten.

---

## 🔁 Update-Handhabung — Anleitung für Claude (bei Docmost-Updates)

> Ziel: neue Docmost-Version übernehmen und den `databaseTable`-Block wieder einbauen. Der Patch ist **additiv**
> (1 neuer Node, 1 neue View, wenige Registrierungszeilen) → Konfliktrisiko gering, aber Editor-Interna können sich ändern.

**Schritte:**
1. Neue Version ermitteln: `git ls-remote --tags --refs https://github.com/docmost/docmost.git | tail`. Ziel-Tag = die
   Version, die produktiv laufen soll.
2. Frisch klonen: `git clone --depth 1 --branch <NEUE_VERSION> https://github.com/docmost/docmost.git /opt/stack/docmost-fork-new`.
3. Patch versuchen: `cd /opt/stack/docmost-fork-new && git apply --3way /opt/stack/docmost-fork/databaseTable-block.patch`.
   - Klappt das sauber → weiter zu Schritt 5.
4. Falls der Patch **nicht** sauber greift, die 6 Stellen **manuell** nachziehen (Vorlage bleibt der `embed`-Node!):
   - `packages/editor-ext/src/lib/database-table.ts` → **kopieren** aus altem Fork (meist unverändert lauffähig;
     prüfen ob `nodePasteRule`/`ReactNodeViewRenderer`-Importe noch stimmen).
   - `packages/editor-ext/src/index.ts` → `export * from "./lib/database-table";` ergänzen.
   - `apps/client/.../components/database-table/database-table-view.tsx` → **kopieren** (prüfen: Mantine-`Table`-API,
     `@tabler/icons-react`-Namen, `NodeViewProps`-Felder).
   - `apps/client/.../extensions/extensions.ts` → wie beim `Embed`: in den `@docmost/editor-ext`-Import `DatabaseTable`
     aufnehmen, `DatabaseTableView` importieren, neben `Embed.configure(...)` ein `DatabaseTable.configure({view: DatabaseTableView})`.
   - `apps/client/.../slash-menu/menu-items.ts` → den „Datenbank-Tabelle"-Eintrag neben „Iframe embed" einfügen.
   - `apps/server/.../collaboration/collaboration.util.ts` → `DatabaseTable` in den `@docmost/editor-ext`-Import **und**
     ins `tiptapExtensions`-Array (neben `Embed`) aufnehmen. **Diese Server-Zeile nicht vergessen** (sonst „unknown node type").
   - Orientierung: `grep -rn "Embed" packages apps` zeigt überall die analogen Stellen.
5. Patch neu sichern: `cd /opt/stack/docmost-fork-new && git add -A && git diff --cached > databaseTable-block.patch`.
6. Bauen + testen: alten Fork ersetzen (`mv`), `bash /opt/stack/docmost-fork/build.sh`, im Browser :3003 prüfen
   (Slash „Datenbank-Tabelle" + Paste-Link → native Tabelle). API-Smoke-Test: Seite mit `databaseTable`-Node anlegen/zurücklesen.
7. Erst nach erfolgreichem DEV-Test: produktives `docmost`-Image auf `docmost-custom:local` umstellen (s. o.), Rollback bereithalten.

**API-Pfade, die der Block nutzt (bei API-Änderungen von Baserow/NocoDB hier anpassen — in `database-table-view.tsx`):**
- Baserow: `GET {origin}/api/database/views/<slug>/public/info/` (Felder **+ `view.name` = Titel**) + `GET .../api/database/views/grid/<slug>/public/rows/?size=200`.
  **WICHTIG:** Public-Rows sind nach **`field_<id>`** indiziert (NICHT nach Feldname!) → Zelle = `row["field_"+f.id]`, Header = `f.name`. (Sonst leere Tabelle.)
- NocoDB: `GET {origin}/api/v2/public/shared-view/<uuid>/meta` (Spalten) + `GET .../rows` (Liste unter `.list`).
- CORS muss `*` bleiben (Stand 2026-05-21 bei beiden gegeben); sonst serverseitigen Proxy ergänzen.

**Versions-Pinning:** Immer die produktiv laufende Docmost-Version pinnen; nie „latest" bauen, sonst driften Schema/Editor.
