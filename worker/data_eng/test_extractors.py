import os
import tempfile
import unittest
import zipfile
from unittest.mock import MagicMock, patch

import openpyxl
from fpdf import FPDF

from worker.data_eng.extractors import TextExtractor, ExtractionError
from app.core.analysis_errors import AnalysisErrorCode

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


def _make_xlsx(path: str, cell_value: str | None) -> None:
    wb = openpyxl.Workbook()
    if cell_value is not None:
        wb.active["A1"] = cell_value
    wb.save(path)


def _make_pdf(path: str, text: str) -> None:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 10, text)
    pdf.output(path)


def _make_multipage_pdf(path: str) -> None:
    pdf = FPDF()
    for text in ("Page one compliance text", "Page two disclosure text"):
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

    def test_multipage_pdf_extraction_preserves_both_pages(self):
        path = self._tmp_path(".pdf")
        _make_multipage_pdf(path)
        text = TextExtractor.extract(path)
        self.assertIn("Page one compliance text", text)
        self.assertIn("Page two disclosure text", text)

    def test_scanned_pdf_is_classified_as_no_text(self):
        path = self._tmp_path(".pdf")
        pdf = FPDF()
        pdf.add_page()
        pdf.output(path)
        with self.assertRaises(ExtractionError) as context:
            TextExtractor.extract(path)
        self.assertEqual(context.exception.code, AnalysisErrorCode.PDF_NO_TEXT)
        self.assertIn("image-only", context.exception.user_message)

    def test_corrupted_pdf_is_classified(self):
        path = self._tmp_path(".pdf")
        with open(path, "wb") as file:
            file.write(b"not a pdf")
        with self.assertRaises(ExtractionError) as context:
            TextExtractor.extract(path)
        self.assertEqual(context.exception.code, AnalysisErrorCode.PDF_CORRUPTED)

    def test_pdf_page_failure_fails_closed(self):
        path = self._tmp_path(".pdf")
        _make_pdf(path, "Readable page")
        with patch("worker.data_eng.extractors.pdfplumber.open") as open_pdf:
            page = MagicMock()
            page.extract_text.side_effect = RuntimeError("layout failure")
            open_pdf.return_value.pages = [page]
            with self.assertRaises(ExtractionError) as context:
                TextExtractor.extract(path)
        self.assertEqual(context.exception.code, AnalysisErrorCode.PDF_PARTIAL_EXTRACTION)

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

    def test_empty_docx_is_classified(self):
        path = self._tmp_path(".docx")
        _make_docx(path, "")
        with self.assertRaises(ExtractionError) as context:
            TextExtractor.extract(path)
        self.assertEqual(context.exception.code, AnalysisErrorCode.DOCX_EMPTY)

    def test_empty_xlsx_is_classified(self):
        path = self._tmp_path(".xlsx")
        _make_xlsx(path, None)
        with self.assertRaises(ExtractionError) as context:
            TextExtractor.extract(path)
        self.assertEqual(context.exception.code, AnalysisErrorCode.XLSX_EMPTY)

    def test_corrupted_xlsx_is_classified(self):
        path = self._tmp_path(".xlsx")
        with open(path, "wb") as file:
            file.write(b"not an xlsx")
        with self.assertRaises(ExtractionError) as context:
            TextExtractor.extract(path)
        self.assertEqual(context.exception.code, AnalysisErrorCode.XLSX_CORRUPTED)


if __name__ == "__main__":
    unittest.main()