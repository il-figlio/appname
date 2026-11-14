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

    def test_previews_only_expose_apple_cdn_images(self):
        app = {"trackId": 2, "trackName": "Example",
               "artworkUrl512": "https://is1-ssl.mzstatic.com/icon.png",
               "screenshotUrls": ["https://evil.example/shot.png", "javascript:alert(1)",
                                  "https://is2-ssl.mzstatic.com/shot.png",
                                  "https://is2-ssl.mzstatic.com/shot.png"],
               "description": "A real listing description", "primaryGenreName": "Productivity"}
        with patch.object(web.appname, "fetch", return_value=([app], "source")):
            status, result, _ = web.search("/api/search?name=Example")
        self.assertEqual(status, 200)
        preview = result["matches"][0]["preview"]
        self.assertEqual(preview["screenshots"], ["https://is2-ssl.mzstatic.com/shot.png"])
        self.assertTrue(preview["icon"].startswith("https://is1-ssl.mzstatic.com/"))
        self.assertEqual(preview["category"], "Productivity")
        self.assertGreater(len(result["suggestions"]), 0)
        for value in ["https://mzstatic.com.evil.example/image", "http://is1.mzstatic.com/image",
                      "https://user@is1.mzstatic.com/image", None]:
            self.assertIsNone(web.media_url(value))

    def test_missing_media_and_ipad_fallback_are_explicit(self):
        self.assertEqual(web.preview({})["screenshots"], [])
        self.assertIsNone(web.preview({})["icon"])
        preview = web.preview({"screenshotUrls": None,
                               "ipadScreenshotUrls": ["https://is1.mzstatic.com/ipad.png"]})
        self.assertEqual(preview["screenshots"], ["https://is1.mzstatic.com/ipad.png"])

    def test_empty_search_does_not_trigger_suggestion_fanout(self):
        with patch.object(web.appname, "fetch", return_value=([], "source")) as fetch:
            status, result, _ = web.search("/api/search?name=Unusual")
        self.assertEqual(status, 200)
        self.assertNotIn("suggestions", result)
        fetch.assert_called_once()

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
