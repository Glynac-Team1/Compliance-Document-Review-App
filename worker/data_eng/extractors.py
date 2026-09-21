"""
Format-aware text extraction for compliance document submissions.

Each supported format gets a purpose-built extractor rather than one
generic "read anything" function. This keeps unsupported files out of
the analysis pipeline and preserves extraction quality downstream.
DOCX uses stdlib-only parsing to avoid extra dependencies; PDF/XLSX use
pdfplumber/openpyxl since hand-rolling either binary format isn't worth it.
"""
import os
import zipfile
import xml.etree.ElementTree as ET
import logging

import pdfplumber
import openpyxl

from app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message

_DOCX_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
logger = logging.getLogger(__name__)


class ExtractionError(ValueError):
    """A classified extraction failure whose cause is retained by exception chaining."""

    def __init__(self, code: AnalysisErrorCode | str, technical_message: str = ""):
        self.code = AnalysisErrorCode(code)
        self.user_message = get_user_facing_message(self.code)
        self.technical_message = technical_message
        super().__init__(self.user_message)


class TextExtractor:
    """Text extractor for PDF, DOCX, and XLSX files."""

    @staticmethod
    def extract_docx(file_path: str) -> str:
        try:
            with zipfile.ZipFile(file_path) as z:
                xml_content = z.read("word/document.xml")
        except (zipfile.BadZipFile, KeyError, OSError) as e:
            raise ExtractionError(AnalysisErrorCode.DOCX_CORRUPTED, str(e)) from e

        try:
            tree = ET.fromstring(xml_content)
        except ET.ParseError as e:
            raise ExtractionError(AnalysisErrorCode.DOCX_CORRUPTED, str(e)) from e

        paragraphs = []
        for p in tree.iter(f"{_DOCX_NS}p"):
            texts = [node.text for node in p.iter(f"{_DOCX_NS}t") if node.text]
            if texts:
                paragraphs.append("".join(texts))
        text = "\n".join(paragraphs)
        if not text.strip():
            raise ExtractionError(AnalysisErrorCode.DOCX_EMPTY)
        return text

    @staticmethod
    def extract_pdf(file_path: str) -> str:
        """Extract every page independently and fail closed if any page is unreadable."""
        try:
            pdf = pdfplumber.open(file_path)
        except Exception as e:
            raise ExtractionError(AnalysisErrorCode.PDF_CORRUPTED, str(e)) from e

        pages = []
        failures = []
        try:
            logger.info("PDF extraction started: file=%s pages=%s", os.path.basename(file_path), len(pdf.pages))
            for page_number, page in enumerate(pdf.pages, start=1):
                try:
                    page_text = page.extract_text() or ""
                except Exception as e:
                    failures.append((page_number, e))
                    logger.warning(
                        "PDF page extraction failed: file=%s page=%s exception_type=%s",
                        os.path.basename(file_path), page_number, type(e).__name__,
                    )
                    page_text = ""
                pages.append(page_text)
                logger.info(
                    "PDF page extracted: file=%s page=%s extracted_chars=%s",
                    os.path.basename(file_path), page_number, len(page_text),
                )
        finally:
            pdf.close()

        total_chars = sum(len(page) for page in pages)
        logger.info(
            "PDF extraction completed: file=%s total_chars=%s", os.path.basename(file_path), total_chars
        )
        if failures:
            raise ExtractionError(
                AnalysisErrorCode.PDF_PARTIAL_EXTRACTION,
                "; ".join(f"page {number}: {type(error).__name__}: {error}" for number, error in failures),
            ) from failures[0][1]
        if not any(page.strip() for page in pages):
            raise ExtractionError(AnalysisErrorCode.PDF_NO_TEXT)
        return "\n".join(pages)

    @staticmethod
    def extract_xlsx(file_path: str) -> str:
        """Reads calculated values (data_only=True), not formula strings."""
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
            try:
                lines = []
                for sheet in wb.worksheets:
                    for row in sheet.iter_rows(values_only=True):
                        cells = [str(cell) for cell in row if cell is not None]
                        if cells:
                            lines.append(" ".join(cells))
                text = "\n".join(lines)
            finally:
                wb.close()
        except Exception as e:
            if isinstance(e, ExtractionError):
                raise
            raise ExtractionError(AnalysisErrorCode.XLSX_CORRUPTED, str(e)) from e
        if not text.strip():
            raise ExtractionError(AnalysisErrorCode.XLSX_EMPTY)
        return text

    @classmethod
    def extract(cls, file_path: str) -> str:
        """Dispatches on extension, then validates the result isn't
        empty. An empty-but-'successful' extraction (e.g. a scanned PDF
        with no text layer) is worse than an error — it would let a
        document sail through masking/embedding as if it had no content."""
        ext = os.path.splitext(file_path)[1].lower()
        dispatch = {
            ".pdf": cls.extract_pdf,
            ".docx": cls.extract_docx,
            ".xlsx": cls.extract_xlsx,
        }

        extractor = dispatch.get(ext)
        if extractor is None:
            raise ExtractionError(AnalysisErrorCode.UNSUPPORTED_FORMAT, ext or "(no extension)")

        try:
            if os.path.getsize(file_path) == 0:
                raise ExtractionError(AnalysisErrorCode.FILE_EMPTY)
        except OSError as e:
            raise ExtractionError(AnalysisErrorCode.TEXT_READ_ERROR, str(e)) from e

        text = extractor(file_path)

        if not text or not text.strip():
            code = AnalysisErrorCode.EXTRACTION_FAILED
            if ext == ".pdf":
                code = AnalysisErrorCode.PDF_NO_TEXT
            elif ext == ".docx":
                code = AnalysisErrorCode.DOCX_EMPTY
            elif ext == ".xlsx":
                code = AnalysisErrorCode.XLSX_EMPTY
            raise ExtractionError(code)
        return text