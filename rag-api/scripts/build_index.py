from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import faiss
import numpy as np


RAG_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = RAG_ROOT.parent
sys.path.insert(0, str(RAG_ROOT))

from app.content_indexer import build_knowledge_base  # noqa: E402
from app.embeddings import SentenceTransformerEmbeddingProvider  # noqa: E402
from scripts.export_browser_index import write_browser_assets  # noqa: E402


def write_json(path: Path, value: object) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the Project Intelligence BGE/FAISS index from Astro Markdown"
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=REPOSITORY_ROOT / "src" / "content" / "posts",
    )
    parser.add_argument("--data-dir", type=Path, default=RAG_ROOT / "data")
    parser.add_argument(
        "--browser-output-dir",
        type=Path,
        default=REPOSITORY_ROOT / "public" / "project-intelligence",
    )
    parser.add_argument(
        "--model", default="BAAI/bge-small-en-v1.5", help="SentenceTransformer model"
    )
    args = parser.parse_args()

    knowledge = build_knowledge_base(args.source_dir)
    if not knowledge.projects or not knowledge.chunks:
        raise RuntimeError("No published project chunks were generated")
    provider = SentenceTransformerEmbeddingProvider(args.model)
    vectors = provider.encode_documents([chunk["text"] for chunk in knowledge.chunks])
    if vectors.ndim != 2 or vectors.shape[0] != len(knowledge.chunks):
        raise RuntimeError("Embedding output does not match chunk count")
    norms = np.linalg.norm(vectors, axis=1)
    if not np.allclose(norms, 1.0, atol=1e-3):
        raise RuntimeError("Document embeddings are not normalized")

    index = faiss.IndexFlatIP(provider.dimension)
    index.add(np.asarray(vectors, dtype="float32"))
    if index.ntotal != len(knowledge.chunks):
        raise RuntimeError("FAISS vector count does not match chunk count")

    args.data_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()
    index_metadata = {
        "version": 1,
        "generated_at": generated_at,
        "embedding_model": args.model,
        "embedding_dimensions": provider.dimension,
        "project_count": len(knowledge.projects),
        "chunk_count": len(knowledge.chunks),
        "content_hash": knowledge.content_hash,
    }
    write_json(
        args.data_dir / "project_chunks.json",
        {
            "index": index_metadata,
            "projects": knowledge.projects,
            "chunks": knowledge.chunks,
        },
    )
    write_json(
        args.data_dir / "project_vectors_meta.json",
        {
            "index": index_metadata,
            "positions": [chunk["chunk_id"] for chunk in knowledge.chunks],
        },
    )
    temporary_index = args.data_dir / "project_vectors.faiss.tmp"
    faiss.write_index(index, str(temporary_index))
    temporary_index.replace(args.data_dir / "project_vectors.faiss")
    write_browser_assets(
        args.browser_output_dir,
        {
            "index": index_metadata,
            "projects": knowledge.projects,
            "chunks": knowledge.chunks,
        },
        vectors,
    )
    print(
        f"Indexed {len(knowledge.projects)} projects / {len(knowledge.chunks)} chunks "
        f"at {provider.dimension} dimensions with {args.model}; "
        f"browser assets written to {args.browser_output_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
