"""
Rule retrieval: given a submitted document's chunk embeddings, find the
compliance rules that are actually semantically relevant — replacing
gemini_assist.py's original "stuff all rules into every prompt"
approach with retrieve-then-generate (RAG).
"""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Rule


@dataclass
class RetrievedRule:
    rule_key: str
    rule_type: str
    text: str
    distance: float  # cosine DISTANCE: 0.0 = identical meaning. LOWER is more relevant.


async def _top_k_rules_for_embedding(
    session: AsyncSession, embedding: list[float], top_k: int
) -> list[RetrievedRule]:
    stmt = (
        select(Rule, Rule.embedding.cosine_distance(embedding).label("distance"))
        .order_by(Rule.embedding.cosine_distance(embedding))
        .limit(top_k)
    )
    result = await session.execute(stmt)
    return [
        RetrievedRule(rule_key=rule.rule_key, rule_type=rule.rule_type, text=rule.text, distance=distance)
        for rule, distance in result.all()
    ]


async def retrieve_rules_for_document(
    session: AsyncSession,
    chunk_embeddings: list[list[float]],
    top_k_per_chunk: int = 3,
    max_total_rules: int = 8,
) -> list[RetrievedRule]:
    """Accepts PRECOMPUTED chunk embeddings (caller embeds once and
    reuses across rule retrieval, disclosure checking, and precedent
    search — see worker/ai/pipeline.py). Retrieves top-k rules per
    chunk embedding, merges across chunks keeping each rule's
    best (lowest) distance, caps the total for prompt size."""
    if not chunk_embeddings:
        return []

    best_by_rule_key: dict[str, RetrievedRule] = {}
    for embedding in chunk_embeddings:
        for retrieved in await _top_k_rules_for_embedding(session, embedding, top_k_per_chunk):
            existing = best_by_rule_key.get(retrieved.rule_key)
            if existing is None or retrieved.distance < existing.distance:
                best_by_rule_key[retrieved.rule_key] = retrieved

    merged = sorted(best_by_rule_key.values(), key=lambda r: r.distance)
    return merged[:max_total_rules]