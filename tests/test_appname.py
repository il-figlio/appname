import contextlib
import io
import json
import unittest
from unittest.mock import patch
from urllib.error import URLError

import appname


class NameChecks(unittest.TestCase):
    def test_exact_normalization_and_suffix(self):
        self.assertEqual(appname.classify("Café Notes", "CAFE-NOTES")[0], "exact")
        self.assertEqual(appname.classify("Cradle", "Cradle: Game Companion")[0], "similar")
        self.assertEqual(appname.classify("Cradle", "Weather Forecast")[0], "other")

    def test_empty_catalog_never_claims_available(self):
        result = appname.summarize("Unused", "us", "ios", [], "source")
        self.assertEqual(result["status"], "no_public_match")
        self.assertEqual(result["availability"], "unconfirmed")

    def test_exact_prioritized_and_duplicates_removed(self):
        apps = [{"trackId": 1, "trackName": "Cradle: Games"},
                {"trackId": 2, "trackName": "Cradle"},
                {"trackId": 2, "trackName": "Cradle"}]
        result = appname.summarize("Cradle", "us", "ios", apps, "source")
        self.assertEqual(result["status"], "exact_match")
        self.assertEqual([m["id"] for m in result["matches"]], [2, 1])

    def test_failure_is_not_an_empty_search_and_batch_continues(self):
        output = io.StringIO()
        with patch.object(appname, "fetch", side_effect=[URLError("offline"), ([], "source")]), \
                patch.object(appname.time, "sleep"), contextlib.redirect_stdout(output):
            status = appname.main(["check", "Cradle", "Nestling", "--json"])
        document = json.loads(output.getvalue())
        self.assertEqual(status, 1)
        self.assertEqual([r["status"] for r in document["results"]], ["error", "no_public_match"])

    def test_both_platforms_and_batch_deduplication(self):
        with patch.object(appname, "fetch", return_value=([], "source")) as fetch, \
                patch.object(appname.time, "sleep"), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(appname.main(["check", "Cradle", "Cradle", "--platform", "all", "--json"]), 0)
        self.assertEqual([call.args[2] for call in fetch.call_args_list], ["ios", "mac"])

    def test_invalid_input_never_sends_a_request(self):
        cases = [
            ["check"],
            ["check", "A"],
            ["check", "!?!"],
            ["check", "a" * 31],
            ["check", "Notes", "--country", "usa"],
            ["check", "Notes", "--limit", "0"],
            ["check", "Notes", "--timeout", "nan"],
            ["check", "Notes", "--timeout", "301"],
        ]
        for argv in cases:
            with self.subTest(argv=argv), patch.object(appname, "fetch") as fetch, \
                    contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    appname.main(argv)
                self.assertEqual(raised.exception.code, 2)
                fetch.assert_not_called()

    def test_stdin_combines_with_arguments_and_normalizes_country(self):
        output = io.StringIO()
        with patch("sys.stdin", io.StringIO("Notes\n\nNestling\n")), \
                patch.object(appname, "fetch", return_value=([], "source")) as fetch, \
                patch.object(appname.time, "sleep"), contextlib.redirect_stdout(output):
            status = appname.main(["check", "Notes", "--file", "-", "--country", "GB", "--json"])
        self.assertEqual(status, 0)
        self.assertEqual([call.args[:2] for call in fetch.call_args_list],
                         [("Notes", "gb"), ("Nestling", "gb")])
        self.assertEqual(len(json.loads(output.getvalue())["results"]), 2)


if __name__ == "__main__":
    unittest.main()
