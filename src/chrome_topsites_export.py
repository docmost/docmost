#!/usr/bin/env python3
"""Export Chrome Top Sites (SQLite) with timestamps to output/."""

from chrome_common import (find_profile_files, query_db_copy, table_columns,
                           webkit_to_iso, webkit_to_local, write_outputs)

TIME_COLUMNS = {"last_updated", "last_visited", "last_visit_time"}


def main():
    files = find_profile_files("Top Sites")
    if not files:
        return write_outputs("chrome_topsites", [], [])
    records = []
    for profile, path in files:
        table = "top_sites"
        if not table_columns(path, table):
            continue
        cols, rows = query_db_copy(path, f'SELECT * FROM "{table}"')
        for row in rows:
            rec = {"profile": profile}
            for c, v in zip(cols, row):
                rec[c] = v.hex() if isinstance(v, (bytes, bytearray)) else v
                if c in TIME_COLUMNS:
                    rec[f"{c}_utc"] = webkit_to_iso(v)
                    rec[f"{c}_local"] = webkit_to_local(v)
            records.append(rec)
    return write_outputs("chrome_topsites", records, [p for _, p in files])


if __name__ == "__main__":
    main()
