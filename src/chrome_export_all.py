#!/usr/bin/env python3
"""Run all Chrome exporters (close Chrome first). Continues past failures."""

import chrome_bookmarks_export
import chrome_downloads_export
import chrome_keywords_export
import chrome_sessions_export
import chrome_topsites_export
from chrome_common import ChromeProfileNotFoundError

EXPORTERS = [
    chrome_bookmarks_export,
    chrome_topsites_export,
    chrome_downloads_export,
    chrome_keywords_export,
    chrome_sessions_export,
]


def main():
    results = []
    for mod in EXPORTERS:
        try:
            manifest = mod.main()
            count = manifest["record_count"]
            results.append((mod.__name__, "complete", count, None))
        except ChromeProfileNotFoundError as e:
            results.append((mod.__name__, "skipped", 0, str(e)))
        except Exception as e:
            results.append((mod.__name__, "failed", 0, str(e)))

    complete = sum(status == "complete" for _, status, _, _ in results)
    skipped = sum(status == "skipped" for _, status, _, _ in results)
    failed = sum(status == "failed" for _, status, _, _ in results)
    records = sum(count for _, status, count, _ in results if status == "complete")
    print("Export summary:")
    for name, status, count, error in results:
        detail = f" ({count} records)" if status == "complete" else f": {error}"
        print(f"- {name}: {status}{detail}")
    print(
        f"Export summary: {complete} complete, {skipped} skipped, {failed} failed; "
        f"{records} total records"
    )
    if complete and (skipped or failed):
        print("Partial results were exported.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
