#!/usr/bin/env python3
"""Export a best-effort log of Chrome session navigation commands.

This does not reconstruct the current set of open tabs: close, prune, and
selection commands are not replayed. SNSS version 3 cleartext files are read;
encrypted and other versions are reported as unsupported.
"""

import struct
from datetime import datetime, timezone

from chrome_common import find_profile_files, write_outputs

SNSS_SIGNATURE = b"SNSS"
SNSS_CLEARTEXT_VERSION = 3
SNSS_ENCRYPTED_VERSION = 5
UPDATE_TAB_NAVIGATION = 6
OUTPUT_FIELDS = [
    "profile", "session_file", "session_file_modified_utc",
    "session_file_modified_local", "tab_id", "navigation_index", "url",
    "title",
]


class SNSSParseError(ValueError):
    """An invalid or unsupported SNSS file, with its byte offset."""

    def __init__(self, offset, reason):
        self.offset = offset
        self.reason = reason
        super().__init__(f"byte offset {offset}: {reason}")


class UnsupportedSNSSVersionError(SNSSParseError):
    """An SNSS version that this exporter cannot decode."""


def read_commands(data):
    if len(data) < 8:
        raise SNSSParseError(len(data), "truncated SNSS header (expected 8 bytes)")
    if data[:4] != SNSS_SIGNATURE:
        raise SNSSParseError(0, "invalid SNSS signature")

    (version,) = struct.unpack_from("<I", data, 4)
    if version != SNSS_CLEARTEXT_VERSION:
        detail = ("encrypted SNSS version 5 is unsupported"
                  if version == SNSS_ENCRYPTED_VERSION
                  else f"unsupported SNSS version {version}")
        raise UnsupportedSNSSVersionError(4, detail)

    pos = 8
    while pos < len(data):
        command_offset = pos
        if len(data) - pos < 2:
            raise SNSSParseError(pos, "truncated command length")
        (size,) = struct.unpack_from("<H", data, pos)
        pos += 2
        if size == 0:
            raise SNSSParseError(command_offset, "command length is zero")
        if size > len(data) - pos:
            raise SNSSParseError(command_offset, "truncated command record")
        cmd_id = data[pos]
        payload_offset = pos + 1
        yield cmd_id, data[payload_offset:pos + size], payload_offset
        pos += size


def _require(payload, pos, size, file_offset, field):
    if size < 0:
        raise SNSSParseError(file_offset + pos, f"negative {field} length")
    if pos + size > len(payload):
        raise SNSSParseError(file_offset + pos, f"truncated {field}")


def _aligned(size):
    return (size + 3) & ~3


def parse_navigation(payload, file_offset=0):
    """Decode command 6's versioned Chromium Pickle payload."""
    if len(payload) < 4:
        raise SNSSParseError(file_offset + len(payload), "truncated Pickle header")
    (pickle_size,) = struct.unpack_from("<i", payload)
    if pickle_size < 0 or pickle_size != len(payload) - 4:
        raise SNSSParseError(file_offset, "Pickle length does not match payload")

    try:
        tab_id, index, url_len = struct.unpack_from("<iii", payload, 4)
    except struct.error as exc:
        raise SNSSParseError(file_offset + 4, "truncated navigation fields") from exc

    pos = 16
    url_size = _aligned(url_len) if url_len >= 0 else url_len
    _require(payload, pos, url_size, file_offset, "URL")
    try:
        url = payload[pos:pos + url_len].decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SNSSParseError(file_offset + pos + exc.start, "invalid UTF-8 URL") from exc
    pos += url_size
    _require(payload, pos, 4, file_offset, "title length")

    (title_len,) = struct.unpack_from("<i", payload, pos)
    pos += 4
    if title_len < 0:
        raise SNSSParseError(file_offset + pos - 4, "negative title length")
    title_size = title_len * 2
    padded_title_size = _aligned(title_size)
    _require(payload, pos, padded_title_size, file_offset, "title")
    try:
        title = payload[pos:pos + title_size].decode("utf-16-le")
    except UnicodeDecodeError as exc:
        raise SNSSParseError(file_offset + pos + exc.start, "invalid UTF-16 title") from exc
    pos += padded_title_size
    return tab_id, index, url, title


def main():
    files = find_profile_files("Sessions")
    records, sources, errors = [], [], []
    for profile, folder in files:
        for f in sorted(folder.iterdir()):
            if not f.is_file() or not f.name.startswith(("Session_", "Tabs_")):
                continue
            sources.append(f)
            mtime = datetime.fromtimestamp(f.stat().st_mtime, timezone.utc)
            try:
                commands = read_commands(f.read_bytes())
                for cmd_id, payload, payload_offset in commands:
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
            except SNSSParseError as exc:
                errors.append({"path": str(f), "offset": exc.offset,
                               "reason": exc.reason})
                print(f"{f}: {exc}")

    status = "partial" if errors else ("success" if records else "empty")
    empty_reason = None
    if not records and not errors:
        empty_reason = "no_source_files" if not sources else "no_matching_commands"
    return write_outputs(
        "chrome_session_navigation_log", records, sources,
        fieldnames=OUTPUT_FIELDS, status=status, empty_reason=empty_reason,
        errors=errors)


if __name__ == "__main__":
    main()
