# Local Data Museum

A local-first archive for preserving personal, family, and community history.

## Mission

Local-first data preservation for community survival, historical memory, and human-centered resilience. Our mission is to protect personal, family, and community records by building a transparent, durable archive that keeps raw originals intact, creates working copies for analysis, and documents every transformation. We believe data should be owned by the people it belongs to, not held hostage by centralized platforms, fragile systems, or opaque AI tools. By creating a local, versioned archive with human oversight and clear safeguards, we empower communities to preserve evidence, protect memory, and maintain autonomy when institutions fail.

## Why this project exists

- Cloud platforms disappear, fail, or lock users out.
- Crisis systems are unreliable and not always built for human dignity.
- Data is often scattered across browsers, accounts, devices, and services.
- People need control over their own records and their own story.
- Local archives are more resilient and more transparent than centralized systems.

## Core ideas

- Preserve originals exactly as they were received.
- Never overwrite or delete the raw source.
- Keep a working copy for research and processing.
- Record checksums, timestamps, and transformation history.
- Make data searchable and understandable without losing integrity.
- Keep human review in the loop.

## What this project includes

- Chrome history export
- Google Takeout ingestion workflow
- integrity checks and manifest logs
- local archive folder structure
- working-copy extraction and indexing
- future support for texts, Messenger exports, and other sources

## Quick start

This repository currently includes a local Chrome history exporter.

### 1. Open a terminal in the project root

### 2. Run the exporter

```bash
python3 src/chrome_history_export.py
```

### 3. The script will:

- locate Chrome history on the current machine
- export a raw copy of the database
- read the `urls` table
- write JSON and CSV outputs to `output/`

## Output folders

- `output/chrome_history.json`
- `output/chrome_history.csv`
- `output/chrome_history_manifest.json`

## Notes

This is the first concrete piece of the archive system. It is intentionally conservative: raw data stays intact, and exported data is generated from a copy rather than from the original database file.

## Future roadmap

- Google Takeout ingestion
- integrity verification with SHA-256
- timeline generation
- full-text indexing
- legal document export and chain-of-custody logging
- file categorization and tagging

## License

This project is for personal and community archival use.
