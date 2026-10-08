#!/usr/bin/env python3
"""Export recently open tabs from Chrome's Sessions folder (SNSS files).

Best-effort parser: reads UpdateTabNavigation commands (tab id, index, URL,
 title). SNSS files carry no per-entry visit timestamps, so the session file's
 modification time is recorded instead.
"""

import struct
from datetime import datetime, timezone

from chrome_common import find_profile_files, write_outputs

UPDATE_TAB_NAVIGATION = 6
FIELDS = [
    "profile", "session_file", "session_file_modified_utc",
    "session_file_modified_local", "tab_id", "navigation_index", "url", "title",
]


def read_commands(data):
    if len(data) < 8 or data[:4] != b"SNSS":
        return
    pos = 8
    while pos + 3 <= len(data):
        (size,) = struct.unpack_from("<H", data, pos)
        pos += 2
        if size < 1 or pos + size > len(data):
            return
        yield data[pos], data[pos + 1:pos + size]
        pos += size


def parse_navigation(payload):
    """Parse one UpdateTabNavigation record as best we can across Chrome versions."""
    if not payload:
        return None
    for base in (0, 4):
        if len(payload) < base + 12:
            continue
        try:
            tab_id, index, url_len = struct.unpack_from("<iii", payload, base)
        except struct.error:
            continue
        p = base + 12
        if p + url_len > len(payload):
            continue
        url_bytes = payload[p:p + url_len]
        try:
            url = url_bytes.decode("utf-8")
        except UnicodeDecodeError:
            url = url_bytes.decode("utf-8", "replace")
        p += (url_len + 3) & ~3
        if p + 4 > len(payload):
            continue
        try:
            title_len = struct.unpack_from("<i", payload, p)[0]
        except struct.error:
            continue
        p += 4
        if title_len < 0:
            continue
        title_end = p + title_len * 2
        if title_end > len(payload):
            continue
        title = payload[p:title_end].decode("utf-16-le", "replace")
        return tab_id, index, url, title.strip("\x00")
    return None


def main():
    files = find_profile_files("Sessions")
    if not files:
        return write_outputs(
            "chrome_sessions", [], [], FIELDS, "source_file_not_found"
        )
    records, sources = [], []
    for profile, folder in files:
        for f in sorted(folder.iterdir()):
            if not f.is_file() or not f.name.startswith(("Session_", "Tabs_")):
                continue
            sources.append(f)
            mtime = datetime.fromtimestamp(f.stat().st_mtime, timezone.utc)
            for cmd_id, payload in read_commands(f.read_bytes()):
                if cmd_id != UPDATE_TAB_NAVIGATION:
                    continue
                nav = parse_navigation(payload)
                if nav:
                    records.append({
                        "profile": profile,
                        "session_file": f.name,
                        "session_file_modified_utc": mtime.isoformat(),
                        "session_file_modified_local":
                            mtime.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z"),
                        "tab_id": nav[0],
                        "navigation_index": nav[1],
                        "url": nav[2],
                        "title": nav[3],
                    })
    return write_outputs(
        "chrome_sessions", records, sources, FIELDS, "no_session_tabs_found"
    )


if __name__ == "__main__":
    main()
