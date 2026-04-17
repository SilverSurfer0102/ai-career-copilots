import os
import tempfile
from services.parsers.text_parser import parse_text
from services.parsers.dispatcher import dispatch_parse


def test_parse_text_file():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("Hello, this is a test resume.\nSoftware Engineer at Acme Corp.")
        path = f.name
    try:
        result = parse_text(path)
        assert "Software Engineer" in result
        assert "Acme Corp" in result
    finally:
        os.unlink(path)


def test_dispatcher_txt():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("Dispatcher test content")
        path = f.name
    try:
        result = dispatch_parse(path)
        assert "Dispatcher test" in result
    finally:
        os.unlink(path)


def test_dispatcher_md():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("# Resume\n\n## Skills\n- Python\n- FastAPI")
        path = f.name
    try:
        result = dispatch_parse(path)
        assert "Python" in result
    finally:
        os.unlink(path)


def test_dispatcher_unsupported_raises():
    import pytest
    with pytest.raises(ValueError, match="Unsupported"):
        dispatch_parse("/tmp/file.xyz")
