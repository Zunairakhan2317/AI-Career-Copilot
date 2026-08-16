"""
PDF text extraction service.

Owns all raw text/layout extraction from resume PDFs. Tries PyMuPDF first
(fast, good layout handling), falls back to pdfplumber (better on tables)
if PyMuPDF comes back empty or too short to be a real resume.

Used by services/pipeline.py's parse_node — kept separate so extraction
logic can be tested/improved independently of the LangGraph pipeline.
"""

from __future__ import annotations

MIN_VIABLE_CHARS = 50  # below this, treat PDF extraction as failed/scanned


def extract_with_pymupdf(file_path: str) -> str:
    import fitz  # PyMuPDF

    text_parts = []
    with fitz.open(file_path) as doc:
        for page in doc:
            text_parts.append(page.get_text("text"))
    return "\n".join(text_parts).strip()


def extract_with_pdfplumber(file_path: str) -> str:
    import pdfplumber

    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
            for table in page.extract_tables() or []:
                for row in table:
                    text_parts.append(" | ".join(cell or "" for cell in row))
    return "\n".join(text_parts).strip()


def extract_resume_text(file_path: str) -> dict:
    """
    Extracts raw text from a resume PDF. PyMuPDF first, pdfplumber fallback.

    Returns a dict shaped for direct use as pipeline state updates:
        {"raw_text": str|None, "parse_method": "pymupdf"|"pdfplumber"|None, "parse_error": str|None}
    """
    try:
        text = extract_with_pymupdf(file_path)
        if len(text) >= MIN_VIABLE_CHARS:
            return {"raw_text": text, "parse_method": "pymupdf", "parse_error": None}
        pymupdf_note = f"only {len(text)} chars extracted"
    except Exception as e:
        pymupdf_note = str(e)

    try:
        text = extract_with_pdfplumber(file_path)
        if len(text) >= MIN_VIABLE_CHARS:
            return {"raw_text": text, "parse_method": "pdfplumber", "parse_error": None}
        fallback_note = f"pdfplumber also only got {len(text)} chars"
    except Exception as e:
        fallback_note = f"pdfplumber failed: {e}"

    return {
        "raw_text": None,
        "parse_method": None,
        "parse_error": (
            f"PDF extraction failed. pymupdf: {pymupdf_note}; pdfplumber: {fallback_note}. "
            f"File may be a scanned image (needs OCR, not handled here)."
        ),
    }
