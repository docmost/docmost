# Docmost-Fork — Build-Plan / Zustand (für fortgesetzte Claude-Session)

> **Auftrag:** Variante 1 — eigener Docmost-Block, der Baserow- UND NocoDB-Public-Views
> als **native Tabelle** rendert (Fetch im Browser, CORS bei beiden `*` bestätigt).
> **Produktive Docmost NICHT anfassen** — isoliert bauen/testen. Umstieg erst nach Freigabe des Users.

## Fakten (bereits ermittelt)
- Docmost-Version: **v0.80.2** (geklont nach `/opt/stack/docmost-fork`, shallow).
- CORS: Baserow `…/api/database/views/<slug>/public/info/` + `…/public/grid/<slug>/public/rows/` → `*`.
  NocoDB `…/api/v2/public/shared-view/<uuid>/meta` → `*` (rows-Endpoint noch genau ermitteln; POST .../rows war 404).
- Vorlage-Node: `packages/editor-ext/src/lib/embed.ts` (Block-Atom mit URL-Attr, liefert React-View per `options.view`).
- Client-Registrierung: `apps/client/src/features/editor/extensions/extensions.ts` (Zeile ~342 `Embed.configure({view: EmbedView})`).
- Client-View-Vorlage: `apps/client/src/features/editor/components/embed/embed-view.tsx`.
- Slash-Menü: `apps/client/src/features/editor/components/slash-menu/menu-items.ts`.
- Server-Schema/Extensions: `apps/server/src/collaboration/collaboration.util.ts` (importiert `@docmost/editor-ext`) — Node dort registrieren.
- editor-ext-Exporte: `packages/editor-ext/src/index.ts`.

## Schritte
1. Node `databaseTable` in `packages/editor-ext/src/lib/database-table.ts` (Attrs: `src`, `source` = baserow|nocodb, `title`),
   in `index.ts` exportieren.
2. Client-View `database-table-view.tsx`: Link-Eingabe-Popover (leer) bzw. Fetch+native `<table>` (befüllt),
   Quelle aus URL erkennen (`/public/grid/<slug>` → Baserow; `/nc/view/<uuid>` bzw. shared-view → NocoDB).
3. In `extensions.ts` registrieren (`DatabaseTable.configure({view: DatabaseTableView})`).
4. Paste-Rule: eingefügter Baserow/NocoDB-Public-Link → `databaseTable`-Node. + Slash-Command „/Datenbank-Tabelle".
5. Server: Node in `collaboration.util.ts` (und ggf. weiteren Extension-Listen für generateJSON/HTML) registrieren.
6. Build: eigenes Image via Repo-Dockerfile, Tag `docmost-custom:local`.
7. **Isoliert testen** (Test-Compose: custom-docmost + eigenes Postgres/Redis auf anderen Ports), Block prüfen.
8. Doku: `DOCMOST-FORK.md` (Aufbau + **Update-Handhabung für Claude** am Ende) und `PITCH.md` (GitHub-Pitch).

## Sicherheit
- Produktive Services (`docmost`, `docmost-db`, …) bleiben unberührt. Kein Image-Tausch ohne User-Freigabe.
