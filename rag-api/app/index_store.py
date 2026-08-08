from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np


class IndexConsistencyError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProjectChunk:
    chunk_id: str
    project_id: str
    project_title: str
    section: str
    text: str
    url: str
    tags: tuple[str, ...]
    technologies: tuple[str, ...]
    capabilities: tuple[str, ...]
    impact_domains: tuple[str, ...]
    deployment_status: str

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "ProjectChunk":
        return cls(
            chunk_id=str(value["chunk_id"]),
            project_id=str(value["project_id"]),
            project_title=str(value["project_title"]),
            section=str(value["section"]),
            text=str(value["text"]),
            url=str(value["url"]),
            tags=tuple(value.get("tags", [])),
            technologies=tuple(value.get("technologies", [])),
            capabilities=tuple(value.get("capabilities", [])),
            impact_domains=tuple(value.get("impact_domains", [])),
            deployment_status=str(value.get("deployment_status", "unspecified")),
        )


@dataclass(frozen=True)
class SemanticHit:
    chunk: ProjectChunk
    score: float
    position: int


class IndexStore:
    def __init__(
        self,
        chunks: list[ProjectChunk],
        projects: list[dict[str, Any]],
        positions: list[str],
        index: Any,
        metadata: dict[str, Any],
    ) -> None:
        self.chunks = chunks
        self.projects = projects
        self.positions = positions
        self.index = index
        self.metadata = metadata
        self.chunk_by_id = {chunk.chunk_id: chunk for chunk in chunks}
        self.project_by_id = {str(project["id"]): project for project in projects}
        self._chunks_by_project: dict[str, list[ProjectChunk]] = {}
        for chunk in chunks:
            self._chunks_by_project.setdefault(chunk.project_id, []).append(chunk)
        self._validate()

    @classmethod
    def load(cls, data_dir: Path) -> "IndexStore":
        import faiss

        chunks_path = data_dir / "project_chunks.json"
        meta_path = data_dir / "project_vectors_meta.json"
        index_path = data_dir / "project_vectors.faiss"
        missing = [
            path.name for path in (chunks_path, meta_path, index_path) if not path.exists()
        ]
        if missing:
            raise IndexConsistencyError(
                f"RAG index is incomplete; missing: {', '.join(missing)}"
            )

        chunk_payload = json.loads(chunks_path.read_text(encoding="utf-8"))
        vector_meta = json.loads(meta_path.read_text(encoding="utf-8"))
        chunks = [ProjectChunk.from_dict(item) for item in chunk_payload["chunks"]]
        index = faiss.read_index(str(index_path))
        return cls(
            chunks=chunks,
            projects=list(chunk_payload.get("projects", [])),
            positions=list(vector_meta.get("positions", [])),
            index=index,
            metadata=dict(vector_meta.get("index", {})),
        )

    def _validate(self) -> None:
        chunk_ids = [chunk.chunk_id for chunk in self.chunks]
        if len(chunk_ids) != len(set(chunk_ids)):
            raise IndexConsistencyError("Chunk IDs must be unique")
        if self.positions != chunk_ids:
            raise IndexConsistencyError(
                "FAISS position metadata does not match the deterministic chunk order"
            )
        if int(self.index.ntotal) != len(self.positions):
            raise IndexConsistencyError(
                "FAISS vector count does not match vector metadata count"
            )
        expected_dimension = int(self.metadata.get("embedding_dimensions", 0))
        if expected_dimension <= 0 or int(self.index.d) != expected_dimension:
            raise IndexConsistencyError(
                "FAISS dimensions do not match index metadata"
            )

    @property
    def dimension(self) -> int:
        return int(self.index.d)

    def chunks_for_project(self, project_id: str) -> list[ProjectChunk]:
        return list(self._chunks_by_project.get(project_id, []))

    def search(self, query_vector: np.ndarray, top_k: int) -> list[SemanticHit]:
        vector = np.asarray(query_vector, dtype="float32").reshape(1, -1)
        if vector.shape[1] != self.dimension:
            raise IndexConsistencyError("Query embedding dimension does not match index")
        scores, positions = self.index.search(vector, min(top_k, len(self.positions)))
        hits: list[SemanticHit] = []
        for score, position in zip(scores[0], positions[0], strict=True):
            if position < 0:
                continue
            chunk_id = self.positions[int(position)]
            chunk = self.chunk_by_id.get(chunk_id)
            if chunk is None:
                raise IndexConsistencyError("FAISS position points to an unknown chunk")
            hits.append(SemanticHit(chunk=chunk, score=float(score), position=int(position)))
        return hits

