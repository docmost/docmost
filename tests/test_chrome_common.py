import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import chrome_common


class FindProfileFilesTests(unittest.TestCase):
    def test_missing_roots_raise_specific_error(self):
        with patch.object(chrome_common, "chrome_bases", return_value=[Path("/missing")]):
            with self.assertRaises(chrome_common.ChromeProfileNotFoundError):
                chrome_common.find_profile_files("History")

    def test_missing_source_returns_no_matches_under_existing_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "Default").mkdir()
            with patch.object(chrome_common, "chrome_bases", return_value=[root]):
                self.assertEqual(chrome_common.find_profile_files("History"), [])

    def test_finds_source_in_each_supported_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            roots = [Path(tmp) / "chrome", Path(tmp) / "chromium"]
            paths = []
            for root in roots:
                source = root / "Default" / "History"
                source.parent.mkdir(parents=True)
                source.touch()
                paths.append(("Default", source))
            with patch.object(chrome_common, "chrome_bases", return_value=roots):
                self.assertEqual(chrome_common.find_profile_files("History"), paths)


class WriteOutputsTests(unittest.TestCase):
    def test_empty_export_requires_a_schema(self):
        with self.assertRaisesRegex(ValueError, "explicit CSV fieldnames"):
            chrome_common.write_outputs("test_export", [], [])

    def test_empty_export_has_stable_csv_schema_and_manifest_reason(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(chrome_common, "OUTPUT_DIR", Path(tmp)):
                manifest = chrome_common.write_outputs(
                    "test_export", [], [], ["profile", "url"], "no_bookmarks_found"
                )

            csv_path = next(Path(tmp).glob("test_export_*.csv"))
            manifest_path = next(Path(tmp).glob("test_export_manifest_*.json"))
            with csv_path.open(encoding="utf-8-sig", newline="") as f:
                self.assertEqual(next(csv.reader(f)), ["profile", "url"])
            saved_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["status"], "empty")
            self.assertEqual(saved_manifest["empty_reason"], "no_bookmarks_found")
            self.assertEqual(saved_manifest["record_count"], 0)


if __name__ == "__main__":
    unittest.main()
