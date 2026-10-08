import io
import struct
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import chrome_sessions_export as sessions


def pickle_string(value, *, utf16=False):
    if utf16:
        encoded = value.encode("utf-16-le")
        length = len(value)
    else:
        encoded = value.encode("utf-8")
        length = len(encoded)
    return struct.pack("<i", length) + encoded + bytes((-len(encoded)) % 4)


def navigation_payload(
    tab_id=5, index=2, url="https://example.com", title="Example"
):
    body = (
        struct.pack("<ii", tab_id, index)
        + pickle_string(url)
        + pickle_string(title, utf16=True)
        + pickle_string("")
        + struct.pack("<i", 0)
    )
    return struct.pack("<I", len(body)) + body


def snss_file(*commands, version=3):
    data = bytearray(struct.pack("<4sI", b"SNSS", version))
    for command in (b"\xff", *commands):
        data.extend(struct.pack("<H", len(command)))
        data.extend(command)
    return bytes(data)


class SessionParserTests(unittest.TestCase):
    def test_reads_version_three_navigation_pickles(self):
        payload = navigation_payload()
        commands = list(
            sessions.read_commands(snss_file(b"\x06" + payload))
        )

        self.assertEqual([command[0] for command in commands], [255, 6])
        command_id, command_payload, offset = commands[1]
        self.assertEqual(command_id, sessions.UPDATE_TAB_NAVIGATION)
        self.assertEqual(
            sessions.parse_navigation(command_payload, offset),
            (5, 2, "https://example.com", "Example"),
        )

    def test_rejects_invalid_headers_and_command_framing(self):
        invalid_files = (
            (b"BAD!" + struct.pack("<I", 3), "signature", 0),
            (b"SNSS", "header", 4),
            (struct.pack("<4sI", b"SNSS", 5), "version 5", 4),
            (struct.pack("<4sI", b"SNSS", 3) + b"\x01", "command size", 8),
            (struct.pack("<4sIH", b"SNSS", 3, 0), "zero-sized", 8),
            (
                struct.pack("<4sIH", b"SNSS", 3, 3) + b"\x06",
                "truncated command",
                8,
            ),
        )
        for data, message, offset in invalid_files:
            with self.subTest(message=message):
                with self.assertRaises(sessions.SessionParseError) as error:
                    list(sessions.read_commands(data))
                self.assertIn(message, str(error.exception))
                self.assertEqual(error.exception.offset, offset)

    def test_rejects_v3_stream_without_initial_state_marker(self):
        data = (
            struct.pack("<4sI", b"SNSS", 3)
            + struct.pack("<H", 1)
            + b"\x06"
        )
        commands = sessions.read_commands(data)
        with self.assertRaisesRegex(
            sessions.SessionParseError, "missing initial-state marker"
        ):
            next(commands)

    def test_rejects_malformed_pickle_lengths(self):
        payload = navigation_payload()
        bad_header = struct.pack("<I", len(payload)) + payload[4:]
        with self.assertRaisesRegex(sessions.SessionParseError, "Pickle length"):
            sessions.parse_navigation(bad_header)

        bad_url_length = (
            struct.pack("<Iii", 13, 1, 0)
            + struct.pack("<i", 100)
            + b"x"
        )
        with self.assertRaisesRegex(sessions.SessionParseError, "Pickle string"):
            sessions.parse_navigation(bad_url_length)

    def test_requires_page_state_and_transition_fields(self):
        body = (
            struct.pack("<ii", 5, 2)
            + pickle_string("https://example.com")
            + pickle_string("Example", utf16=True)
        )
        with self.assertRaisesRegex(sessions.SessionParseError, "Pickle string length"):
            sessions.parse_navigation(struct.pack("<I", len(body)) + body)

        body += pickle_string("")
        with self.assertRaisesRegex(
            sessions.SessionParseError, "navigation transition type"
        ):
            sessions.parse_navigation(struct.pack("<I", len(body)) + body)

    def test_empty_sessions_directory_exports_no_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            sessions_dir = Path(tmp)
            with (
                patch.object(
                    sessions,
                    "find_profile_files",
                    return_value=[("Default", sessions_dir)],
                ),
                patch.object(sessions, "write_outputs") as write_outputs,
            ):
                sessions.main()

        write_outputs.assert_called_once_with(
            "chrome_sessions",
            [],
            [],
            sessions.FIELDS,
            "no_navigation_updates_found",
        )

    def test_main_exports_navigation_updates_and_reports_unsupported_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            sessions_dir = Path(tmp)
            valid_file = sessions_dir / "Session_valid"
            valid_file.write_bytes(
                snss_file(b"\x06" + navigation_payload())
            )
            unsupported_file = sessions_dir / "Tabs_unsupported"
            unsupported_file.write_bytes(snss_file(version=5))
            errors = io.StringIO()

            with (
                patch.object(
                    sessions,
                    "find_profile_files",
                    return_value=[("Default", sessions_dir)],
                ),
                patch.object(sessions, "write_outputs") as write_outputs,
                redirect_stderr(errors),
            ):
                sessions.main()

        write_outputs.assert_called_once()
        name, records, sources, fields, empty_reason = write_outputs.call_args.args
        self.assertEqual(name, "chrome_sessions")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["url"], "https://example.com")
        self.assertEqual(fields, sessions.FIELDS)
        self.assertEqual(empty_reason, "no_navigation_updates_found")
        self.assertCountEqual(sources, [valid_file, unsupported_file])
        self.assertIn("Tabs_unsupported", errors.getvalue())
        self.assertIn("encrypted SNSS version 5 at byte offset 4", errors.getvalue())


if __name__ == "__main__":
    unittest.main()
