from __future__ import annotations

import unittest

from model_service.backend import BioCLIPBackend


class BioCLIPV17ContextTests(unittest.TestCase):
    def test_photo_date_uses_month_and_day(self) -> None:
        self.assertEqual(BioCLIPBackend._photo_date("2026-07-13"), "07-13")
        self.assertEqual(BioCLIPBackend._photo_date("07-13"), "07-13")
        self.assertEqual(BioCLIPBackend._photo_date(""), "__skip__")

    def test_life_form_is_extracted_from_semantic_notes(self) -> None:
        self.assertEqual(BioCLIPBackend._life_form({"notes": "黄色花的灌木"}), "灌木")
        self.assertEqual(BioCLIPBackend._life_form({"notes": "湿地禾本科草本"}), "草本")
        self.assertEqual(BioCLIPBackend._life_form({"lifeForm": "藤本", "notes": "草本"}), "藤本")


if __name__ == "__main__":
    unittest.main()
