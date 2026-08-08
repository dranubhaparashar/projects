from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Sequence

import httpx

from .config import Settings


class LLMProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class LLMAnswer:
    answer: str
    source_ids: tuple[str, ...]


class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, messages: Sequence[dict[str, str]]) -> LLMAnswer:
        raise NotImplementedError

    @abstractmethod
    async def ready(self) -> bool:
        raise NotImplementedError


def _parse_json_answer(content: str) -> LLMAnswer:
    cleaned = content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            raise LLMProviderError("The inference provider returned invalid JSON") from None
        try:
            payload = json.loads(match.group(0))
        except json.JSONDecodeError as error:
            raise LLMProviderError("The inference provider returned invalid JSON") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("answer"), str):
        raise LLMProviderError("The inference provider returned an invalid answer")
    answer = payload["answer"].strip()
    if not answer:
        raise LLMProviderError("The inference provider returned an empty answer")
    raw_source_ids = payload.get("source_ids", [])
    if not isinstance(raw_source_ids, list):
        raw_source_ids = []
    source_ids = tuple(
        dict.fromkeys(
            source_id
            for source_id in (str(value).upper() for value in raw_source_ids)
            if re.fullmatch(r"S\d+", source_id)
        )
    )
    return LLMAnswer(answer=answer, source_ids=source_ids)


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str, model: str, timeout_seconds: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = httpx.Timeout(timeout_seconds)

    async def generate(self, messages: Sequence[dict[str, str]]) -> LLMAnswer:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": list(messages),
                        "stream": False,
                        "format": "json",
                        "think": False,
                        "options": {"temperature": 0.1, "num_predict": 450},
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise LLMProviderError("The local inference provider is unavailable") from error
        content = payload.get("message", {}).get("content", "")
        return _parse_json_answer(str(content))

    async def ready(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                models = response.json().get("models", [])
            expected = self.model.split(":", 1)[0]
            return any(
                str(model.get("name", "")).split(":", 1)[0] == expected
                for model in models
            )
        except (httpx.HTTPError, ValueError):
            return False


class OpenAICompatibleProvider(LLMProvider):
    """Self-hosted OpenAI-compatible protocol for vLLM/llama.cpp servers."""

    def __init__(self, base_url: str, model: str, timeout_seconds: float) -> None:
        if not base_url:
            raise ValueError("PROJECT_AI_LLM_BASE_URL is required")
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = httpx.Timeout(timeout_seconds)

    async def generate(self, messages: Sequence[dict[str, str]]) -> LLMAnswer:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    json={
                        "model": self.model,
                        "messages": list(messages),
                        "temperature": 0.1,
                        "max_tokens": 450,
                        "response_format": {"type": "json_object"},
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise LLMProviderError("The self-hosted inference provider is unavailable") from error
        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise LLMProviderError("The inference provider returned an invalid response") from error
        return _parse_json_answer(str(content))

    async def ready(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                response = await client.get(f"{self.base_url}/v1/models")
                return response.is_success
        except httpx.HTTPError:
            return False


def create_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "ollama":
        return OllamaProvider(
            base_url=settings.ollama_url,
            model=settings.llm_model,
            timeout_seconds=settings.request_timeout_seconds,
        )
    if settings.llm_provider == "openai-compatible":
        return OpenAICompatibleProvider(
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            timeout_seconds=settings.request_timeout_seconds,
        )
    raise ValueError(
        "PROJECT_AI_LLM_PROVIDER must be 'ollama' or 'openai-compatible'"
    )
