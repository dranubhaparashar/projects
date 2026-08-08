from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


RAG_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_ROOT))

from app.config import Settings  # noqa: E402
from app.embeddings import SentenceTransformerEmbeddingProvider  # noqa: E402
from app.index_store import IndexStore  # noqa: E402
from app.retrieval import HybridRetriever  # noqa: E402


def matches_expected(actual: str, expected: str) -> bool:
    return actual == expected or expected in actual


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate hybrid retrieval recall")
    parser.add_argument(
        "--questions",
        type=Path,
        default=RAG_ROOT / "tests" / "eval_questions.json",
    )
    args = parser.parse_args()
    settings = Settings.from_env(RAG_ROOT)
    embeddings = SentenceTransformerEmbeddingProvider(settings.embedding_model)
    store = IndexStore.load(settings.data_dir)
    retriever = HybridRetriever(
        store=store,
        embeddings=embeddings,
        semantic_top_k=settings.semantic_top_k,
        context_top_k=settings.context_top_k,
        top_projects=settings.top_projects,
        semantic_weight=settings.semantic_weight,
        lexical_weight=settings.lexical_weight,
    )
    questions = json.loads(args.questions.read_text(encoding="utf-8"))
    passed = 0
    for case in questions:
        result = retriever.retrieve(case["question"])
        actual = list(result.project_ids)
        expected = case["expected_project_ids"]
        hit = all(
            any(matches_expected(project_id, expected_id) for project_id in actual)
            for expected_id in expected
        )
        passed += int(hit)
        print(f"{'PASS' if hit else 'FAIL'} | {case['question']} | {actual}")
    recall = passed / len(questions) if questions else 0.0
    print(f"Retrieval recall: {passed}/{len(questions)} ({recall:.1%})")
    return 0 if recall >= 0.8 else 1


if __name__ == "__main__":
    raise SystemExit(main())

