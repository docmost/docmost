import csv
import struct
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import chrome_common
import chrome_export_all
import chrome_sessions_export


def make_pickle(tab_id=17, index=2, url="https://example.test/",
                title="Café 東京"):
    url_bytes = url.encode("utf-8")
    title_bytes = title.encode("utf-16-le")
    body = struct.pack("<iii", tab_id, index, len(url_bytes))
    body += url_bytes + b"\0" * ((-len(url_bytes)) % 4)
    body += struct.pack("<i", len(title)) + title_bytes
    body += b"\0" * ((-len(title_bytes)) % 4)
    return struct.pack("<i", len(body)) + body


def make_snss(command=b""):
    return b"SNSS" + struct.pack("<I", 3) + command


class SessionParserTests(unittest.TestCase):
    def test_reads_cleartext_header_and_pickle_navigation(self):
        pickle = make_pickle()
        data = make_snss(struct.pack("<H", len(pickle) + 1) +
                         bytes([chrome_sessions_export.UPDATE_TAB_NAVIGATION]) +
                         pickle)

        commands = list(chrome_sessions_export.read_commands(data))
        self.assertEqual(commands[0][0], 6)
        self.assertEqual(
            chrome_sessions_export.parse_navigation(commands[0][1],
                                                    commands[0][2]),
            (17, 2, "https://example.test/", "Café 東京"),
        )

    def test_recognizes_unsupported_and_encrypted_versions(self):
        with self.assertRaises(chrome_sessions_export.UnsupportedSNSSVersionError) as ctx:
            list(chrome_sessions_export.read_commands(b"SNSS" + struct.pack("<I", 5)))
        self.assertEqual(ctx.exception.offset, 4)
        self.assertIn("encrypted", ctx.exception.reason)

        with self.assertRaises(chrome_sessions_export.UnsupportedSNSSVersionError):
            list(chrome_sessions_export.read_commands(b"SNSS" + struct.pack("<I", 99)))

    def test_rejects_bad_framing_and_trailing_bytes_with_offsets(self):
        for data, offset in (
            (b"SNSS", 4),
            (make_snss(b"\0"), 8),
            (make_snss(b"\x04\0\x06"), 8),
        ):
            with self.subTest(data=data):
                with self.assertRaises(chrome_sessions_export.SNSSParseError) as ctx:
                    list(chrome_sessions_export.read_commands(data))
                self.assertEqual(ctx.exception.offset, offset)

    def test_rejects_invalid_pickle_and_negative_lengths(self):
        with self.assertRaises(chrome_sessions_export.SNSSParseError):
            chrome_sessions_export.parse_navigation(b"\x01\0\0\0")

        negative_url = struct.pack("<i", 12) + struct.pack("<iii", 1, 0, -1)
        with self.assertRaisesRegex(chrome_sessions_export.SNSSParseError,
                                    "negative URL"):
            chrome_sessions_export.parse_navigation(negative_url)

        body = struct.pack("<iii", 1, 0, 0) + struct.pack("<i", -1)
        negative_title = struct.pack("<i", len(body)) + body
        with self.assertRaisesRegex(chrome_sessions_export.SNSSParseError,
                                    "negative title"):
            chrome_sessions_export.parse_navigation(negative_title)


class ProfileLookupTests(unittest.TestCase):
    def test_distinguishes_missing_profile_from_missing_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "missing"
            with patch.object(chrome_common, "chrome_base", return_value=root):
                with self.assertRaises(chrome_common.ChromeProfileNotFoundError):
                    chrome_common.find_profile_files("Sessions")

            root.mkdir()
            (root / "Default").mkdir()
            with patch.object(chrome_common, "chrome_base", return_value=root):
                with self.assertRaises(chrome_common.ChromeSourceNotFoundError):
                    chrome_common.find_profile_files("Sessions")

            (root / "Default" / "Sessions").mkdir()
            with patch.object(chrome_common, "chrome_base", return_value=root):
                self.assertEqual(
                    chrome_common.find_profile_files("Sessions"),
                    [("Default", root / "Default" / "Sessions")],
                )

    def test_uses_existing_chromium_installation(self):
        with tempfile.TemporaryDirectory() as tmp:
            primary = Path(tmp) / "chrome"
            alternate = Path(tmp) / "chromium"
            alternate.mkdir()
            with patch.object(chrome_common, "_chrome_base_candidates",
                              return_value=[primary, alternate]):
                self.assertEqual(chrome_common.chrome_base(), alternate)

    def test_empty_sessions_export_has_schema_and_reason(self):
        with tempfile.TemporaryDirectory() as tmp:
            sessions = Path(tmp) / "Sessions"
            sessions.mkdir()
            with (patch.object(chrome_sessions_export, "find_profile_files",
                               return_value=[("Default", sessions)]),
                  patch.object(chrome_common, "OUTPUT_DIR", Path(tmp) / "output")):
                result = chrome_sessions_export.main()

            self.assertEqual(result["status"], "empty")
            self.assertEqual(result["empty_reason"], "no_source_files")
            csv_file = Path(result["output_files"][0]["path"])
            with csv_file.open(encoding="utf-8-sig", newline="") as f:
                self.assertEqual(next(csv.reader(f)),
                                 chrome_sessions_export.OUTPUT_FIELDS)

    def test_malformed_file_is_reported_as_partial(self):
        with tempfile.TemporaryDirectory() as tmp:
            sessions = Path(tmp) / "Sessions"
            sessions.mkdir()
            (sessions / "Session_bad").write_bytes(make_snss(b"\x01"))
            with (patch.object(chrome_sessions_export, "find_profile_files",
                               return_value=[("Default", sessions)]),
                  patch.object(chrome_common, "OUTPUT_DIR", Path(tmp) / "output"),
                  patch("builtins.print")):
                result = chrome_sessions_export.main()

            self.assertEqual(result["status"], "partial")
            self.assertEqual(result["errors"][0]["offset"], 8)


class ExportRunnerTests(unittest.TestCase):
    def test_reports_skipped_failed_and_partial_exports(self):
        skipped = types.SimpleNamespace(
            __name__="source_export",
            main=unittest.mock.Mock(
                side_effect=chrome_common.ChromeSourceNotFoundError("no source")),
        )
        failed = types.SimpleNamespace(
            __name__="failed_export",
            main=unittest.mock.Mock(side_effect=OSError("read failed")),
        )
        partial = types.SimpleNamespace(
            __name__="partial_export",
            main=unittest.mock.Mock(return_value={"status": "partial"}),
        )
        with patch.object(chrome_export_all, "EXPORTERS",
                          [skipped, failed, partial]), patch("builtins.print") as output:
            self.assertEqual(chrome_export_all.main(), 1)

        summary = "\n".join(str(call.args[0]) for call in output.call_args_list)
        self.assertIn("skipped: source_export", summary)
        self.assertIn("failed: failed_export", summary)
        self.assertIn("partial: partial_export", summary)


if __name__ == "__main__":
    unittest.main()
