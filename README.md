<div align="center">
    <h1><b>Docmost</b></h1>
    <p>
        Open-source collaborative wiki and documentation software.
        <br />
        <a href="https://docmost.com"><strong>Website</strong></a> | 
        <a href="https://docmost.com/docs"><strong>Documentation</strong></a> |
        <a href="https://twitter.com/DocmostHQ"><strong>Twitter / X</strong></a>
    </p>
</div>
<br />

## Getting started

To get started with Docmost, please refer to our [documentation](https://docmost.com/docs) or try our [cloud version](https://docmost.com/pricing) .

## Features

- Real-time collaboration
- Diagrams (Draw.io, Excalidraw and Mermaid)
- Spaces
- Permissions management
- Groups
- Comments
- Page history
- Search
- File attachments
- Embeds (Airtable, Loom, Miro and more)
- Translations (10+ languages)

### Screenshots

<p align="center">
<img alt="home" src="https://docmost.com/screenshots/home.png" width="70%">
<img alt="editor" src="https://docmost.com/screenshots/editor.png" width="70%">
</p>

### License
Docmost core is licensed under the open-source AGPL 3.0 license.  
Enterprise features are available under an enterprise license (Enterprise Edition).  

All files in the following directories are licensed under the Docmost Enterprise license defined in `packages/ee/License`.
  - apps/server/src/ee
  - apps/client/src/ee
  - packages/ee

### NIS-2 compliance additions (this fork)

This fork adds two features to help technical teams document configuration changes for NIS-2:

- **Change log** — an append-only, audit-proof record of configuration changes per page or space.
  Each batch captures *what was changed*, *why*, *who requested/authorized it* and *which system/ticket*,
  with a server-side timestamp and the logged-in author (not editable). Shown in a side panel;
  corrections are added as new, linked entries. When enabled for a section, a warning banner appears
  if the page was changed without a corresponding entry.
- **Reviews** — a per-page/space review interval (inherited down the page tree) with a status banner on
  the page (up to date / due / overdue), a colored + pulsing indicator in the sidebar tree, and a logged
  "mark as reviewed" action.

Both are activated per section via the page **"⋯ → NIS-2 settings"** menu or the space settings **"NIS-2"** tab.
New database tables: `change_sets`, `change_entries`, `change_log_settings`, `review_settings`, `review_records`.

This is meant as a practical add-on for everyday documentation duties — it does **not** cover all of NIS-2.
Some related capabilities (such as a full system audit log) are part of Docmost's Enterprise edition.

The fork's tables are created idempotently on startup and are **not** registered in Docmost's migration
ledger, and no existing tables are altered. You can therefore switch the Docker image between stock Docmost
and this fork in either direction without any migration steps — the stock image simply ignores the extra tables.

A local stack that builds this fork from source is provided in `docker-compose.local.yml` (not committed —
it holds a generated secret); run `docker compose -f docker-compose.local.yml up -d --build`.

### Contributing

See the [development documentation](https://docmost.com/docs/self-hosting/development)

## Thanks
Special thanks to;

<img width="100" alt="Crowdin" src="https://github.com/user-attachments/assets/a6c3d352-e41b-448d-b6cd-3fbca3109f07" />

[Crowdin](https://crowdin.com/) for providing access to their localization platform.


<img width="48" alt="Algolia-mark-square-white" src="https://github.com/user-attachments/assets/6ccad04a-9589-4965-b6a1-d5cb1f4f9e94" />

[Algolia](https://www.algolia.com/) for providing full-text search to the docs.

