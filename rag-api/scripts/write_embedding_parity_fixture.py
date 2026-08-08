from __future__ import annotations

import argparse
import json
from pathlib import Path

from sentence_transformers import SentenceTransformer


MODEL = "BAAI/bge-small-en-v1.5"
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "
SENTENCES = (
    "Which projects deal with predictive industrial failures?",
    "Which work deals with privacy-preserving credentials?",
    "Compare MCP 2.0 and Autonomous Microservice Composition.",
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Write Python BGE reference vectors for browser-runtime parity testing"
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    model = SentenceTransformer(MODEL)
    vectors = model.encode(
        [f"{QUERY_INSTRUCTION}{sentence}" for sentence in SENTENCES],
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            {
                "model": MODEL,
                "browser_model": "Xenova/bge-small-en-v1.5",
                "query_instruction": QUERY_INSTRUCTION,
                "sentences": [
                    {"text": text, "vector": vector.tolist()}
                    for text, vector in zip(SENTENCES, vectors, strict=True)
                ],
            }
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(SENTENCES)} Python BGE reference vectors to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
