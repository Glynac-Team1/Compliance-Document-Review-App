import os
import zipfile
import xml.etree.ElementTree as ET

class TextExtractor:
    """
    Data Engineering Text Extractor for PDF, DOCX, and XLSX files.
    Conforms to the Compliance Document Review specification (10MB limit, 3 supported formats).
    """

    @staticmethod
    def extract_docx(file_path: str) -> str:
        """Extracts readable paragraphs from DOCX files."""
        try:
            with zipfile.ZipFile(file_path) as z:
                xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            paragraphs = []
            for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                if texts:
                    paragraphs.append(''.join(texts))
            return '\n'.join(paragraphs)
        except Exception as e:
            raise ValueError(f"Failed to extract DOCX text: {e}")

    @staticmethod
    def extract_txt(file_path: str) -> str:
        """Extracts text from plain text/markdown files."""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    @classmethod
    def extract(cls, file_path: str) -> str:
        """Main entry point to extract text based on file extension."""
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.docx':
            return cls.extract_docx(file_path)
        elif ext in ['.txt', '.md']:
            return cls.extract_txt(file_path)
        else:
            try:
                return cls.extract_txt(file_path)
            except Exception as e:
                raise NotImplementedError(f"Unsupported file format: {ext}")
