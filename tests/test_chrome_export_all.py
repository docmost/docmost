import contextlib
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import chrome_common
import chrome_export_all


class ExportAllTests(unittest.TestCase):
    def test_reports_partial_results_and_only_skips_missing_profile_roots(self):
        complete = SimpleNamespace(
            __name__="complete_export",
            main=Mock(return_value={"record_count": 2}),
        )
        missing_profile = SimpleNamespace(
            __name__="missing_profile_export",
            main=Mock(side_effect=chrome_common.ChromeProfileNotFoundError("no root")),
        )
        missing_file = SimpleNamespace(
            __name__="missing_file_export",
            main=Mock(side_effect=FileNotFoundError("source disappeared")),
        )
        output = io.StringIO()
        with patch.object(
            chrome_export_all, "EXPORTERS", [complete, missing_profile, missing_file]
        ), contextlib.redirect_stdout(output):
            result = chrome_export_all.main()

        self.assertEqual(result, 1)
        self.assertIn("2 total records", output.getvalue())
        self.assertIn("Partial results were exported.", output.getvalue())
        self.assertIn("missing_profile_export: skipped", output.getvalue())
        self.assertIn("missing_file_export: failed", output.getvalue())


if __name__ == "__main__":
    unittest.main()
