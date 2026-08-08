from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import yaml


MAX_CHUNK_WORDS = 620
CHUNK_OVERLAP_WORDS = 45
MIN_CHUNK_WORDS = 18

PRODUCTION_PATTERNS = (
    re.compile(r"\bdeployed\s+(?:to|on|in|at|across)\b", re.I),
    re.compile(r"\b(?:running|operating|used)\s+in\s+production\b", re.I),
    re.compile(r"\bproduction\s+deployment\b", re.I),
    re.compile(r"\blive\s+system\b", re.I),
    re.compile(r"\b24\s*(?:x|×)\s*7\b", re.I),
    re.compile(r"\bclient\s+environment\b", re.I),
    re.compile(r"\boperational\s+dashboard\b", re.I),
)
NON_DEPLOYMENT_CONTEXT = re.compile(
    r"\b(?:can|could|may|might|would|future|planned|planning|roadmap|target|"
    r"intended|requires?|before|not|isn't|is not|path|pattern|ready|deployable|"
    r"deployment-ready|oriented|concept|proposal|proposed)\b",
    re.I,
)


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(character for character in value if not unicodedata.combining(character))
    return re.sub(r"\s+", " ", value).strip()


def filter_key(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", normalize(value).lower())).strip("-")


def unique(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = normalize(str(raw or ""))
        key = value.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def flatten(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (int, float, bool)):
        return [str(value)]
    if isinstance(value, list):
        return [item for value_item in value for item in flatten(value_item)]
    if isinstance(value, dict):
        return [item for value_item in value.values() for item in flatten(value_item)]
    return []


def parse_frontmatter(path: Path) -> tuple[dict[str, Any], str, str]:
    raw = path.read_text(encoding="utf-8-sig")
    match = re.match(r"^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?", raw)
    if not match:
        return {}, raw, raw
    metadata = yaml.safe_load(match.group(1)) or {}
    if not isinstance(metadata, dict):
        metadata = {}
    return metadata, raw[match.end() :], raw


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def is_published(metadata: dict[str, Any], now: datetime) -> bool:
    if any(metadata.get(key) is True for key in ("draft", "private", "admin", "unpublished")):
        return False
    published = _as_datetime(metadata.get("published"))
    if published is None:
        return False
    return published.astimezone(timezone.utc) <= now.astimezone(timezone.utc)


def source_slug(path: Path, source_dir: Path) -> str:
    relative = path.relative_to(source_dir).with_suffix("")
    parts = list(relative.parts)
    if parts and parts[-1].lower() == "index":
        parts.pop()

    def slug_part(part: str) -> str:
        value = unicodedata.normalize("NFKD", part)
        value = "".join(character for character in value if not unicodedata.combining(character))
        value = re.sub(r"\s", "-", value.lower())
        return re.sub(r"[^a-z0-9-]", "", value).strip("-")

    return "/".join(filter(None, (slug_part(part) for part in parts)))


def clean_markdown(value: str) -> str:
    value = re.sub(r"```[\s\S]*?```", " ", value)
    value = re.sub(r":::[\w-]+(?:\{[^}]*\})?", " ", value)
    value = re.sub(r"::github\{[^}]*\}", " ", value)
    value = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"^#{1,6}\s+", "", value, flags=re.M)
    value = re.sub(r"[\t|>*_`~{}\[\]]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def split_markdown_sections(body: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_title = "Overview"
    current_lines: list[str] = []

    def flush() -> None:
        text = clean_markdown("\n".join(current_lines))
        if text:
            sections.append((current_title, text))

    for line in body.splitlines():
        heading = re.match(r"^(#{2,3})\s+(.+?)\s*#*\s*$", line)
        if heading:
            flush()
            current_title = clean_markdown(heading.group(2)) or "Project details"
            current_lines = []
            continue
        if re.match(r"^#\s+", line):
            continue
        current_lines.append(line)
    flush()
    return sections


def _structured_section(metadata: dict[str, Any], name: str) -> str:
    views = metadata.get("views") or {}
    executive = views.get("executive") or {}
    technical = views.get("technical") or {}
    comparison = metadata.get("comparison") or {}
    card = metadata.get("card") or {}
    if name == "Business problem":
        values = [
            card.get("problem"),
            comparison.get("business_problem"),
            executive.get("business_problem"),
            executive.get("overview"),
            executive.get("solution"),
            executive.get("proposed_solution"),
        ]
    elif name == "Architecture and deployment":
        values = [
            metadata.get("deployment"),
            comparison.get("deployment_status"),
            comparison.get("deployment_environment"),
            comparison.get("infrastructure"),
            executive.get("deployment_context"),
            technical.get("infrastructure"),
            technical.get("deployment_architecture"),
            metadata.get("architecture"),
        ]
    elif name == "Data and methodology":
        values = [
            metadata.get("dataset"),
            comparison.get("dataset"),
            comparison.get("model_or_algorithm"),
            technical.get("processing_pipeline"),
            technical.get("algorithms"),
            technical.get("dataset"),
            technical.get("training_evaluation"),
        ]
    else:
        values = [
            metadata.get("results"),
            comparison.get("evaluation_metrics"),
            comparison.get("limitations"),
            executive.get("outcome"),
            executive.get("cost_risk_reduction"),
            technical.get("metrics"),
            technical.get("limitations"),
            technical.get("future_improvements"),
        ]
    return clean_markdown(". ".join(unique(item for value in values for item in flatten(value))))


def _sentences(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\r?\n+", value) if part.strip()]


def deployment_classification(metadata: dict[str, Any], body: str) -> tuple[str, list[str], str]:
    explicit_status = str((metadata.get("status") or {}).get("type", "")).lower()
    explicit_details = clean_markdown(
        ". ".join(
            unique(
                item
                for value in (
                    metadata.get("deployment"),
                    (metadata.get("comparison") or {}).get("deployment_status"),
                    (metadata.get("comparison") or {}).get("deployment_environment"),
                    ((metadata.get("views") or {}).get("executive") or {}).get(
                        "deployment_context"
                    ),
                )
                for item in flatten(value)
            )
        )
    )
    if explicit_status in {
        "production",
        "pilot",
        "operational",
        "prototype",
        "research",
        "concept",
    }:
        evidence = [explicit_details] if explicit_details else []
        return explicit_status, evidence, explicit_details

    source = f"{explicit_details}\n{clean_markdown(body)}"
    production_evidence = [
        sentence
        for sentence in _sentences(source)
        if not NON_DEPLOYMENT_CONTEXT.search(sentence)
        and any(pattern.search(sentence) for pattern in PRODUCTION_PATTERNS)
    ][:3]
    if production_evidence:
        return "production", production_evidence, explicit_details or " ".join(production_evidence)
    for status, pattern in (
        ("prototype", r"\b(prototype|proof[- ]of[- ]concept|poc)\b"),
        ("research", r"\b(research experiment|experiment|benchmark|research project|research study)\b"),
        ("concept", r"\b(concept|conceptual|planned system)\b"),
    ):
        if re.search(pattern, source, re.I):
            return status, [], explicit_details
    if metadata.get("demo_url"):
        return "demo", [], explicit_details
    return "unspecified", [], explicit_details


def _algorithms(metadata: dict[str, Any]) -> list[str]:
    algorithms = (((metadata.get("views") or {}).get("technical") or {}).get("algorithms") or [])
    return unique(
        str(item.get("name", "")) if isinstance(item, dict) else str(item)
        for item in algorithms
    )


def _actions(metadata: dict[str, Any]) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    for kind, key in (
        ("github", "github_url"),
        ("demo", "demo_url"),
        ("paper", "paper_url"),
        ("docs", "documentation_url"),
    ):
        if metadata.get(key):
            candidates.append({"kind": kind, "label": kind.title(), "url": str(metadata[key])})
    for item in metadata.get("project_links") or []:
        if not isinstance(item, dict) or not item.get("url"):
            continue
        candidates.append(
            {
                "kind": str(item.get("kind") or "docs"),
                "label": str(item.get("label") or "Project link"),
                "url": str(item["url"]),
            }
        )
    result: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in candidates:
        key = (item["kind"], item["url"])
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _split_long_section(text: str) -> list[str]:
    words = text.split()
    if len(words) <= MAX_CHUNK_WORDS:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + MAX_CHUNK_WORDS)
        chunks.append(" ".join(words[start:end]))
        if end >= len(words):
            break
        start = max(start + 1, end - CHUNK_OVERLAP_WORDS)
    return chunks


def _text_similarity(left: str, right: str) -> float:
    left_words = set(left.lower().split())
    right_words = set(right.lower().split())
    if not left_words or not right_words:
        return 0.0
    return len(left_words & right_words) / len(left_words | right_words)


@dataclass(frozen=True)
class KnowledgeBase:
    projects: list[dict[str, Any]]
    chunks: list[dict[str, Any]]
    content_hash: str


def build_knowledge_base(source_dir: Path, now: datetime | None = None) -> KnowledgeBase:
    source_dir = source_dir.resolve()
    current_time = now or datetime.now(timezone.utc)
    source_files = sorted(source_dir.rglob("*.md"), key=lambda path: path.as_posix().lower())
    hasher = hashlib.sha256()
    projects: list[dict[str, Any]] = []
    chunks: list[dict[str, Any]] = []

    for path in source_files:
        metadata, body, raw = parse_frontmatter(path)
        if not is_published(metadata, current_time):
            continue
        slug = source_slug(path, source_dir)
        project_id = filter_key(slug)
        if not slug or not project_id:
            continue
        hasher.update(path.relative_to(source_dir).as_posix().encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(raw.encode("utf-8"))
        hasher.update(b"\0")

        published = _as_datetime(metadata.get("published"))
        title = str(metadata.get("title") or slug)
        description = clean_markdown(str(metadata.get("description") or ""))
        category = str(metadata.get("category") or "Uncategorized")
        tags = unique(flatten(metadata.get("tags")))
        comparison = metadata.get("comparison") or {}
        technologies = unique(
            [
                *flatten(metadata.get("technologies")),
                *flatten(comparison.get("technologies")),
                *_algorithms(metadata),
            ]
        )
        executive = ((metadata.get("views") or {}).get("executive") or {})
        capabilities = unique(
            [
                *flatten(metadata.get("capabilities")),
                *flatten(executive.get("key_capabilities")),
            ]
        )
        impact_domains = unique(
            [
                *flatten(metadata.get("impact_domain")),
                *flatten(metadata.get("impact_domains")),
            ]
        )
        industries = unique(flatten(metadata.get("industry")))
        problems = unique(
            [
                *flatten(metadata.get("problems")),
                *flatten(comparison.get("business_problem")),
            ]
        )
        page_url = f"/projects/posts/{slug}/"
        deployment_status, deployment_evidence, deployment_details = deployment_classification(metadata, body)
        searchable_content = clean_markdown(
            f"{body} {' '.join(flatten(metadata.get('views')))} {' '.join(flatten(comparison))}"
        )[:12000]
        related_project_ids = [
            filter_key(value)
            for value in metadata.get("related_projects") or []
            if isinstance(value, str) and filter_key(value)
        ]
        project = {
            "id": project_id,
            "slug": slug,
            "title": title,
            "url": page_url,
            "description": description,
            "category": category,
            "year": str(published.year if published else ""),
            "tags": tags,
            "technologies": technologies,
            "capabilities": capabilities,
            "impact_domains": impact_domains,
            "industries": industries,
            "problems": problems,
            "searchable_content": searchable_content,
            "deployment_status": deployment_status,
            "deployment_evidence": deployment_evidence,
            "deployment_details": deployment_details,
            "actions": _actions(metadata),
            "related_project_ids": related_project_ids,
        }
        projects.append(project)

        overview_parts = unique(
            [
                description,
                f"Category: {category}." if category else "",
                f"Published: {published.year}." if published else "",
                f"Tags: {', '.join(tags)}." if tags else "",
                f"Capabilities: {', '.join(capabilities)}." if capabilities else "",
                f"Technologies: {', '.join(technologies)}." if technologies else "",
                f"Impact domains: {', '.join(impact_domains)}." if impact_domains else "",
                f"Problem areas: {', '.join(problems)}." if problems else "",
                f"Documented deployment status: {deployment_status}.",
                deployment_details,
            ]
        )
        sections: list[tuple[str, str]] = [("Portfolio overview", " ".join(overview_parts))]
        for section_name in (
            "Business problem",
            "Architecture and deployment",
            "Data and methodology",
            "Results and limitations",
        ):
            text = _structured_section(metadata, section_name)
            if text:
                sections.append((section_name, text))
        sections.extend(split_markdown_sections(body))

        accepted_texts: list[str] = []
        section_counts: dict[str, int] = {}
        for section, section_text in sections:
            for part in _split_long_section(section_text):
                if len(part.split()) < MIN_CHUNK_WORDS:
                    continue
                if any(_text_similarity(part, existing) > 0.92 for existing in accepted_texts):
                    continue
                accepted_texts.append(part)
                section_key = filter_key(section) or "details"
                section_counts[section_key] = section_counts.get(section_key, 0) + 1
                chunk_id = (
                    f"{project_id}__{section_key}__{section_counts[section_key]:02d}"
                )
                chunks.append(
                    {
                        "chunk_id": chunk_id,
                        "project_id": project_id,
                        "project_title": title,
                        "section": section,
                        "text": part,
                        "url": page_url,
                        "tags": tags,
                        "technologies": technologies,
                        "capabilities": capabilities,
                        "impact_domains": impact_domains,
                        "deployment_status": deployment_status,
                    }
                )

    projects.sort(key=lambda item: item["id"])
    chunks.sort(key=lambda item: item["chunk_id"])
    return KnowledgeBase(
        projects=projects,
        chunks=chunks,
        content_hash=hasher.hexdigest(),
    )

