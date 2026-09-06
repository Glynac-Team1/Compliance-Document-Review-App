"""
Rule retrieval: given a submitted document's chunks, find the
compliance rules that are actually semantically relevant — replacing
gemini_assist.py's current "stuff all 14 rules into every prompt"
approach with retrieve-then-generate (RAG).
"""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Rule
from worker.data_eng.chunking import DocumentChunk
from worker.data_eng.embeddings import embed_texts


@dataclass
class RetrievedRule:
    rule_key: str
    rule_type: str
    text: str
    distance: float  # cosine DISTANCE: 0.0 = identical meaning. LOWER is more relevant.


async def _top_k_rules_for_embedding(
    session: AsyncSession, embedding: list[float], top_k: int
) -> list[RetrievedRule]:
    """One similarity query against the corpus built in Stage 1.
    ORDER BY ascending distance — the closest (most relevant) rule
    comes first, since lower distance means more similar meaning."""
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
    chunks: list[DocumentChunk],
    top_k_per_chunk: int = 3,
    max_total_rules: int = 8,
) -> list[RetrievedRule]:
    """Embeds every chunk (batched), retrieves top-k rules PER chunk,
    then merges across chunks: a rule relevant to multiple chunks is
    kept once, at its best (lowest) distance — capping the final list
    at max_total_rules keeps the RAG prompt small regardless of
    document length."""
    if not chunks:
        return []

    embeddings = embed_texts([c.text for c in chunks])

    best_by_rule_key: dict[str, RetrievedRule] = {}
    for embedding in embeddings:
        for retrieved in await _top_k_rules_for_embedding(session, embedding, top_k_per_chunk):
            existing = best_by_rule_key.get(retrieved.rule_key)
            if existing is None or retrieved.distance < existing.distance:
                best_by_rule_key[retrieved.rule_key] = retrieved

    merged = sorted(best_by_rule_key.values(), key=lambda r: r.distance)
    return merged[:max_total_rules]