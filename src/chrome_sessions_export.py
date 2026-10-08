#!/usr/bin/env python3
"""Export navigation updates from Chrome's Sessions folder (SNSS files).

This does not replay session commands and cannot determine which tabs remain
open. SNSS files carry no per-entry visit timestamps, so the session file's
modification time is recorded instead.
"""

import struct
import sys
from datetime import datetime, timezone

from chrome_common import find_profile_files, write_outputs

UPDATE_TAB_NAVIGATION = 6
SUPPORTED_VERSION = 3
ENCRYPTED_VERSIONS = {2, 4, 5}


class SessionParseError(ValueError):
    """Malformed or unsupported SNSS data, with its byte offset."""

    def __init__(self, message, offset):
        self.offset = offset
        super().__init__(f"{message} at byte offset {offset}")


def read_commands(data):
    if len(data) < 8:
        raise SessionParseError("truncated SNSS header", len(data))
    if data[:4] != b"SNSS":
        raise SessionParseError("invalid SNSS signature", 0)
    (version,) = struct.unpack_from("<I", data, 4)
    if version != SUPPORTED_VERSION:
        description = (
            "encrypted SNSS version"
            if version in ENCRYPTED_VERSIONS
            else "unsupported SNSS version"
        )
        raise SessionParseError(f"{description} {version}", 4)

    pos = 8
    while pos < len(data):
        if pos + 2 > len(data):
            raise SessionParseError("truncated command size", pos)
        (size,) = struct.unpack_from("<H", data, pos)
        pos += 2
        if size < 1:
            raise SessionParseError("zero-sized command", pos - 2)
        if pos + size > len(data):
            raise SessionParseError("truncated command", pos - 2)
        yield data[pos], data[pos + 1:pos + size], pos + 1
        pos += size


def _read_pickle_string(payload, pos, offset, *, utf16=False):
    if pos + 4 > len(payload):
        raise SessionParseError(
            "truncated Pickle string length", offset + pos
        )
    (length,) = struct.unpack_from("<i", payload, pos)
    if length < 0:
        raise SessionParseError(
            "negative Pickle string length", offset + pos
        )
    pos += 4
    byte_length = length * 2 if utf16 else length
    end = pos + byte_length
    padded_end = pos + ((byte_length + 3) & ~3)
    if padded_end > len(payload):
        raise SessionParseError("truncated Pickle string", offset + pos)
    value = payload[pos:end]
    try:
        return value.decode("utf-16-le" if utf16 else "utf-8"), padded_end
    except UnicodeDecodeError as error:
        raise SessionParseError(
            "invalid Pickle string encoding", offset + pos + error.start
        ) from error


def parse_navigation(payload, offset=0):
    """Parse an UpdateTabNavigation command's versioned Pickle contents."""
    if len(payload) < 16:
        raise SessionParseError(
            "truncated navigation Pickle", offset + len(payload)
        )
    (pickle_size,) = struct.unpack_from("<I", payload)
    if pickle_size != len(payload) - 4:
        raise SessionParseError("invalid navigation Pickle length", offset)

    tab_id, index = struct.unpack_from("<ii", payload, 4)
    url, pos = _read_pickle_string(payload, 12, offset, utf16=False)
    title, _ = _read_pickle_string(payload, pos, offset, utf16=True)
    return tab_id, index, url, title.strip("\x00")


def main():
    files = find_profile_files("Sessions")
    if not files:
        return write_outputs("chrome_sessions", [], [])
    records, sources = [], []
    for profile, folder in files:
        for f in sorted(folder.iterdir()):
            if not f.is_file() or not f.name.startswith(("Session_", "Tabs_")):
                continue
            sources.append(f)
            mtime = datetime.fromtimestamp(f.stat().st_mtime, timezone.utc)
            try:
                for cmd_id, payload, payload_offset in read_commands(
                    f.read_bytes()
                ):
                    if cmd_id != UPDATE_TAB_NAVIGATION:
                        continue
                    nav = parse_navigation(payload, payload_offset)
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
            except SessionParseError as error:
                print(f"{f}: {error}", file=sys.stderr)
    return write_outputs("chrome_sessions", records, sources)


if __name__ == "__main__":
    main()
