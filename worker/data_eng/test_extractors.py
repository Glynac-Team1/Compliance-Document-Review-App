import unittest
import os
from worker.data_eng.extractors import TextExtractor

class TestTextExtractor(unittest.TestCase):
    def test_docx_extraction(self):
        sample_docx = os.path.join(os.path.dirname(__file__), "..", "..", "Compliance_DocumentBrief .docx")
        if os.path.exists(sample_docx):
            extracted = TextExtractor.extract(sample_docx)
            self.assertTrue(len(extracted) > 100)
            self.assertIn("Compliance", extracted)

if __name__ == "__main__":
    unittest.main()
