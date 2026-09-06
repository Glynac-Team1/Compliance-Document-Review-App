"""
Integration test — requires the dev Postgres running AND the rules
corpus already seeded (run seed_rules_corpus.py first). Not a hermetic
unit test: it exercises the real pgvector query against real seeded
data, which is what actually matters to verify for retrieval quality.
"""
import unittest

from app.database import AsyncSessionLocal
from worker.data_eng.chunking import DocumentChunk
from worker.data_eng.embeddings import embed_text
from worker.data_eng.retrieval import _top_k_rules_for_embedding, retrieve_rules_for_document


class TestRuleRetrieval(unittest.IsolatedAsyncioTestCase):
    async def test_guarantee_claim_retrieves_the_no_guarantees_rule(self):
        embedding = embed_text("Our fund guarantees a fixed 15% annual return with zero risk.")
        async with AsyncSessionLocal() as session:
            results = await _top_k_rules_for_embedding(session, embedding, top_k=5)
        self.assertIn("RULE_FINRA_2210_NO_GUARANTEES", [r.rule_key for r in results])

    async def test_past_performance_mention_retrieves_disclosure_rule(self):
        embedding = embed_text("Over the last five years, the portfolio returned an average of 9% annually.")
        async with AsyncSessionLocal() as session:
            results = await _top_k_rules_for_embedding(session, embedding, top_k=5)
        self.assertIn("RULE_DISCLOSURE_PAST_PERFORMANCE", [r.rule_key for r in results])

    async def test_retrieve_rules_for_document_dedupes_and_caps(self):
        chunks = [
            DocumentChunk(text="We guarantee a risk-free 20% return.", chunk_index=0, char_start=0, char_end=10),
            DocumentChunk(text="Past 3-year performance has been excellent.", chunk_index=1, char_start=10, char_end=20),
        ]
        async with AsyncSessionLocal() as session:
            results = await retrieve_rules_for_document(session, chunks, top_k_per_chunk=3, max_total_rules=4)

        self.assertLessEqual(len(results), 4)
        rule_keys = [r.rule_key for r in results]
        self.assertEqual(len(rule_keys), len(set(rule_keys)))  # no duplicates across chunks


if __name__ == "__main__":
    unittest.main()