#!/usr/bin/env python3
"""Export Chrome downloads (History database) with dates and file paths."""

from chrome_common import (find_profile_files, query_db_copy, table_columns,
                           webkit_to_iso, webkit_to_local, write_outputs)

TIME_COLUMNS = {"start_time", "end_time", "last_access_time"}


def main():
    files = find_profile_files("History")
    records = []
    for profile, path in files:
        if not table_columns(path, "downloads"):
            continue
        cols, rows = query_db_copy(path, 'SELECT * FROM "downloads"')
        chains = {}
        if table_columns(path, "downloads_url_chains"):
            _, crows = query_db_copy(
                path, "SELECT id, chain_index, url FROM downloads_url_chains "
                      "ORDER BY id, chain_index")
            for i, _, url in crows:
                chains.setdefault(i, []).append(url)
        for row in rows:
            rec = {"profile": profile}
            for c, v in zip(cols, row):
                rec[c] = v.hex() if isinstance(v, (bytes, bytearray)) else v
                if c in TIME_COLUMNS:
                    rec[f"{c}_utc"] = webkit_to_iso(v)
                    rec[f"{c}_local"] = webkit_to_local(v)
            rec["url_chain"] = " | ".join(chains.get(rec.get("id"), []))
            records.append(rec)
    return write_outputs("chrome_downloads", records, [p for _, p in files])


if __name__ == "__main__":
    main()
