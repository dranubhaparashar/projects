from __future__ import annotations

import pytest


@pytest.mark.parametrize(
    ("question", "expected_id"),
    [
        ("projects using Snowflake", "engineering-work-order-profit-and-loss-analytics"),
        ("zero knowledge identity", "lightdid-zkp"),
        ("automotive computer vision", "end-to-end-yolo"),
        ("agent orchestration and tools", "my-first-post"),
        ("dynamic service composition", "llm-agents"),
        ("generator failure prediction", "predictive-preventive-maintenance-generator"),
    ],
)
def test_expected_project_is_retrieved(retriever, question, expected_id):
    result = retriever.retrieve(question)
    assert any(expected_id in project_id for project_id in result.project_ids), result.project_ids


def test_comparison_keeps_both_named_projects(retriever):
    result = retriever.retrieve(
        "Compare MCP 2.0 and Autonomous Microservice Composition"
    )
    assert "my-first-post" in result.project_ids
    assert "llm-agents" in result.project_ids
    context_ids = {hit.chunk.project_id for hit in result.context}
    assert {"my-first-post", "llm-agents"}.issubset(context_ids)


def test_chunks_are_section_aware_and_bounded(knowledge_base):
    assert len(knowledge_base.projects) == 14
    assert len(knowledge_base.chunks) > len(knowledge_base.projects)
    assert all(len(chunk["text"].split()) <= 620 for chunk in knowledge_base.chunks)
    assert all(chunk["section"] for chunk in knowledge_base.chunks)
    assert len({chunk["chunk_id"] for chunk in knowledge_base.chunks}) == len(
        knowledge_base.chunks
    )

