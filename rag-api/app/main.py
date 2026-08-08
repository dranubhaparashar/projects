from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .embeddings import SentenceTransformerEmbeddingProvider
from .index_store import IndexStore
from .llm import LLMProviderError, create_llm_provider
from .retrieval import HybridRetriever
from .schemas import AskRequest, AskResponse, HealthResponse, RetrievalDebugResponse
from .service import RAGService


LOGGER = logging.getLogger("project_ai")


class SlidingWindowRateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.limit = requests_per_minute
        self.requests: dict[str, deque[float]] = defaultdict(deque)
        self.lock = asyncio.Lock()

    async def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - 60
        async with self.lock:
            history = self.requests[key]
            while history and history[0] < cutoff:
                history.popleft()
            if len(history) >= self.limit:
                return False
            history.append(now)
            return True


def create_app(
    settings: Settings | None = None,
    injected_service: RAGService | None = None,
) -> FastAPI:
    root = Settings.from_env().rag_root if settings is None else settings.rag_root
    load_dotenv(root / ".env")
    app_settings = settings or Settings.from_env(root)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if injected_service is not None:
            app.state.rag_service = injected_service
            app.state.embedding_ready = True
            app.state.index_ready = True
            yield
            return
        try:
            embeddings = await asyncio.to_thread(
                SentenceTransformerEmbeddingProvider,
                app_settings.embedding_model,
            )
            store = await asyncio.to_thread(IndexStore.load, app_settings.data_dir)
            if embeddings.dimension != store.dimension:
                raise RuntimeError(
                    "Embedding model dimension does not match the persisted FAISS index"
                )
            retriever = HybridRetriever(
                store=store,
                embeddings=embeddings,
                semantic_top_k=app_settings.semantic_top_k,
                context_top_k=app_settings.context_top_k,
                top_projects=app_settings.top_projects,
                semantic_weight=app_settings.semantic_weight,
                lexical_weight=app_settings.lexical_weight,
            )
            provider = create_llm_provider(app_settings)
            app.state.rag_service = RAGService(app_settings, retriever, provider)
            app.state.embedding_ready = True
            app.state.index_ready = True
        except Exception:
            LOGGER.exception("Project Intelligence RAG startup failed")
            app.state.rag_service = None
            app.state.embedding_ready = False
            app.state.index_ready = False
        yield

    application = FastAPI(
        title="Project Intelligence RAG API",
        version="1.0.0",
        docs_url="/docs" if app_settings.debug_retrieval else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(app_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    application.state.rag_service = injected_service
    application.state.embedding_ready = injected_service is not None
    application.state.index_ready = injected_service is not None
    semaphore = asyncio.Semaphore(app_settings.max_concurrency)
    limiter = SlidingWindowRateLimiter(app_settings.rate_limit_per_minute)

    async def enforce_request_limits(request: Request, payload: AskRequest) -> None:
        if len(payload.question) > app_settings.max_question_length:
            raise HTTPException(status_code=422, detail="Question is too long")
        client_key = request.client.host if request.client else "unknown"
        if not await limiter.allow(client_key):
            raise HTTPException(status_code=429, detail="Please wait before asking again")

    @application.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        service: RAGService | None = application.state.rag_service
        llm_ready = bool(service and await service.llm.ready())
        ready = bool(
            application.state.embedding_ready
            and application.state.index_ready
            and llm_ready
        )
        return HealthResponse(
            status="ok" if ready else "degraded",
            embedding_model="ready"
            if application.state.embedding_ready
            else "unavailable",
            index="ready" if application.state.index_ready else "unavailable",
            llm="ready" if llm_ready else "unavailable",
        )

    @application.post("/ask", response_model=AskResponse)
    async def ask(payload: AskRequest, request: Request) -> AskResponse:
        await enforce_request_limits(request, payload)
        service: RAGService | None = application.state.rag_service
        if service is None:
            raise HTTPException(status_code=503, detail="Project Intelligence is unavailable")
        try:
            async with semaphore:
                return await asyncio.wait_for(
                    service.ask(payload), timeout=app_settings.request_timeout_seconds
                )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504, detail="Project Intelligence timed out"
            ) from None
        except LLMProviderError:
            raise HTTPException(
                status_code=503, detail="Project Intelligence is unavailable"
            ) from None

    if app_settings.debug_retrieval:

        @application.post("/retrieve", response_model=RetrievalDebugResponse)
        async def retrieve(
            payload: AskRequest, request: Request
        ) -> RetrievalDebugResponse:
            await enforce_request_limits(request, payload)
            service: RAGService | None = application.state.rag_service
            if service is None:
                raise HTTPException(
                    status_code=503, detail="Project Intelligence is unavailable"
                )
            async with semaphore:
                return await service.debug_retrieve(payload)

    return application


app = create_app()

