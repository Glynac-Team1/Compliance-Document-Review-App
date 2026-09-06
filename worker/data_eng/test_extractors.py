import os
import tempfile
import unittest
import zipfile

import openpyxl
from fpdf import FPDF

from worker.data_eng.extractors import TextExtractor, ExtractionError

_DOCX_DOCUMENT_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body>
</w:document>"""


def _make_docx(path: str, text: str) -> None:
    """Hand-builds a minimal valid .docx — mirrors exactly the XML shape
    extract_docx() reads, so we don't need python-docx as a dependency
    just to test the extractor that deliberately avoids it."""
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("word/document.xml", _DOCX_DOCUMENT_XML.format(text=text))


def _make_xlsx(path: str, cell_value: str) -> None:
    wb = openpyxl.Workbook()
    wb.active["A1"] = cell_value
    wb.save(path)


def _make_pdf(path: str, text: str) -> None:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 10, text)
    pdf.output(path)


class TestTextExtractor(unittest.TestCase):
    def setUp(self):
        self._tmp_files = []

    def tearDown(self):
        for path in self._tmp_files:
            if os.path.exists(path):
                os.remove(path)

    def _tmp_path(self, suffix: str) -> str:
        fd, path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        self._tmp_files.append(path)
        return path

    def test_txt_extraction(self):
        path = self._tmp_path(".txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write("Sample document content for compliance review.")
        self.assertIn("compliance review", TextExtractor.extract(path))

    def test_docx_extraction(self):
        path = self._tmp_path(".docx")
        _make_docx(path, "Guaranteed 20% annual returns on this fund.")
        self.assertIn("Guaranteed 20% annual returns", TextExtractor.extract(path))

    def test_xlsx_extraction(self):
        path = self._tmp_path(".xlsx")
        _make_xlsx(path, "Client account summary Q3")
        self.assertIn("Client account summary Q3", TextExtractor.extract(path))

    def test_pdf_extraction(self):
        path = self._tmp_path(".pdf")
        _make_pdf(path, "Past performance is no guarantee of future results.")
        self.assertIn("Past performance", TextExtractor.extract(path))

    def test_unsupported_extension_raises(self):
        path = self._tmp_path(".exe")
        with open(path, "wb") as f:
            f.write(b"\x00\x01\x02binary-junk")
        with self.assertRaises(ExtractionError):
            TextExtractor.extract(path)

    def test_empty_file_raises(self):
        path = self._tmp_path(".txt")
        open(path, "w").close()
        with self.assertRaises(ExtractionError):
            TextExtractor.extract(path)

    def test_corrupted_docx_raises(self):
        path = self._tmp_path(".docx")
        with open(path, "wb") as f:
            f.write(b"not actually a zip file")
        with self.assertRaises(ExtractionError):
            TextExtractor.extract(path)


if __name__ == "__main__":
    unittest.main()