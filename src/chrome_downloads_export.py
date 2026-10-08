#!/usr/bin/env python3
"""Export Chrome downloads (History database) with dates and file paths."""

from chrome_common import (find_profile_files, query_db_copy, table_columns,
                           webkit_to_iso, webkit_to_local, write_outputs)

TIME_COLUMNS = {"start_time", "end_time", "last_access_time"}
EMPTY_FIELDS = [
    "profile", "id", "guid", "current_path", "target_path", "start_time",
    "start_time_utc", "start_time_local", "received_bytes", "total_bytes",
    "state", "danger_type", "interrupt_reason", "hash", "opened",
    "last_access_time",
    "last_access_time_utc", "last_access_time_local", "referrer", "site_url",
    "tab_url", "tab_referrer_url", "http_method", "by_ext_id", "by_ext_name",
    "etag", "last_modified", "mime_type", "original_mime_type", "transient",
    "end_time", "end_time_utc", "end_time_local", "url_chain",
]


def main():
    files = find_profile_files("History")
    if not files:
        return write_outputs(
            "chrome_downloads", [], [], EMPTY_FIELDS, "source_file_not_found"
        )
    records = []
    fields = []
    for profile, path in files:
        columns = table_columns(path, "downloads")
        if not columns:
            continue
        for column in ["profile", *columns]:
            if column not in fields:
                fields.append(column)
        for column in columns:
            if column in TIME_COLUMNS:
                fields.extend(
                    field for field in (f"{column}_utc", f"{column}_local")
                    if field not in fields
                )
        if "url_chain" not in fields:
            fields.append("url_chain")
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
    return write_outputs(
        "chrome_downloads", records, [p for _, p in files],
        fields or EMPTY_FIELDS, "no_downloads_found",
    )


if __name__ == "__main__":
    main()
