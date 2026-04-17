"""
Stub for semantic / vector retrieval.
Implement this when pgvector embeddings are ready.
Replace keyword scoring in retrieval.py with hybrid scoring that calls this.
"""
from typing import Protocol


class SemanticRetriever(Protocol):
    async def embed(self, text: str) -> list[float]: ...
    async def search(self, query_embedding: list[float], top_k: int) -> list[dict]: ...


# TODO: Implement with pgvector + Anthropic or OpenAI embeddings
class StubSemanticRetriever:
    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError("Semantic retrieval not yet implemented")

    async def search(self, query_embedding: list[float], top_k: int) -> list[dict]:
        raise NotImplementedError("Semantic retrieval not yet implemented")
