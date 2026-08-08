from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConversationTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Conversation content cannot be blank")
        return value


class LexicalMatchHint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str = Field(min_length=1, max_length=240, pattern=r"^[a-z0-9-]+$")
    score: float = Field(ge=0, le=5000)
    reasons: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("reasons")
    @classmethod
    def limit_reasons(cls, values: list[str]) -> list[str]:
        return [value.strip()[:300] for value in values if value.strip()]


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=3, max_length=1000)
    conversation: list[ConversationTurn] = Field(default_factory=list, max_length=6)
    lexical_matches: list[LexicalMatchHint] = Field(default_factory=list, max_length=12)
    current_project_id: str | None = Field(
        default=None, max_length=240, pattern=r"^[a-z0-9-]+$"
    )

    @field_validator("question")
    @classmethod
    def strip_question(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Question is too short")
        return value


class SourceReference(BaseModel):
    source_id: str
    project_id: str
    project_title: str
    section: str
    url: str


class RelatedProject(BaseModel):
    id: str
    title: str
    url: str


class RetrievalSummary(BaseModel):
    mode: Literal["hybrid"] = "hybrid"
    semantic_matches: int
    context_chunks: int


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceReference]
    related_projects: list[RelatedProject]
    retrieval: RetrievalSummary


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    embedding_model: Literal["ready", "unavailable"]
    index: Literal["ready", "unavailable"]
    llm: Literal["ready", "unavailable"]


class RetrievalResultItem(BaseModel):
    source_id: str
    project_id: str
    project_title: str
    section: str
    url: str
    reasons: list[str]


class RetrievalDebugResponse(BaseModel):
    mode: Literal["hybrid"] = "hybrid"
    results: list[RetrievalResultItem]

