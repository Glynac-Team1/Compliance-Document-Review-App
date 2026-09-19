import unittest

from app.database import AsyncSessionLocal
from worker.data_eng.embeddings import embed_text, embed_texts
from worker.data_eng.retrieval import (
    _top_k_rules_for_embedding,
    retrieve_rules_for_document,
)


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
        embeddings = embed_texts([
            "We guarantee a risk-free 20% return.",
            "Past 3-year performance has been excellent.",
        ])
        async with AsyncSessionLocal() as session:
            results = await retrieve_rules_for_document(session, embeddings, top_k_per_chunk=3, max_total_rules=4)

        self.assertLessEqual(len(results), 4)
        rule_keys = [r.rule_key for r in results]
        self.assertEqual(len(rule_keys), len(set(rule_keys)))


if __name__ == "__main__":
    unittest.main()