from __future__ import annotations

import hashlib
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest


RAG_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = RAG_ROOT.parent
sys.path.insert(0, str(RAG_ROOT))

from app.config import Settings  # noqa: E402
from app.content_indexer import build_knowledge_base  # noqa: E402
from app.index_store import IndexStore, ProjectChunk  # noqa: E402
from app.llm import LLMAnswer, LLMProvider  # noqa: E402
from app.retrieval import HybridRetriever  # noqa: E402
from app.service import RAGService  # noqa: E402


class HashEmbeddingProvider:
    def __init__(self, dimension: int = 256) -> None:
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    def _encode(self, text: str) -> np.ndarray:
        vector = np.zeros(self.dimension, dtype="float32")
        for token in text.lower().replace("-", " ").split():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            position = int.from_bytes(digest[:4], "little") % self.dimension
            vector[position] += 1.0
        norm = float(np.linalg.norm(vector))
        return vector / norm if norm else vector

    def encode_documents(self, texts):
        return np.asarray([self._encode(text) for text in texts], dtype="float32")

    def encode_query(self, text: str) -> np.ndarray:
        return self._encode(text)


class NumpyInnerProductIndex:
    def __init__(self, vectors: np.ndarray) -> None:
        self.vectors = np.asarray(vectors, dtype="float32")
        self.ntotal = self.vectors.shape[0]
        self.d = self.vectors.shape[1]

    def search(self, query: np.ndarray, top_k: int):
        scores = self.vectors @ query[0]
        positions = np.argsort(scores)[::-1][:top_k]
        return scores[positions].reshape(1, -1), positions.astype("int64").reshape(1, -1)


class FakeLLMProvider(LLMProvider):
    async def generate(self, messages):
        assert "<portfolio_evidence>" in messages[-1]["content"]
        assert "untrusted DATA" in messages[0]["content"]
        return LLMAnswer(
            answer="The retrieved portfolio evidence supports this answer [S1].",
            source_ids=("S1",),
        )

    async def ready(self) -> bool:
        return True


@pytest.fixture(scope="session")
def knowledge_base():
    return build_knowledge_base(REPOSITORY_ROOT / "src" / "content" / "posts")


@pytest.fixture(scope="session")
def hash_embeddings():
    return HashEmbeddingProvider()


@pytest.fixture(scope="session")
def index_store(knowledge_base, hash_embeddings):
    chunks = [ProjectChunk.from_dict(value) for value in knowledge_base.chunks]
    vectors = hash_embeddings.encode_documents([chunk.text for chunk in chunks])
    positions = [chunk.chunk_id for chunk in chunks]
    return IndexStore(
        chunks=chunks,
        projects=knowledge_base.projects,
        positions=positions,
        index=NumpyInnerProductIndex(vectors),
        metadata={"embedding_dimensions": hash_embeddings.dimension},
    )


@pytest.fixture()
def settings():
    return replace(
        Settings.from_env(RAG_ROOT),
        data_dir=RAG_ROOT / "data",
        debug_retrieval=False,
        rate_limit_per_minute=100,
        request_timeout_seconds=5,
    )


@pytest.fixture()
def retriever(index_store, hash_embeddings, settings):
    return HybridRetriever(
        store=index_store,
        embeddings=hash_embeddings,
        semantic_top_k=settings.semantic_top_k,
        context_top_k=settings.context_top_k,
        top_projects=settings.top_projects,
        semantic_weight=settings.semantic_weight,
        lexical_weight=settings.lexical_weight,
    )


@pytest.fixture()
def rag_service(settings, retriever):
    return RAGService(settings, retriever, FakeLLMProvider())
