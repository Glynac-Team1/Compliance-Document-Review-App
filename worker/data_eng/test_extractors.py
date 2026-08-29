import unittest
import os
import tempfile
from worker.data_eng.extractors import TextExtractor

class TestTextExtractor(unittest.TestCase):
    def test_txt_extraction(self):
        """Tests extraction from plain text files."""
        with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt', encoding='utf-8') as tf:
            tf.write("Sample document content for compliance review.")
            temp_name = tf.name

        try:
            extracted = TextExtractor.extract(temp_name)
            self.assertIn("compliance review", extracted)
        finally:
            if os.path.exists(temp_name):
                os.remove(temp_name)

    def test_docx_extraction_if_present(self):
        """Tests DOCX extraction if brief docx is present."""
        sample_docx = os.path.join(os.path.dirname(__file__), "..", "..", "..", "Compliance_DocumentBrief .docx")
        if os.path.exists(sample_docx):
            extracted = TextExtractor.extract(sample_docx)
            self.assertTrue(len(extracted) > 100)

if __name__ == "__main__":
    unittest.main()
