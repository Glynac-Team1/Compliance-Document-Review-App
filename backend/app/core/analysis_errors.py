from enum import Enum


class AnalysisErrorCode(str, Enum):
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    FILE_EMPTY = "FILE_EMPTY"
    PDF_CORRUPTED = "PDF_CORRUPTED"
    PDF_NO_TEXT = "PDF_NO_TEXT"
    PDF_PARTIAL_EXTRACTION = "PDF_PARTIAL_EXTRACTION"
    DOCX_CORRUPTED = "DOCX_CORRUPTED"
    DOCX_EMPTY = "DOCX_EMPTY"
    XLSX_CORRUPTED = "XLSX_CORRUPTED"
    XLSX_EMPTY = "XLSX_EMPTY"
    TEXT_READ_ERROR = "TEXT_READ_ERROR"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    STORAGE_DOWNLOAD_FAILED = "STORAGE_DOWNLOAD_FAILED"
    EMBEDDING_FAILED = "EMBEDDING_FAILED"
    RAG_RETRIEVAL_FAILED = "RAG_RETRIEVAL_FAILED"
    LLM_FAILED = "LLM_FAILED"
    UNKNOWN_ANALYSIS_ERROR = "UNKNOWN_ANALYSIS_ERROR"


USER_FACING_MESSAGES = {
    AnalysisErrorCode.UNSUPPORTED_FORMAT: (
        "This file format is not supported for automated AI analysis. "
        "Please upload a PDF, DOCX, XLSX, TXT, or MD file."
    ),
    AnalysisErrorCode.FILE_EMPTY: "The uploaded document is empty and could not be analyzed.",
    AnalysisErrorCode.PDF_NO_TEXT: (
        "This PDF does not contain extractable text. It may be scanned or image-only "
        "and requires OCR or manual review."
    ),
    AnalysisErrorCode.PDF_CORRUPTED: (
        "The PDF could not be read because the file appears to be corrupted or invalid. "
        "Please upload a valid copy."
    ),
    AnalysisErrorCode.PDF_PARTIAL_EXTRACTION: (
        "Some pages in this PDF could not be read. The document requires manual review "
        "or a valid replacement copy."
    ),
    AnalysisErrorCode.DOCX_CORRUPTED: (
        "The document could not be read because the file appears to be corrupted or invalid. "
        "Please upload a valid copy."
    ),
    AnalysisErrorCode.DOCX_EMPTY: "The uploaded DOCX document is empty and could not be analyzed.",
    AnalysisErrorCode.XLSX_CORRUPTED: (
        "The document could not be read because the file appears to be corrupted or invalid. "
        "Please upload a valid copy."
    ),
    AnalysisErrorCode.XLSX_EMPTY: "The uploaded XLSX workbook is empty and could not be analyzed.",
    AnalysisErrorCode.TEXT_READ_ERROR: "The document could not be read. Please upload a valid copy.",
    AnalysisErrorCode.EXTRACTION_FAILED: (
        "The document could not be extracted for automated AI analysis. Please proceed with manual review."
    ),
    AnalysisErrorCode.STORAGE_DOWNLOAD_FAILED: (
        "The document could not be retrieved for AI analysis. Please try again."
    ),
    AnalysisErrorCode.EMBEDDING_FAILED: (
        "The document was read, but its analysis preparation failed. Please try again or proceed with manual review."
    ),
    AnalysisErrorCode.RAG_RETRIEVAL_FAILED: (
        "The AI analysis could not be completed because the required compliance reference data "
        "could not be retrieved. Please try again or proceed with manual review."
    ),
    AnalysisErrorCode.LLM_FAILED: (
        "The document was processed, but the AI analysis is currently unavailable and could not be completed. "
        "Please try again or proceed with manual review."
    ),
    AnalysisErrorCode.UNKNOWN_ANALYSIS_ERROR: (
        "AI analysis is currently unavailable for this submission. Please try again or proceed with manual review."
    ),
}


def get_user_facing_message(error_code: str | AnalysisErrorCode) -> str:
    return USER_FACING_MESSAGES.get(
        AnalysisErrorCode(error_code), USER_FACING_MESSAGES[AnalysisErrorCode.UNKNOWN_ANALYSIS_ERROR]
    )