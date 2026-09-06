"""
Precedent search — the third retrieval job. Compares a submitted
document (as ONE averaged vector across its chunks) against a corpus
of past reviewed documents, each stored as a single whole-document
embedding, per the brief's Precedent Index definition.
"""
from dataclasses import dataclass
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Precedent
from worker.data_eng.embeddings import embed_text

REQUIRED_TOP_K = 3  # fixed by spec, not a tunable parameter


@dataclass
class RetrievedPrecedent:
    decision: str
    comment: str
    distance: float


def average_embedding(chunk_embeddings: list[list[float]]) -> list[float]:
    """Collapses per-chunk embeddings (Stage 4) into one whole-document
    vector for precedent comparison. Not necessarily unit length after
    averaging — fine here because pgvector's <=> operator computes true
    cosine distance (accounts for magnitude), unlike the hand-rolled
    dot-product shortcut used in disclosure_check.py, which specifically
    depended on pre-normalized inputs."""
    if not chunk_embeddings:
        raise ValueError("Cannot average an empty list of chunk embeddings")
    dims = len(chunk_embeddings[0])
    sums = [0.0] * dims
    for emb in chunk_embeddings:
        for i, v in enumerate(emb):
            sums[i] += v
    return [s / len(chunk_embeddings) for s in sums]


async def retrieve_precedents(
    session: AsyncSession, chunk_embeddings: list[list[float]], top_k: int = REQUIRED_TOP_K
) -> list[RetrievedPrecedent]:
    if not chunk_embeddings:
        return []

    query_vector = average_embedding(chunk_embeddings)

    stmt = (
        select(Precedent, Precedent.embedding.cosine_distance(query_vector).label("distance"))
        .order_by(Precedent.embedding.cosine_distance(query_vector))
        .limit(top_k)
    )
    result = await session.execute(stmt)
    return [
        RetrievedPrecedent(decision=p.decision.value, comment=p.comment, distance=distance)
        for p, distance in result.all()
    ]


async def add_precedent(
    session: AsyncSession,
    masked_text: str,
    decision: str,
    comment: str,
    precedent_key: str | None = None,
    source_document_id: uuid.UUID | None = None,
    source: str = "production",
) -> Precedent:
    """Embeds and stores one precedent. Used by the synthetic seed
    script tonight (source='synthetic-seed'); a real integration point
    for later is calling this after an officer records an actual
    decision (source='production', source_document_id set) — that
    wiring is Backend/Celery territory, not built yet."""
    embedding = embed_text(masked_text[:2000])  # ~500 tokens, safely under the model's ~512-token limit
    precedent = Precedent(
        precedent_key=precedent_key,
        source_document_id=source_document_id,
        masked_text=masked_text,
        decision=decision,
        comment=comment,
        embedding=embedding,
        source=source,
    )
    session.add(precedent)
    return precedent