import unittest
from unittest.mock import patch
from urllib.error import URLError

from api import search as web


class WebSearchTests(unittest.TestCase):
    def setUp(self):
        web._CACHE.clear()
        web._LAST_REQUEST = 0

    def test_invalid_parameters_never_call_apple(self):
        cases = ["", "?name=x", "?name=%21%21", "?name=Valid&platform=all",
                 "?name=Valid&country=usa", "?name=Valid&name=Other", "?name=Valid&url=https://example.com"]
        with patch.object(web.appname, "fetch") as fetch:
            for query in cases:
                with self.subTest(query=query):
                    status, result, _ = web.search("/api/search" + query)
                    self.assertEqual(status, 400)
                    self.assertEqual(result["availability"], "unconfirmed")
            fetch.assert_not_called()

    def test_real_search_contract_and_repeat_cache(self):
        with patch.object(web.appname, "fetch", return_value=([{"trackId": 1, "trackName": "Café Notes"}], "source")) as fetch:
            status, result, _ = web.search("/api/search?name=Caf%C3%A9%20Notes&country=GB&platform=mac")
            self.assertEqual(status, 200)
            self.assertEqual(result["status"], "exact_match")
            self.assertEqual(result["country"], "gb")
            self.assertEqual(result["availability"], "unconfirmed")
            self.assertIn("checked_at", result)
            self.assertEqual(web.search("/api/search?name=Caf%C3%A9%20Notes&country=gb&platform=mac")[0], 200)
            fetch.assert_called_once_with("Café Notes", "gb", "mac", 12)

    def test_upstream_failure_is_not_a_clean_result(self):
        with patch.object(web.appname, "fetch", side_effect=URLError("offline")):
            status, result, _ = web.search("/api/search?name=Example")
        self.assertEqual(status, 502)
        self.assertEqual(result["status"], "error")

    def test_malformed_catalog_fails_closed(self):
        with patch.object(web.appname, "fetch", return_value=([None], "source")):
            self.assertEqual(web.search("/api/search?name=Example")[0], 502)

    def test_uncached_requests_are_paced(self):
        with patch.object(web.appname, "fetch", return_value=([], "source")):
            self.assertEqual(web.search("/api/search?name=First")[0], 200)
            status, result, headers = web.search("/api/search?name=Second")
            self.assertEqual(status, 429)
            self.assertIn("Retry-After", headers)
            self.assertEqual(result["availability"], "unconfirmed")


if __name__ == "__main__":
    unittest.main()
