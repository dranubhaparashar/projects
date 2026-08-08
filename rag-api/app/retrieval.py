from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Sequence

from .embeddings import EmbeddingProvider
from .index_store import IndexStore, ProjectChunk, SemanticHit
from .schemas import ConversationTurn, LexicalMatchHint


STOP_WORDS = {
    "a",
    "about",
    "all",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "built",
    "do",
    "does",
    "for",
    "from",
    "have",
    "how",
    "i",
    "in",
    "involving",
    "is",
    "me",
    "most",
    "my",
    "of",
    "on",
    "related",
    "relevant",
    "show",
    "that",
    "the",
    "these",
    "this",
    "those",
    "to",
    "use",
    "used",
    "uses",
    "what",
    "which",
    "with",
    "you",
}
GENERIC_TERMS = {
    "ai",
    "python",
    "project",
    "projects",
    "application",
    "applications",
    "machine learning",
}
QUERY_EXPANSIONS: tuple[tuple[re.Pattern[str], tuple[str, ...]], ...] = (
    (
        re.compile(r"\bcomputer vision\b", re.I),
        (
            "computer vision",
            "object detection",
            "video analytics",
            "image processing",
            "yolo",
            "ocr",
        ),
    ),
    (
        re.compile(r"\bgenerative ai\b|\bgenai\b", re.I),
        ("generative ai", "genai", "large language model", "llm", "rag"),
    ),
    (
        re.compile(r"\bmultimodal(?: ai)?\b", re.I),
        ("multimodal ai", "multimodal", "vision language", "document intelligence"),
    ),
    (
        re.compile(r"\bhealth(?:care)?\b|\bmedical\b", re.I),
        ("healthcare", "medical", "clinical", "claim", "insurance"),
    ),
    (
        re.compile(r"\blogistics?\b|\bsupply chain\b", re.I),
        (
            "logistics",
            "warehouse",
            "vehicle routing",
            "vrp",
            "route optimization",
            "inventory",
            "truck",
            "field operations",
        ),
    ),
    (
        re.compile(r"\bidentity\b|\bdecentralized identity\b", re.I),
        (
            "identity",
            "decentralized identity",
            "verifiable presentation",
            "zero knowledge",
            "zkp",
            "bbs",
            "anoncreds",
            "privacy",
        ),
    ),
    (
        re.compile(r"\bpredictive (?:industrial )?failures?\b|\bfailure prediction\b", re.I),
        (
            "predictive maintenance",
            "generator reliability",
            "asset risk",
            "failure prediction",
        ),
    ),
    (
        re.compile(r"\bagent(?:ic)? orchestration\b|\btools? orchestration\b", re.I),
        ("mcp", "protocols", "agents", "grpc", "tool orchestration"),
    ),
)


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(character for character in value if not unicodedata.combining(character))
    value = value.lower().replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#.]+", " ", value)).strip()


