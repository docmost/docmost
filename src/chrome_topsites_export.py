#!/usr/bin/env python3
"""Export Chrome Top Sites (SQLite) with timestamps to output/."""

from chrome_common import (find_profile_files, query_db_copy, table_columns,
                           webkit_to_iso, webkit_to_local, write_outputs)

TIME_COLUMNS = {"last_updated", "last_visited", "last_visit_time"}
EMPTY_FIELDS = [
    "profile", "url", "title", "rank", "url_rank", "last_updated",
    "last_updated_utc", "last_updated_local", "last_visited",
    "last_visited_utc", "last_visited_local", "last_visit_time",
    "last_visit_time_utc", "last_visit_time_local",
]


def main():
    files = find_profile_files("Top Sites")
    if not files:
        return write_outputs(
            "chrome_topsites", [], [], EMPTY_FIELDS, "source_file_not_found"
        )
    records = []
    fields = []
    for profile, path in files:
        table = "top_sites"
        columns = table_columns(path, table)
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
        cols, rows = query_db_copy(path, f'SELECT * FROM "{table}"')
        for row in rows:
            rec = {"profile": profile}
            for c, v in zip(cols, row):
                rec[c] = v.hex() if isinstance(v, (bytes, bytearray)) else v
                if c in TIME_COLUMNS:
                    rec[f"{c}_utc"] = webkit_to_iso(v)
                    rec[f"{c}_local"] = webkit_to_local(v)
            records.append(rec)
    return write_outputs(
        "chrome_topsites", records, [p for _, p in files],
        fields or EMPTY_FIELDS, "no_top_sites_found",
    )


if __name__ == "__main__":
    main()
