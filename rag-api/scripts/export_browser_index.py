from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import faiss
import numpy as np


RAG_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = RAG_ROOT.parent
DEFAULT_DATA_DIR = RAG_ROOT / "data"
DEFAULT_OUTPUT_DIR = REPOSITORY_ROOT / "public" / "project-intelligence"
BROWSER_EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5"
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


def write_json(path: Path, value: object) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def public_project(project: dict[str, Any]) -> dict[str, Any]:
    return {
        key: project.get(key)
        for key in (
            "id",
            "slug",
            "title",
            "url",
            "description",
            "category",
            "year",
            "tags",
            "technologies",
            "capabilities",
            "impact_domains",
            "industries",
            "problems",
            "deployment_status",
            "deployment_evidence",
            "deployment_details",
            "actions",
            "related_project_ids",
        )
    }


def public_chunk(chunk: dict[str, Any]) -> dict[str, Any]:
    return {
        key: chunk.get(key)
        for key in (
            "chunk_id",
            "project_id",
            "project_title",
            "section",
            "text",
            "url",
            "tags",
            "technologies",
            "capabilities",
            "impact_domains",
            "deployment_status",
        )
    }


def write_browser_assets(
    output_dir: Path,
    chunks_payload: dict[str, Any],
    vectors: np.ndarray,
) -> tuple[Path, Path, Path]:
    index_metadata = chunks_payload.get("index") or {}
    chunks = [public_chunk(item) for item in chunks_payload.get("chunks") or []]
    projects = [public_project(item) for item in chunks_payload.get("projects") or []]
    matrix = np.asarray(vectors, dtype="<f4")

    if matrix.ndim != 2 or matrix.shape[0] != len(chunks):
        raise RuntimeError("Browser vector rows do not match canonical chunk count")
    dimensions = int(index_metadata.get("embedding_dimensions") or matrix.shape[1])
    if matrix.shape[1] != dimensions:
        raise RuntimeError("Browser vector dimensions do not match index metadata")
    if not np.allclose(np.linalg.norm(matrix, axis=1), 1.0, atol=1e-3):
        raise RuntimeError("Browser vectors must be L2 normalized")

    output_dir.mkdir(parents=True, exist_ok=True)
    chunks_path = output_dir / "project-chunks.json"
    metadata_path = output_dir / "project-vector-metadata.json"
    vectors_path = output_dir / "project-vectors.bin"

    public_index = {
        "version": 1,
        "generated_at": index_metadata.get("generated_at"),
        "content_hash": index_metadata.get("content_hash"),
        "project_count": len(projects),
        "chunk_count": len(chunks),
    }
    write_json(
        chunks_path,
        {"index": public_index, "projects": projects, "chunks": chunks},
    )
    write_json(
        metadata_path,
        {
            "version": 1,
            "model": index_metadata.get("embedding_model", "BAAI/bge-small-en-v1.5"),
            "browser_model": BROWSER_EMBEDDING_MODEL,
            "dimensions": dimensions,
            "count": len(chunks),
            "dtype": "float32-le",
            "pooling": "cls",
            "normalized": True,
            "query_instruction": QUERY_INSTRUCTION,
            "content_hash": index_metadata.get("content_hash"),
            "chunks": [
                {
                    "index": position,
                    "chunk_id": chunk["chunk_id"],
                    "project_id": chunk["project_id"],
                    "project_title": chunk["project_title"],
                    "section": chunk["section"],
                    "url": chunk["url"],
                }
                for position, chunk in enumerate(chunks)
            ],
        },
    )
    temporary_vectors = vectors_path.with_suffix(vectors_path.suffix + ".tmp")
    temporary_vectors.write_bytes(matrix.tobytes(order="C"))
    temporary_vectors.replace(vectors_path)
    return chunks_path, metadata_path, vectors_path


def export_persisted_index(data_dir: Path, output_dir: Path) -> tuple[Path, Path, Path]:
    chunks_payload = json.loads(
        (data_dir / "project_chunks.json").read_text(encoding="utf-8")
    )
    index = faiss.read_index(str(data_dir / "project_vectors.faiss"))
    vectors = np.empty((index.ntotal, index.d), dtype="float32")
    index.reconstruct_n(0, index.ntotal, vectors)
    return write_browser_assets(output_dir, chunks_payload, vectors)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export the canonical BGE/FAISS portfolio index for static browser RAG"
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()
    paths = export_persisted_index(args.data_dir, args.output_dir)
    metadata = json.loads(paths[1].read_text(encoding="utf-8"))
    print(
        f"Exported {metadata['count']} chunks at {metadata['dimensions']} dimensions "
        f"to {args.output_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
