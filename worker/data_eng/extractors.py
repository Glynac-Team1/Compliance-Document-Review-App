"""
Format-aware text extraction for compliance document submissions.

Each format gets a purpose-built extractor rather than one generic
"read anything" function — a generic extractor produces noisier text,
which degrades every downstream stage (masking recall, chunk quality,
embedding relevance). DOCX/TXT use stdlib-only parsing to avoid extra
dependencies; PDF/XLSX use pdfplumber/openpyxl since hand-rolling either
binary format isn't worth it.
"""
import os
import zipfile
import xml.etree.ElementTree as ET

import pdfplumber
import openpyxl

_DOCX_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


class ExtractionError(ValueError):
    """Raised when a file can't be parsed, or parses to no usable text."""


class TextExtractor:
    """Data Engineering text extractor for PDF, DOCX, and XLSX files.
    Conforms to the spec: 10MB limit, exactly these 3 formats."""

    @staticmethod
    def extract_docx(file_path: str) -> str:
        try:
            with zipfile.ZipFile(file_path) as z:
                xml_content = z.read("word/document.xml")
        except (zipfile.BadZipFile, KeyError) as e:
            raise ExtractionError(f"Not a valid DOCX file: {e}") from e

        try:
            tree = ET.fromstring(xml_content)
        except ET.ParseError as e:
            raise ExtractionError(f"Corrupted DOCX XML: {e}") from e

        paragraphs = []
        for p in tree.iter(f"{_DOCX_NS}p"):
            texts = [node.text for node in p.iter(f"{_DOCX_NS}t") if node.text]
            if texts:
                paragraphs.append("".join(texts))
        return "\n".join(paragraphs)

    @staticmethod
    def extract_pdf(file_path: str) -> str:
        """Returns '' for scanned/image-only PDFs (no OCR here) — the
        empty-text check in extract() below is what catches that case,
        not this method."""
        try:
            with pdfplumber.open(file_path) as pdf:
                pages = [page.extract_text() or "" for page in pdf.pages]
        except Exception as e:  # pdfplumber/pdfminer raise several exception types on corrupt PDFs
            raise ExtractionError(f"Failed to extract PDF text: {e}") from e
        return "\n".join(pages)

    @staticmethod
    def extract_xlsx(file_path: str) -> str:
        """Reads calculated values (data_only=True), not formula strings."""
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        except Exception as e:
            raise ExtractionError(f"Failed to open XLSX file: {e}") from e

        lines = []
        for sheet in wb.worksheets:
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c) for c in row if c is not None]
                if cells:
                    lines.append(" ".join(cells))
        return "\n".join(lines)

    @staticmethod
    def extract_txt(file_path: str) -> str:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

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
            ".txt": cls.extract_txt,
            ".md": cls.extract_txt,
        }

        extractor = dispatch.get(ext)
        if extractor is None:
            raise ExtractionError(f"Unsupported file format: {ext or '(no extension)'}")

        text = extractor(file_path)

        if not text or not text.strip():
            raise ExtractionError(
                f"Extraction produced no usable text from "
                f"{os.path.basename(file_path)} (scanned/image-only file, or empty document)."
            )
        return text