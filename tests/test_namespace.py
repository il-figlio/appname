import unittest
from unittest.mock import patch
from api.namespace import lookup, search

class NamespaceTests(unittest.TestCase):
    @patch("api.namespace.get", return_value=(404, {}))
    def test_missing_not_available(self, _):
        self.assertEqual(lookup("username", "example", "github")["status"], "no_public_match")
        self.assertEqual(lookup("domain", "example", "com", {"com":"https://rdap.example"})["status"], "no_public_match")

    @patch("api.namespace.get", return_value=(200, {"login":"example"}))
    def test_positive(self, _):
        self.assertEqual(lookup("username","example","github")["status"], "taken")

    @patch("api.namespace.get", return_value=(429, {}))
    def test_throttled(self, _):
        self.assertEqual(lookup("username","example","github")["status"], "rate_limited")

    def test_validation(self):
        self.assertEqual(search("/?mode=domain&name=foo.bar&targets=com")[0], 400)
        self.assertEqual(search("/?mode=username&name=foo&targets=unknown")[0], 400)
        self.assertEqual(lookup("username","foo_bar","github")["status"], "invalid")

if __name__ == "__main__":
    unittest.main()
