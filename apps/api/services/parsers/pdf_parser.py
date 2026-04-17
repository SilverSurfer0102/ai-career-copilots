from io import StringIO
from pdfminer.high_level import extract_text_to_fp
from pdfminer.layout import LAParams


def parse_pdf(file_path: str) -> str:
    output = StringIO()
    with open(file_path, "rb") as f:
        extract_text_to_fp(f, output, laparams=LAParams(), output_type="text", codec="utf-8")
    return output.getvalue().strip()
