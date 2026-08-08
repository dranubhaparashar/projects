from __future__ import annotations

import asyncio
import logging
import re
import time

from .config import Settings
from .llm import LLMProvider
from .prompts import assign_prompt_sources, build_messages
from .retrieval import HybridRetriever
from .schemas import (
    AskRequest,
    AskResponse,
    RelatedProject,
    RetrievalDebugResponse,
    RetrievalResultItem,
    RetrievalSummary,
    SourceReference,
)


LOGGER = logging.getLogger("project_ai")


class RAGService:
    def __init__(
        self,
        settings: Settings,
        retriever: HybridRetriever,
        llm: LLMProvider,
    ) -> None:
        self.settings = settings
        self.retriever = retriever
        self.llm = llm

    async def retrieve(self, request: AskRequest):
        return await asyncio.to_thread(
            self.retriever.retrieve,
            request.question,
            request.conversation,
            request.lexical_matches,
            request.current_project_id,
        )

    async def ask(self, request: AskRequest) -> AskResponse:
        started = time.perf_counter()
        retrieval = await self.retrieve(request)
        prompt_sources = assign_prompt_sources(retrieval.context)
        messages = build_messages(
            request.question, prompt_sources, request.conversation
        )
        generated = await self.llm.generate(messages)
        answer_text = re.sub(
            r"\(((?:S\d+)(?:\s*,\s*S\d+)*)\)", r"[\1]", generated.answer
        )
        known_sources = {source.source_id: source for source in prompt_sources}
        cited_ids = [
            source_id for source_id in generated.source_ids if source_id in known_sources
        ]
        if not cited_ids:
            cited_ids = [
                match
                for match in re.findall(r"\bS\d+\b", answer_text.upper())
                if match in known_sources
            ]
        cited_ids = list(dict.fromkeys(cited_ids))
        insufficient = (
            "the published portfolio does not provide enough information to confirm that"
            in answer_text.lower()
        )
        if insufficient and not re.search(r"\bS\d+\b", answer_text.upper()):
            cited_ids = []
        elif not cited_ids:
            cited_ids = list(known_sources)[: min(3, len(known_sources))]

        sources = [
            SourceReference(
                source_id=source_id,
                project_id=known_sources[source_id].hit.chunk.project_id,
                project_title=known_sources[source_id].hit.chunk.project_title,
                section=known_sources[source_id].hit.chunk.section,
                url=known_sources[source_id].hit.chunk.url,
            )
            for source_id in cited_ids
        ]
        cited_project_ids = {source.project_id for source in sources}
        related: list[RelatedProject] = []
        for project_id in retrieval.project_ids:
            if project_id in cited_project_ids:
                continue
            project = self.retriever.store.project_by_id.get(project_id)
            if not project:
                continue
            related.append(
                RelatedProject(
                    id=project_id,
                    title=str(project["title"]),
                    url=str(project["url"]),
                )
            )
            if len(related) >= 3:
                break

        if self.settings.debug_retrieval:
            LOGGER.info(
                "Hybrid retrieval completed: semantic=%s context=%s projects=%s llm_ms=%d",
                retrieval.semantic_match_count,
                len(retrieval.context),
                list(retrieval.project_ids),
                round((time.perf_counter() - started) * 1000),
            )
        return AskResponse(
            answer=answer_text,
            sources=sources,
            related_projects=related,
            retrieval=RetrievalSummary(
                semantic_matches=retrieval.semantic_match_count,
                context_chunks=len(retrieval.context),
            ),
        )

    async def debug_retrieve(self, request: AskRequest) -> RetrievalDebugResponse:
        retrieval = await self.retrieve(request)
        prompt_sources = assign_prompt_sources(retrieval.context)
        return RetrievalDebugResponse(
            results=[
                RetrievalResultItem(
                    source_id=source.source_id,
                    project_id=source.hit.chunk.project_id,
                    project_title=source.hit.chunk.project_title,
                    section=source.hit.chunk.section,
                    url=source.hit.chunk.url,
                    reasons=list(source.hit.reasons),
                )
                for source in prompt_sources
            ]
        )
