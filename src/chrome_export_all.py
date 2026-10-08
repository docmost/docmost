#!/usr/bin/env python3
"""Run all Chrome exporters (close Chrome first). Continues past failures."""

import chrome_bookmarks_export
import chrome_downloads_export
import chrome_keywords_export
import chrome_sessions_export
import chrome_topsites_export

EXPORTERS = [
    chrome_bookmarks_export,
    chrome_topsites_export,
    chrome_downloads_export,
    chrome_keywords_export,
    chrome_sessions_export,
]


def main():
    failed = []
    for mod in EXPORTERS:
        try:
            mod.main()
        except FileNotFoundError:
            print(f"{mod.__name__}: no Chrome profile found; skipped")
        except Exception as e:
            failed.append(mod.__name__)
            print(f"{mod.__name__} failed: {e}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
