from __future__ import annotations

from fastapi.testclient import TestClient

from app.llm import LLMAnswer, LLMProvider
from app.main import create_app
from app.service import RAGService


class InsufficientEvidenceProvider(LLMProvider):
    async def generate(self, messages):
        return LLMAnswer(
            answer="The published portfolio does not provide enough information to confirm that.",
            source_ids=(),
        )

    async def ready(self) -> bool:
        return True


def test_health_and_grounded_ask(settings, rag_service):
    app = create_app(settings, injected_service=rag_service)
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {
            "status": "ok",
            "embedding_model": "ready",
            "index": "ready",
            "llm": "ready",
        }
        response = client.post(
            "/ask", json={"question": "Which projects use Snowflake?"}
        )
    assert response.status_code == 200
    payload = response.json()
    assert payload["retrieval"]["mode"] == "hybrid"
    assert payload["sources"]
    assert payload["sources"][0]["url"].startswith("/projects/posts/")
    assert payload["sources"][0]["source_id"] == "S1"


def test_request_validation_and_debug_endpoint_disabled(settings, rag_service):
    app = create_app(settings, injected_service=rag_service)
    with TestClient(app) as client:
        assert client.post("/ask", json={"question": "x"}).status_code == 422
        assert (
            client.post(
                "/ask",
                json={
                    "question": "valid question",
                    "model": "visitor-controlled-model",
                },
            ).status_code
            == 422
        )
        assert (
            client.post("/retrieve", json={"question": "valid question"}).status_code
            == 404
        )


def test_cors_is_narrow(settings, rag_service):
    app = create_app(settings, injected_service=rag_service)
    with TestClient(app) as client:
        allowed = client.options(
            "/ask",
            headers={
                "Origin": "https://dranubhaparashar.github.io",
                "Access-Control-Request-Method": "POST",
            },
        )
        denied = client.options(
            "/ask",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "POST",
            },
        )
    assert allowed.headers.get("access-control-allow-origin") == (
        "https://dranubhaparashar.github.io"
    )
    assert denied.headers.get("access-control-allow-origin") is None


def test_unsupported_answer_does_not_attach_irrelevant_sources(settings, retriever):
    service = RAGService(settings, retriever, InsufficientEvidenceProvider())
    app = create_app(settings, injected_service=service)
    with TestClient(app) as client:
        response = client.post(
            "/ask", json={"question": "Which project generated $10 million revenue?"}
        )
    assert response.status_code == 200
    assert response.json()["sources"] == []
