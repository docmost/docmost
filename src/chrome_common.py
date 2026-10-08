"""Shared helpers for the Chrome data-source exporters."""

import csv
import hashlib
import json
import platform
import shutil
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "output"
WEBKIT_EPOCH = datetime(1601, 1, 1, tzinfo=timezone.utc)


class ChromeProfileNotFoundError(FileNotFoundError):
    """Raised when no supported Chrome or Chromium profile root exists."""


def chrome_bases():
    home = Path.home()
    system = platform.system()
    if system == "Windows":
        local = home / "AppData" / "Local"
        return [
            local / "Google" / "Chrome" / "User Data",
            local / "Google" / "Chrome Beta" / "User Data",
            local / "Google" / "Chrome SxS" / "User Data",
            local / "Chromium" / "User Data",
        ]
    if system == "Darwin":
        support = home / "Library" / "Application Support"
        return [
            support / "Google" / "Chrome",
            support / "Google" / "Chrome Beta",
            support / "Google" / "Chrome Canary",
            support / "Chromium",
        ]
    return [
        home / ".config" / "google-chrome",
        home / ".config" / "google-chrome-beta",
        home / ".config" / "google-chrome-unstable",
        home / ".config" / "chromium",
        home / "snap" / "chromium" / "common" / "chromium",
        home / ".var" / "app" / "org.chromium.Chromium" / "config" / "chromium",
    ]


def chrome_base():
    """Return the first installed supported profile root, or the default root."""
    bases = chrome_bases()
    return next((base for base in bases if base.is_dir()), bases[0])


def find_profile_files(relative):
    """Return [(profile_name, path)] for `relative` inside each Chrome profile."""
    bases = chrome_bases()
    existing_bases = [base for base in bases if base.is_dir()]
    if not existing_bases:
        raise ChromeProfileNotFoundError(
            f"No Chrome or Chromium profile root found (checked {', '.join(map(str, bases))})"
        )
    found = []
    for base in existing_bases:
        for profile in sorted(base.iterdir()):
            p = profile / relative
            if profile.is_dir() and p.exists():
                found.append((profile.name, p))
    return found


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def webkit_to_dt(value):
    if not value:
        return None
    try:
        return WEBKIT_EPOCH + timedelta(microseconds=int(value))
    except (OverflowError, ValueError, TypeError):
        return None


def webkit_to_iso(value):
    dt = webkit_to_dt(value)
    return dt.isoformat() if dt else ""


def webkit_to_local(value):
    dt = webkit_to_dt(value)
    if not dt:
        return ""
    try:
        return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    except (OverflowError, ValueError, OSError):
        return ""


def query_db_copy(db_path, sql):
    """Run `sql` on a temporary copy of a SQLite DB; return (columns, rows)."""
    with tempfile.TemporaryDirectory() as tmp:
        copy = Path(tmp) / "db.sqlite"
        shutil.copy2(db_path, copy)
        for suffix in ("-wal", "-journal"):
            side = Path(str(db_path) + suffix)
            if side.exists():
                shutil.copy2(side, Path(str(copy) + suffix))
        conn = sqlite3.connect(copy)
        try:
            cur = conn.execute(sql)
            cols = [d[0] for d in cur.description]
            return cols, cur.fetchall()
        finally:
            conn.close()


def table_columns(db_path, table):
    cols, rows = query_db_copy(db_path, f'PRAGMA table_info("{table}")')
    return [r[1] for r in rows]


def write_outputs(name, records, source_files, fieldnames=None, empty_reason=None):
    """Write CSV + JSON + manifest for `records` (list of dicts). Returns manifest."""
    if not records and not fieldnames:
        raise ValueError("Empty exports require explicit CSV fieldnames")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = OUTPUT_DIR / f"{name}_{stamp}.csv"
    json_path = OUTPUT_DIR / f"{name}_{stamp}.json"
    fields = list(fieldnames or []) if not records else []
    for r in records:
        for k in r:
            if k not in fields:
                fields.append(k)
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(records)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False, default=str)
    manifest = {
        "export": name,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "status": "complete" if records else "empty",
        "source_files": [
            {"path": str(p), "sha256": sha256(p)} for p in source_files
        ],
        "output_files": [
            {"path": str(p), "sha256": sha256(p), "bytes": p.stat().st_size}
            for p in (csv_path, json_path)
        ],
    }
    if not records:
        manifest["empty_reason"] = empty_reason or "no_matching_records"
    manifest_path = OUTPUT_DIR / f"{name}_manifest_{stamp}.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"{name}: {len(records)} records -> {csv_path.name}, {json_path.name}, {manifest_path.name}")
    return manifest
