#!/usr/bin/env python3
"""Export Chrome Bookmarks (JSON file) with dates to output/."""

import json

from chrome_common import (find_profile_files, webkit_to_iso, webkit_to_local,
                           write_outputs)


def walk(node, path, profile, out):
    name = node.get("name", "")
    if node.get("type") == "url":
        out.append({
            "profile": profile,
            "folder": "/".join(path),
            "id": node.get("id", ""),
            "guid": node.get("guid", ""),
            "name": name,
            "url": node.get("url", ""),
            "date_added_raw": node.get("date_added", ""),
            "date_added_utc": webkit_to_iso(node.get("date_added")),
            "date_added_local": webkit_to_local(node.get("date_added")),
            "date_last_used_raw": node.get("date_last_used", ""),
            "date_last_used_utc": webkit_to_iso(node.get("date_last_used")),
            "date_last_used_local": webkit_to_local(node.get("date_last_used")),
        })
    for child in node.get("children", []):
        walk(child, path + [name], profile, out)


def main():
    files = find_profile_files("Bookmarks")
    if not files:
        return write_outputs("chrome_bookmarks", [], [])
    records = []
    for profile, path in files:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        for root in data.get("roots", {}).values():
            if isinstance(root, dict):
                walk(root, [], profile, records)
    return write_outputs("chrome_bookmarks", records, [p for _, p in files])


if __name__ == "__main__":
    main()
