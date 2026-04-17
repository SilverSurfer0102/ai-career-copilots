import os
from .pdf_parser import parse_pdf
from .docx_parser import parse_docx
from .text_parser import parse_text


def dispatch_parse(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return parse_pdf(file_path)
    elif ext in (".docx", ".doc"):
        return parse_docx(file_path)
    elif ext in (".txt", ".md"):
        return parse_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
