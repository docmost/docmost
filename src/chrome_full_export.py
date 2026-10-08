#!/usr/bin/env python3
"""Full Chrome history export: every visit, with timestamps, duration, referrer.

Works on a COPY of Chrome's History database; the original is never modified.
Outputs (in output/):
  chrome_visits_full.csv / .json   one row per visit (joined with URL info)
  tables/<table>.csv               raw dump of EVERY table in the database
  chrome_full_manifest.json        checksums + counts
"""

import csv
import hashlib
import json
import platform
import shutil
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "output"
TABLES_DIR = OUTPUT_DIR / "tables"
TABLES_DIR.mkdir(parents=True, exist_ok=True)

WEBKIT_EPOCH = datetime(1601, 1, 1, tzinfo=timezone.utc)

CORE_TRANSITIONS = {
    0: "link", 1: "typed", 2: "auto_bookmark", 3: "auto_subframe",
    4: "manual_subframe", 5: "generated", 6: "auto_toplevel",
    7: "form_submit", 8: "reload", 9: "keyword", 10: "keyword_generated",
}
QUALIFIERS = {
    0x00800000: "blocked", 0x01000000: "forward_back",
    0x02000000: "from_address_bar", 0x04000000: "home_page",
    0x08000000: "from_api", 0x10000000: "chain_start",
    0x20000000: "chain_end", 0x40000000: "client_redirect",
    0x80000000: "server_redirect",
}


def find_history():
    home = Path.home()
    system = platform.system()
    if system == "Windows":
        base = home / "AppData" / "Local" / "Google" / "Chrome" / "User Data"
    elif system == "Darwin":
        base = home / "Library" / "Application Support" / "Google" / "Chrome"
    else:
        base = home / ".config" / "google-chrome"
    found = []
    if base.exists():
        for profile in sorted(base.iterdir()):
            h = profile / "History"
            if profile.is_dir() and h.exists():
                found.append(h)
    if not found:
        raise FileNotFoundError("No Chrome History file found.")
    return found


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def webkit_to_iso(value):
    if not value:
        return ""
    try:
        return (WEBKIT_EPOCH + timedelta(microseconds=int(value))).isoformat()
    except (OverflowError, ValueError):
        return ""


def webkit_to_local(value):
    if not value:
        return ""
    try:
        dt = WEBKIT_EPOCH + timedelta(microseconds=int(value))
        return dt.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    except (OverflowError, ValueError, OSError):
        return ""


def decode_transition(value):
    if value is None:
        return "", ""
    core = CORE_TRANSITIONS.get(value & 0xFF, str(value & 0xFF))
    quals = [name for bit, name in QUALIFIERS.items() if value & bit]
    return core, ";".join(quals)


def columns(conn, table):
    return [r[1] for r in conn.execute(f'PRAGMA table_info("{table}")')]


def dump_all_tables(conn):
    counts = {}
    names = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'")]
    for name in names:
        try:
            cur = conn.execute(f'SELECT * FROM "{name}"')
            cols = [d[0] for d in cur.description]
            with open(TABLES_DIR / f"{name}.csv", "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(cols)
                n = 0
                for row in cur:
                    w.writerow([
                        v.hex() if isinstance(v, (bytes, bytearray)) else v
                        for v in row
                    ])
                    n += 1
            counts[name] = n
        except sqlite3.Error as e:
            counts[name] = f"error: {e}"
    return counts


def export_visits(conn):
    vcols = columns(conn, "visits")
    ucols = columns(conn, "urls")

    def v(c):
        return f"v.{c}" if c in vcols else f"NULL AS {c}"

    def u(c):
        return f"u.{c}" if c in ucols else f"NULL AS {c}"

    has_source = bool(columns(conn, "visit_source"))
    source_join = "LEFT JOIN visit_source vs ON vs.id = v.id" if has_source else ""
    source_col = "vs.source AS source" if has_source else "NULL AS source"

    query = f"""
        SELECT {v('id')}, {v('visit_time')}, {v('visit_duration')},
               {v('transition')}, {v('from_visit')}, {v('segment_id')},
               {u('url')}, {u('title')}, {u('visit_count')},
               {u('typed_count')}, {u('hidden')},
               ref_u.url AS referrer_url, ref_u.title AS referrer_title,
               {source_col}
        FROM visits v
        JOIN urls u ON u.id = v.url
        LEFT JOIN visits rv ON rv.id = v.from_visit
        LEFT JOIN urls ref_u ON ref_u.id = rv.url
        {source_join}
        ORDER BY v.visit_time ASC
    """
    conn.row_factory = sqlite3.Row
    rows = []
    for r in conn.execute(query):
        d = dict(r)
        core, quals = decode_transition(d.get("transition"))
        dur = d.get("visit_duration") or 0
        rows.append({
            "visit_id": d["id"],
            "visit_time_utc": webkit_to_iso(d["visit_time"]),
            "visit_time_local": webkit_to_local(d["visit_time"]),
            "duration_seconds": round(dur / 1_000_000, 3),
            "url": d["url"],
            "title": d["title"],
            "referrer_url": d["referrer_url"] or "",
            "referrer_title": d["referrer_title"] or "",
            "transition_type": core,
            "transition_qualifiers": quals,
            "transition_raw": d["transition"],
            "from_visit_id": d["from_visit"],
            "segment_id": d["segment_id"],
            "source": d["source"],
            "total_visit_count_for_url": d["visit_count"],
            "typed_count_for_url": d["typed_count"],
            "hidden": d["hidden"],
            "visit_time_webkit_raw": d["visit_time"],
        })
    conn.row_factory = None
    return rows


def main():
    manifest = {"exported_at": datetime.now(timezone.utc).isoformat(), "profiles": []}
    for source in find_history():
        profile = source.parent.name.replace(" ", "_")
        copy_path = OUTPUT_DIR / f"history_copy_{profile}.db"
        shutil.copy2(source, copy_path)
        conn = sqlite3.connect(copy_path)

        visits = export_visits(conn)
        csv_path = OUTPUT_DIR / f"chrome_visits_full_{profile}.csv"
        json_path = OUTPUT_DIR / f"chrome_visits_full_{profile}.json"
        if visits:
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(visits[0].keys()))
                w.writeheader()
                w.writerows(visits)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(visits, f, ensure_ascii=False, indent=2)

        counts = dump_all_tables(conn)
        conn.close()

        manifest["profiles"].append({
            "profile": profile,
            "source_db": str(source),
            "source_sha256": sha256(source),
            "copy_sha256": sha256(copy_path),
            "visit_rows": len(visits),
            "table_row_counts": counts,
        })
        print(f"[{profile}] {len(visits)} visits exported")

    with open(OUTPUT_DIR / "chrome_full_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print("Done. See the output/ folder.")


if __name__ == "__main__":
    main()
