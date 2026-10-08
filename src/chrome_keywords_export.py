#!/usr/bin/env python3
"""Export Chrome search terms (keyword_search_terms in History)."""

from chrome_common import (find_profile_files, query_db_copy, table_columns,
                           webkit_to_iso, webkit_to_local, write_outputs)

SQL = """
SELECT k.keyword_id, k.term, k.normalized_term, u.id AS url_id, u.url,
       u.title, u.visit_count, u.last_visit_time
FROM keyword_search_terms k
JOIN urls u ON u.id = k.url_id
ORDER BY u.last_visit_time
"""
FIELDS = [
    "profile", "keyword_id", "term", "normalized_term", "url_id", "url",
    "title", "visit_count", "last_visit_time", "last_visit_time_utc",
    "last_visit_time_local",
]


def main():
    files = find_profile_files("History")
    if not files:
        return write_outputs(
            "chrome_keywords", [], [], FIELDS, "source_file_not_found"
        )
    records = []
    for profile, path in files:
        if not table_columns(path, "keyword_search_terms"):
            continue
        cols, rows = query_db_copy(path, SQL)
        for row in rows:
            rec = {"profile": profile}
            rec.update(dict(zip(cols, row)))
            raw = rec.get("last_visit_time")
            rec["last_visit_time_utc"] = webkit_to_iso(raw)
            rec["last_visit_time_local"] = webkit_to_local(raw)
            records.append(rec)
    return write_outputs(
        "chrome_keywords", records, [p for _, p in files], FIELDS,
        "no_search_terms_found",
    )


if __name__ == "__main__":
    main()
