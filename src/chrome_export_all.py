#!/usr/bin/env python3
"""Run all Chrome exporters (close Chrome first). Continues past failures."""

import chrome_bookmarks_export
import chrome_downloads_export
import chrome_keywords_export
import chrome_sessions_export
import chrome_topsites_export
from chrome_common import ChromeProfileNotFoundError, ChromeSourceNotFoundError

EXPORTERS = [chrome_bookmarks_export, chrome_topsites_export,
             chrome_downloads_export, chrome_keywords_export,
             chrome_sessions_export]


def main():
    skipped, failed, partial = [], [], []
    for mod in EXPORTERS:
        try:
            result = mod.main()
        except ChromeProfileNotFoundError as e:
            skipped.append(mod.__name__)
            print(f"{mod.__name__} skipped: {e}")
        except ChromeSourceNotFoundError as e:
            skipped.append(mod.__name__)
            print(f"{mod.__name__} skipped (source unavailable): {e}")
        except Exception as e:
            failed.append(mod.__name__)
            print(f"{mod.__name__} failed: {e}")
        else:
            if isinstance(result, dict) and result.get("status") == "partial":
                partial.append(mod.__name__)
                print(f"{mod.__name__} produced partial records")

    print("Chrome export summary:")
    print(f"  skipped: {', '.join(skipped) if skipped else 'none'}")
    print(f"  failed: {', '.join(failed) if failed else 'none'}")
    print(f"  partial: {', '.join(partial) if partial else 'none'}")
    return 1 if failed or partial else 0


if __name__ == "__main__":
    raise SystemExit(main())
