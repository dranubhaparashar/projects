from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


def _env_float(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)))


@dataclass(frozen=True)
class Settings:
    rag_root: Path
    data_dir: Path
    embedding_model: str
    llm_provider: str
    llm_model: str
    ollama_url: str
    llm_base_url: str
    allowed_origins: tuple[str, ...]
    semantic_top_k: int
    context_top_k: int
    top_projects: int
    semantic_weight: float
    lexical_weight: float
    max_question_length: int
    request_timeout_seconds: float
    max_concurrency: int
    rate_limit_per_minute: int
    debug_retrieval: bool

    @classmethod
    def from_env(cls, rag_root: Path | None = None) -> "Settings":
        root = (rag_root or Path(__file__).resolve().parents[1]).resolve()
        data_value = os.getenv("PROJECT_AI_DATA_DIR", "data")
        data_dir = Path(data_value)
        if not data_dir.is_absolute():
            data_dir = root / data_dir

        origins = tuple(
            origin.strip().rstrip("/")
            for origin in os.getenv(
                "PROJECT_AI_ALLOWED_ORIGINS",
                "http://localhost:4321,https://dranubhaparashar.github.io",
            ).split(",")
            if origin.strip()
        )
        semantic_weight = _env_float("PROJECT_AI_SEMANTIC_WEIGHT", 0.65)
        lexical_weight = _env_float("PROJECT_AI_LEXICAL_WEIGHT", 0.35)
        if semantic_weight < 0 or lexical_weight < 0:
            raise ValueError("Hybrid retrieval weights cannot be negative")
        if semantic_weight + lexical_weight <= 0:
            raise ValueError("At least one hybrid retrieval weight must be positive")

        return cls(
            rag_root=root,
            data_dir=data_dir.resolve(),
            embedding_model=os.getenv(
                "PROJECT_AI_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"
            ),
            llm_provider=os.getenv("PROJECT_AI_LLM_PROVIDER", "ollama").lower(),
            llm_model=os.getenv("PROJECT_AI_LLM_MODEL", "qwen3:4b"),
            ollama_url=os.getenv(
                "PROJECT_AI_OLLAMA_URL", "http://localhost:11434"
            ).rstrip("/"),
            llm_base_url=os.getenv("PROJECT_AI_LLM_BASE_URL", "").rstrip("/"),
            allowed_origins=origins,
            semantic_top_k=max(1, _env_int("PROJECT_AI_SEMANTIC_TOP_K", 12)),
            context_top_k=max(1, _env_int("PROJECT_AI_CONTEXT_TOP_K", 8)),
            top_projects=max(1, _env_int("PROJECT_AI_TOP_PROJECTS", 5)),
            semantic_weight=semantic_weight,
            lexical_weight=lexical_weight,
            max_question_length=max(
                32, _env_int("PROJECT_AI_MAX_QUESTION_LENGTH", 1000)
            ),
            request_timeout_seconds=max(
                3.0, _env_float("PROJECT_AI_REQUEST_TIMEOUT_SECONDS", 25.0)
            ),
            max_concurrency=max(1, _env_int("PROJECT_AI_MAX_CONCURRENCY", 2)),
            rate_limit_per_minute=max(
                1, _env_int("PROJECT_AI_RATE_LIMIT_PER_MINUTE", 20)
            ),
            debug_retrieval=_env_bool("PROJECT_AI_DEBUG_RETRIEVAL", False),
        )

