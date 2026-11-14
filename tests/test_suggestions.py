import unittest

from suggestions import key, suggest_names


class SuggestionsTests(unittest.TestCase):
    def test_related_words_and_spelling_are_mixed_without_duplicates(self):
        suggestions = suggest_names('Cradle')
        self.assertTrue(any(s['kind'] == 'related word' for s in suggestions))
        self.assertTrue(any(s['kind'] == 'spelling variation' for s in suggestions))
        names = [key(s['name']) for s in suggestions]
        self.assertEqual(len(names), len(set(names)))
        self.assertNotIn(key('Cradle'), names)
        self.assertTrue(all('availability' not in s for s in suggestions))

    def test_long_and_unicode_names_still_get_valid_candidates(self):
        for name in ['a' * 30, 'Café Notes', '星の旅']:
            with self.subTest(name=name):
                suggestions = suggest_names(name)
                self.assertGreaterEqual(len(suggestions), 3)
                self.assertTrue(all(2 <= len(s['name']) <= 30 for s in suggestions))
                self.assertNotIn(key(name), [key(s['name']) for s in suggestions])