def _unique(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        key = normalize(value)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(key)
    return result


def query_terms(query: str) -> list[str]:
    normalized = normalize(query)
    expanded: list[str] = []
    for pattern, terms in QUERY_EXPANSIONS:
        if pattern.search(query):
            expanded.extend(terms)
    expanded.extend(
        token
        for token in normalized.split()
        if len(token) >= 2 and token not in STOP_WORDS and token not in GENERIC_TERMS
    )
    if (
        len(normalized) > 2
        and normalized not in GENERIC_TERMS
        and not re.match(r"^(which|show|have|what|is|compare)\s", normalized)
    ):
        expanded.insert(0, normalized)
    return _unique(expanded)


@dataclass(frozen=True)
class LexicalMatch:
    project_id: str
    score: float
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class HybridHit:
    chunk: ProjectChunk
    semantic_score: float
    lexical_score: float
    hybrid_score: float
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class HybridRetrievalResult:
    context: tuple[HybridHit, ...]
    project_ids: tuple[str, ...]
    semantic_match_count: int
    retrieval_query: str


def _string_values(project: dict, key: str) -> list[str]:
    return [str(value) for value in project.get(key, []) if str(value).strip()]


class MetadataLexicalRetriever:
    """Server fallback mirroring the browser assistant's metadata weighting.

    The normal frontend request also sends the exact results from the existing
    TypeScript `searchPortfolio()` function. Those hints are validated and merged
    with these server-side scores, so direct API clients remain useful without
    making browser-provided scores authoritative.
    """

    def __init__(self, projects: Sequence[dict]) -> None:
        self.projects = list(projects)

    def search(self, query: str) -> list[LexicalMatch]:
        terms = query_terms(query)
        normalized_query = normalize(query)
        matches: list[LexicalMatch] = []
        for project in self.projects:
            title = normalize(str(project.get("title", "")))
            description = normalize(str(project.get("description", "")))
            category = normalize(str(project.get("category", "")))
            content = normalize(str(project.get("searchable_content", "")))
            groups = {
                "impact_domains": _string_values(project, "impact_domains"),
                "problems": _string_values(project, "problems"),
                "technologies": _string_values(project, "technologies"),
                "tags": _string_values(project, "tags"),
                "capabilities": _string_values(project, "capabilities"),
            }
            score = 0.0
            reasons: list[str] = []
            deployment_status = normalize(str(project.get("deployment_status", "")))
            if normalized_query == title:
                score += 1200
                reasons.append("Exact project title match.")
            elif len(title) >= 8 and title in normalized_query:
                score += 900
                reasons.append("The question names this project.")

            for term in terms:
                if not term or term in GENERIC_TERMS:
                    continue
                if term in title:
                    score += 120
                    reasons.append(f'Title matches "{term}".')
                exact_match = False
                weights = {
                    "impact_domains": (420, 170, "Impact domain"),
                    "problems": (390, 160, "Problem"),
                    "technologies": (380, 150, "Technology"),
                    "tags": (350, 140, "Tag"),
                    "capabilities": (350, 140, "Capability"),
                }
                for key, (exact_weight, containing_weight, label) in weights.items():
                    values = groups[key]
                    exact = next((value for value in values if normalize(value) == term), None)
                    if exact is not None:
                        score += exact_weight
                        reasons.append(f"{label}: {exact}.")
                        exact_match = True
                        break
                    containing = next(
                        (value for value in values if term in normalize(value)), None
                    )
                    if containing is not None:
                        score += containing_weight
                        reasons.append(f"{label}: {containing}.")
                if category == term or term in category:
                    score += 120 if category == term else 65
                    reasons.append(f"Category: {project.get('category', '')}.")
                if term in description:
                    score += 48
                    reasons.append("The published description directly matches the question.")
                if term in content:
                    score += 8
                if term == deployment_status and term in {
                    "production",
                    "pilot",
                    "operational",
                    "prototype",
                    "research",
                    "concept",
                    "demo",
                }:
                    score += 500
                    reasons.append(f"Documented deployment status: {deployment_status}.")
                if exact_match:
                    continue

            if score >= 35:
                matches.append(
                    LexicalMatch(
                        project_id=str(project["id"]),
                        score=score,
                        reasons=tuple(_unique(reasons)[:5]),
                    )
                )
        return sorted(
            matches,
            key=lambda item: (-item.score, item.project_id),
        )


def _normalize_scores(values: dict[str, float]) -> dict[str, float]:
    if not values:
        return {}
    minimum = min(values.values())
    maximum = max(values.values())
    if maximum <= 0:
        return {key: 0.0 for key in values}
    if abs(maximum - minimum) < 1e-9:
        return {key: 1.0 for key in values}
    return {key: (value - minimum) / (maximum - minimum) for key, value in values.items()}


def _jaccard(left: str, right: str) -> float:
    left_tokens = set(normalize(left).split())
    right_tokens = set(normalize(right).split())
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


class HybridRetriever:
    def __init__(
        self,
        store: IndexStore,
        embeddings: EmbeddingProvider,
        semantic_top_k: int = 12,
        context_top_k: int = 8,
        top_projects: int = 5,
        semantic_weight: float = 0.65,
        lexical_weight: float = 0.35,
    ) -> None:
        total_weight = semantic_weight + lexical_weight
        self.store = store
        self.embeddings = embeddings
        self.semantic_top_k = semantic_top_k
        self.context_top_k = context_top_k
        self.top_projects = top_projects
        self.semantic_weight = semantic_weight / total_weight
        self.lexical_weight = lexical_weight / total_weight
        self.lexical = MetadataLexicalRetriever(store.projects)

    def _conversation_query(
        self, question: str, conversation: Sequence[ConversationTurn]
    ) -> str:
        if not conversation or not re.search(
            r"\b(that|those|these|it|they|them|previous|former|latter|different)\b",
            question,
            re.I,
        ):
            return question
        context = " ".join(turn.content for turn in conversation[-4:])
        return f"{question}\nRecent conversation context: {context}"[:4000]

    def _named_project_ids(self, question: str) -> list[str]:
        normalized_question = normalize(question)
        found: list[str] = []
        for project in self.store.projects:
            title = normalize(str(project.get("title", "")))
            title_tokens = [
                token
                for token in title.split()
                if token not in STOP_WORDS and token not in GENERIC_TERMS
            ]
            prefix = " ".join(title_tokens[:3])
            overlap = sum(token in normalized_question.split() for token in title_tokens)
            if (
                title in normalized_question
                or (len(prefix) >= 6 and prefix in normalized_question)
                or overlap >= 3
            ):
                found.append(str(project["id"]))
        return found

    def _exact_boost(self, project: dict, question: str) -> tuple[float, list[str]]:
        normalized_question = normalize(question)
        expanded_terms = set(query_terms(question))
        title = normalize(str(project.get("title", "")))
        boost = 0.0
        reasons: list[str] = []
        if title and title in normalized_question:
            boost += 0.35
            reasons.append("Exact project name match")
        for key in ("technologies", "tags", "capabilities", "impact_domains"):
            for value in _string_values(project, key):
                normalized_value = normalize(value)
                if len(normalized_value) < 3:
                    continue
                if normalized_value in expanded_terms or re.search(
                    rf"(?<![a-z0-9]){re.escape(normalized_value)}(?![a-z0-9])",
                    normalized_question,
                ):
                    boost = max(boost, 0.24)
                    reasons.append(f"Exact metadata match: {value}")
        return boost, reasons

    def retrieve(
        self,
        question: str,
        conversation: Sequence[ConversationTurn] = (),
        lexical_hints: Sequence[LexicalMatchHint] = (),
        current_project_id: str | None = None,
    ) -> HybridRetrievalResult:
        retrieval_query = self._conversation_query(question, conversation)
        semantic_hits = self.store.search(
            self.embeddings.encode_query(retrieval_query), self.semantic_top_k
        )
        server_lexical = {match.project_id: match for match in self.lexical.search(question)}
        for hint in lexical_hints:
            if hint.project_id not in self.store.project_by_id:
                continue
            current = server_lexical.get(hint.project_id)
            if current is None or hint.score > current.score:
                server_lexical[hint.project_id] = LexicalMatch(
                    project_id=hint.project_id,
                    score=hint.score,
                    reasons=tuple(hint.reasons),
                )

        candidate_semantic: dict[str, float] = {
            hit.chunk.chunk_id: hit.score for hit in semantic_hits
        }
        candidate_chunks: dict[str, ProjectChunk] = {
            hit.chunk.chunk_id: hit.chunk for hit in semantic_hits
        }
        named_ids = self._named_project_ids(question)
        if current_project_id and current_project_id in self.store.project_by_id:
            named_ids.insert(0, current_project_id)

        lexical_ids = [
            match.project_id
            for match in sorted(server_lexical.values(), key=lambda item: -item.score)[: self.top_projects]
        ]
        for project_id in dict.fromkeys([*named_ids, *lexical_ids]):
            chunks = self.store.chunks_for_project(project_id)
            if not chunks:
                continue
            preferred = sorted(
                chunks,
                key=lambda chunk: (
                    0 if "overview" in normalize(chunk.section) else 1,
                    chunk.chunk_id,
                ),
            )[0]
            candidate_chunks.setdefault(preferred.chunk_id, preferred)
            candidate_semantic.setdefault(preferred.chunk_id, 0.0)

        semantic_norm = _normalize_scores(candidate_semantic)
        lexical_raw = {
            chunk_id: server_lexical.get(chunk.project_id, LexicalMatch("", 0, ())).score
            for chunk_id, chunk in candidate_chunks.items()
        }
        lexical_norm = _normalize_scores(lexical_raw)
        ranked: list[HybridHit] = []
        for chunk_id, chunk in candidate_chunks.items():
            project = self.store.project_by_id.get(chunk.project_id, {})
            boost, exact_reasons = self._exact_boost(project, question)
            lexical_match = server_lexical.get(chunk.project_id)
            reasons = [
                *(lexical_match.reasons if lexical_match else ()),
                *exact_reasons,
            ]
            score = (
                self.semantic_weight * semantic_norm.get(chunk_id, 0.0)
                + self.lexical_weight * lexical_norm.get(chunk_id, 0.0)
                + boost
            )
            ranked.append(
                HybridHit(
                    chunk=chunk,
                    semantic_score=candidate_semantic.get(chunk_id, 0.0),
                    lexical_score=lexical_raw.get(chunk_id, 0.0),
                    hybrid_score=score,
                    reasons=tuple(_unique(reasons)[:5]),
                )
            )
        ranked.sort(key=lambda hit: (-hit.hybrid_score, hit.chunk.chunk_id))

        project_scores: dict[str, float] = {}
        for hit in ranked:
            project_scores[hit.chunk.project_id] = max(
                project_scores.get(hit.chunk.project_id, 0.0), hit.hybrid_score
            )
        scored_project_ids = [
            project_id
            for project_id, _ in sorted(
                project_scores.items(), key=lambda item: (-item[1], item[0])
            )
        ]
        # Explicitly named projects are requirements, not soft suggestions. This
        # keeps both sides of a comparison even when one has more matching chunks.
        project_ids = tuple(
            list(dict.fromkeys([*named_ids, *scored_project_ids]))[
                : self.top_projects
            ]
        )

        selected: list[HybridHit] = []
        per_project: dict[str, int] = {}
        comparison = bool(re.search(r"\b(compare|versus|vs\.?)\b", question, re.I))
        required_ids = named_ids[:2] if comparison else named_ids[:1]
        for project_id in required_ids:
            for hit in (candidate for candidate in ranked if candidate.chunk.project_id == project_id):
                if len(selected) >= self.context_top_k:
                    break
                if any(_jaccard(hit.chunk.text, item.chunk.text) > 0.9 for item in selected):
                    continue
                selected.append(hit)
                per_project[project_id] = per_project.get(project_id, 0) + 1
                if per_project[project_id] >= (2 if comparison else 1):
                    break

        max_per_project = 3 if required_ids else 2
        for hit in ranked:
            if len(selected) >= self.context_top_k:
                break
            if per_project.get(hit.chunk.project_id, 0) >= max_per_project:
                continue
            if any(item.chunk.chunk_id == hit.chunk.chunk_id for item in selected):
                continue
            if any(_jaccard(hit.chunk.text, item.chunk.text) > 0.9 for item in selected):
                continue
            selected.append(hit)
            per_project[hit.chunk.project_id] = per_project.get(hit.chunk.project_id, 0) + 1

        return HybridRetrievalResult(
            context=tuple(selected),
            project_ids=project_ids,
            semantic_match_count=len(semantic_hits),
            retrieval_query=retrieval_query,
        )
