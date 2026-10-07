#!/usr/bin/env python3
"""Export Chrome browsing history to local JSON and CSV files.

This script intentionally avoids modifying the original browser database.
It creates a copy of the History file in an output directory and exports a
searchable working copy for local archive use.
"""

import csv
import hashlib
import json
import os
import platform
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def find_chrome_history_path():
    system = platform.system()
    home = Path.home()

    candidates = []

    if system == "Windows":
        candidates = [
            home / "AppData" / "Local" / "Google" / "Chrome" / "User Data" / "Default" / "History",
            home / "AppData" / "Local" / "Google" / "Chrome SxS" / "User Data" / "Default" / "History",
            home / "AppData" / "Local" / "Chromium" / "User Data" / "Default" / "History",
        ]
    elif system == "Darwin":
        candidates = [
            home / "Library" / "Application Support" / "Google" / "Chrome" / "Default" / "History",
            home / "Library" / "Application Support" / "Chromium" / "Default" / "History",
        ]
    else:
        candidates = [
            home / ".config" / "google-chrome" / "Default" / "History",
            home / ".config" / "chromium" / "Default" / "History",
            home / ".config" / "google-chrome-beta" / "Default" / "History",
        ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        "Chrome history database not found. This script expects a standard Chrome/Chromium profile."
    )


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def copy_history_db(source_path: Path) -> Path:
    """Create a working copy to preserve the original database untouched."""
    working_copy = OUTPUT_DIR / "chrome_history_copy.db"
    shutil.copy2(source_path, working_copy)
    return working_copy


def query_history(db_path: Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    query = """
        SELECT id, url, title, visit_count, typed_count, last_visit_time
        FROM urls
        ORDER BY last_visit_time DESC
    """
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def export_json(entries, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def export_csv(entries, path):
    fieldnames = [
        "id",
        "url",
        "title",
        "visit_count",
        "typed_count",
        "last_visit_time",
    ]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for entry in entries:
            writer.writerow({key: entry.get(key, "") for key in fieldnames})


def write_manifest(source_path: Path, working_copy: Path, json_path: Path, csv_path: Path, entries):
    manifest = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "source_db": str(source_path),
        "source_sha256": sha256_file(source_path),
        "working_copy": str(working_copy),
        "working_copy_sha256": sha256_file(working_copy),
        "output_json": str(json_path),
        "output_csv": str(csv_path),
        "record_count": len(entries),
        "notes": [
            "Original Chrome database was not modified.",
            "A working copy was created for local export and analysis.",
            "This is the first step toward a local-first archival workflow.",
        ],
    }

    with open(OUTPUT_DIR / "chrome_history_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def main():
    source_path = find_chrome_history_path()
    working_copy = copy_history_db(source_path)
    entries = query_history(working_copy)

    json_path = OUTPUT_DIR / "chrome_history.json"
    csv_path = OUTPUT_DIR / "chrome_history.csv"

    export_json(entries, json_path)
    export_csv(entries, csv_path)
    write_manifest(source_path, working_copy, json_path, csv_path, entries)

    print(f"Chrome history export complete.")
    print(f"Source db: {source_path}")
    print(f"Working copy: {working_copy}")
    print(f"JSON: {json_path}")
    print(f"CSV: {csv_path}")
    print(f"Entries exported: {len(entries)}")


if __name__ == "__main__":
    main()
