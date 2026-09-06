"""
Idempotent ingestion of the compliance rules corpus into Postgres/pgvector.

Reads the synthetic rules list from worker.ai.rules_corpus, embeds each
rule's text with a local sentence-transformers model, and upserts each
one into the `rules` table keyed on its stable `rule_key` — so running
this script twice updates the same rows instead of duplicating them.

Run inside the worker container:
    docker compose exec worker python -m worker.data_eng.seed_rules_corpus
"""

import asyncio
import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal
from models import Rule
from worker.ai.rules_corpus import COMPLIANCE_RULES_CORPUS

# Reuse the centralized embedding module
from worker.data_eng.embeddings import embed_text, EMBEDDING_MODEL_NAME
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


CORPUS_VERSION = "v1"


async def upsert_rule(session, rule_dict: dict) -> str:
    """Insert a new rule row, or update an existing one in place if its
    rule_key already exists. Returns 'inserted' or 'updated' for logging."""
    embedding = embed_text(rule_dict["text"])

    result = await session.execute(select(Rule).where(Rule.rule_key == rule_dict["id"]))
    existing = result.scalar_one_or_none()

    if existing is None:
        session.add(
            Rule(
                rule_key=rule_dict["id"],
                rule_type=rule_dict["category"],
                text=rule_dict["text"],
                embedding=embedding,
                source="synthetic-seed",
                corpus_version=CORPUS_VERSION,
                embedding_model=EMBEDDING_MODEL_NAME,
            )
        )
        return "inserted"

    # Update in place: text may have changed since the last seed run,
    # and if it has, the embedding MUST be regenerated to match —
    # a stale embedding paired with new text is worse than no embedding.
    existing.rule_type = rule_dict["category"]
    existing.text = rule_dict["text"]
    existing.embedding = embedding
    existing.corpus_version = CORPUS_VERSION
    existing.embedding_model = EMBEDDING_MODEL_NAME
    return "updated"


async def main() -> None:
    inserted = updated = 0

    async with AsyncSessionLocal() as session:
        for rule_dict in COMPLIANCE_RULES_CORPUS:
            outcome = await upsert_rule(session, rule_dict)
            if outcome == "inserted":
                inserted += 1
            else:
                updated += 1
            logger.info("%s: %s", outcome, rule_dict["id"])

        await session.commit()

    logger.info(
        "Done. %d inserted, %d updated, %d total rules in corpus.",
        inserted,
        updated,
        len(COMPLIANCE_RULES_CORPUS),
    )


if __name__ == "__main__":
    asyncio.run(main())