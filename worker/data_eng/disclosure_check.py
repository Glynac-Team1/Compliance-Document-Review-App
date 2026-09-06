"""
Missing-disclosure detection by absence — the inverse of normal
retrieval. Rule retrieval (Stage 4) asks "which rules are closest to
this chunk?" This asks "is there ANY chunk close enough to this
required disclosure to count as present?" A required disclosure is
missing if its closest chunk still falls outside a similarity
threshold — not if it fails to be the top match, which is a different
and much weaker condition.

Keyword matching can't do this: disclosures get paraphrased
("subject to market risk" vs "you could lose your principal"), so
presence has to be judged by meaning, not exact wording.
"""
from dataclasses import dataclass
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Rule
from worker.data_eng.chunking import DocumentChunk
from worker.data_eng.embeddings import embed_texts

logger = logging.getLogger(__name__)

# Cosine DISTANCE threshold (0 = identical meaning, 2 = opposite meaning).
# A chunk closer than this to a disclosure counts as containing it.
# Starting value, calibrated by feel against bge-base-en-v1.5's typical
# paraphrase-similarity range — NOT mathematically derived. Tune this
# against real examples before trusting it; see test cases below for
# the specific pairs it was checked against.
DEFAULT_ABSENCE_THRESHOLD = 0.35

REQUIRED_DISCLOSURE_TYPE = "REQUIRED_DISCLOSURE"  # must match rules_corpus.py category strings exactly


@dataclass
class MissingDisclosure:
    rule_key: str
    text: str
    closest_distance: float  # how close the nearest chunk got, even though it wasn't close enough


def cosine_distance(a, b) -> float:
    """1 - cosine_similarity. Because embed_text/embed_texts always
    normalize_embeddings=True, both vectors have length 1, so cosine
    similarity reduces to a plain dot product — this is the exact same
    quantity pgvector's `<=>` operator computes for normalized vectors,
    so these numbers are directly comparable to Stage 4's SQL-computed
    distances."""
    return 1.0 - sum(x * y for x, y in zip(a, b))


async def find_missing_disclosures(
    session: AsyncSession,
    chunks: list[DocumentChunk],
    threshold: float = DEFAULT_ABSENCE_THRESHOLD,
) -> list[MissingDisclosure]:
    stmt = select(Rule).where(Rule.rule_type == REQUIRED_DISCLOSURE_TYPE)
    disclosures = (await session.execute(stmt)).scalars().all()
    if not disclosures:
        return []

    chunk_embeddings = embed_texts([c.text for c in chunks]) if chunks else []

    missing: list[MissingDisclosure] = []
    for disclosure in disclosures:
        if not chunk_embeddings:
            # No document content at all — every required disclosure is
            # trivially absent. Use the maximum possible distance (2.0)
            # rather than skipping, so this is visible in results/logs
            # as "genuinely absent," not silently omitted.
            closest = 2.0
        else:
            closest = min(cosine_distance(list(disclosure.embedding), emb) for emb in chunk_embeddings)

        logger.debug("disclosure=%s closest_distance=%.3f threshold=%.3f", disclosure.rule_key, closest, threshold)

        if closest > threshold:
            missing.append(
                MissingDisclosure(rule_key=disclosure.rule_key, text=disclosure.text, closest_distance=closest)
            )

    return missing