"""
SYNTHETIC/DEMO precedent corpus — NOT real reviewed documents.
Hand-written examples for exercising the precedent-search mechanism.
The brief targets ~100 seeded documents for meaningful retrieval
tuning; this 12-entry set proves the pipeline works, and should be
expanded (ideally LLM-generated per the brief's own suggestion) before
this is considered feature-complete.

Run inside the worker container:
    docker compose exec worker python -m worker.data_eng.seed_precedents_corpus
"""
import asyncio
import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal
from models import Precedent
from worker.data_eng.precedent_search import add_precedent

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# masked_text uses the SAME placeholder style as PIIMasker's real output
# ([CLIENT_1], [AMOUNT_1]) so retrieval is tested against representative,
# realistic-shaped input, not clean natural-language prose.
SYNTHETIC_PRECEDENTS = [
    {
        "key": "SEED_PRECEDENT_001",
        "masked_text": "This brochure informs [CLIENT_1] that our fund guarantees a fixed 18% annual return with no possibility of loss.",
        "decision": "reject",
        "comment": "Guaranteed-return language violates FINRA 2210. Rejected pending rewrite.",
    },
    {
        "key": "SEED_PRECEDENT_002",
        "masked_text": "Newsletter to [CLIENT_1]: past 5-year performance was 9.2% annualized. Past performance is no guarantee of future results.",
        "decision": "approve",
        "comment": "Performance disclosure present and correctly worded. Approved.",
    },
    {
        "key": "SEED_PRECEDENT_003",
        "masked_text": "Proposal for [CLIENT_1] discussing estate planning strategies for [AMOUNT_1] in assets, no tax/legal disclaimer included.",
        "decision": "needs_revision",
        "comment": "Missing required tax/legal disclaimer per RULE_DISCLOSURE_TAX_LEGAL. Needs revision before resubmission.",
    },
    {
        "key": "SEED_PRECEDENT_004",
        "masked_text": "Marketing email claiming our strategy is 'the best-performing fund in the country' with no third-party source cited.",
        "decision": "reject",
        "comment": "Unsubstantiated superlative claim. Rejected — cite source or remove claim.",
    },
    {
        "key": "SEED_PRECEDENT_005",
        "masked_text": "Client onboarding packet for [CLIENT_1] includes signature field and advisor acknowledgment section.",
        "decision": "approve",
        "comment": "All required formatting fields present. Approved.",
    },
    {
        "key": "SEED_PRECEDENT_006",
        "masked_text": "Social media post: 'Guaranteed to double your money in 2 years — risk-free investing with us!'",
        "decision": "reject",
        "comment": "Two separate prohibited-claim violations (guarantee + risk-free). Rejected.",
    },
    {
        "key": "SEED_PRECEDENT_007",
        "masked_text": "Quarterly letter to [CLIENT_1] comparing portfolio performance to the S&P 500 without stating whether dividends were reinvested.",
        "decision": "needs_revision",
        "comment": "Benchmark comparison missing dividend-reinvestment disclosure. Needs revision.",
    },
    {
        "key": "SEED_PRECEDENT_008",
        "masked_text": "Brochure states advisory fees are deducted quarterly from [CLIENT_1]'s account of [AMOUNT_1], net performance shown.",
        "decision": "approve",
        "comment": "Fee disclosure and net-of-fees presentation both correct. Approved.",
    },
    {
        "key": "SEED_PRECEDENT_009",
        "masked_text": "Presentation cherry-picks a single strong quarter (+14%) without showing 1/5/10-year performance context.",
        "decision": "needs_revision",
        "comment": "Selective timeframe presentation violates performance standards. Needs revision.",
    },
    {
        "key": "SEED_PRECEDENT_010",
        "masked_text": "Standard market commentary newsletter for [CLIENT_1], no performance claims, no disclosures required.",
        "decision": "approve",
        "comment": "No compliance-sensitive content. Approved.",
    },
    {
        "key": "SEED_PRECEDENT_011",
        "masked_text": "Hypothetical backtested model shown as if it were actual live trading results, no assumptions disclosed.",
        "decision": "reject",
        "comment": "Backtested performance not identified as hypothetical. Rejected per RULE_DISCLOSURE_HYPOTHETICAL_BACKTEST.",
    },
    {
        "key": "SEED_PRECEDENT_012",
        "masked_text": "Newsletter missing the required compliance approval identifier and publication date in the footer.",
        "decision": "needs_revision",
        "comment": "Missing formatting obligation. Needs revision — add approval ID and date.",
    },
]


async def main() -> None:
    inserted = skipped = 0
    async with AsyncSessionLocal() as session:
        for entry in SYNTHETIC_PRECEDENTS:
            existing = (
                await session.execute(select(Precedent).where(Precedent.precedent_key == entry["key"]))
            ).scalar_one_or_none()

            if existing is not None:
                logger.info("skipped (already seeded): %s", entry["key"])
                skipped += 1
                continue

            await add_precedent(
                session,
                masked_text=entry["masked_text"],
                decision=entry["decision"],
                comment=entry["comment"],
                precedent_key=entry["key"],
                source="synthetic-seed",
            )
            logger.info("inserted: %s", entry["key"])
            inserted += 1

        await session.commit()

    logger.info("Done. %d inserted, %d skipped (already present).", inserted, skipped)


if __name__ == "__main__":
    asyncio.run(main())