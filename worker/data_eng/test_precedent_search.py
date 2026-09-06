import unittest

from app.database import AsyncSessionLocal
from worker.data_eng.embeddings import embed_text
from worker.data_eng.precedent_search import average_embedding, retrieve_precedents


class TestAverageEmbedding(unittest.TestCase):
    def test_averaging_identical_vectors_returns_the_same_vector(self):
        v = [0.5, 0.5, 0.5]
        self.assertEqual(average_embedding([v, v, v]), v)

    def test_raises_on_empty_input(self):
        with self.assertRaises(ValueError):
            average_embedding([])


class TestPrecedentRetrieval(unittest.IsolatedAsyncioTestCase):
    """Integration tests — require the dev Postgres running with the
    precedent corpus already seeded (seed_precedents_corpus.py)."""

    async def test_guaranteed_return_document_matches_rejected_precedents(self):
        query_chunk_embedding = embed_text(
            "We guarantee our clients a fixed 20% annual return with zero downside risk."
        )
        async with AsyncSessionLocal() as session:
            results = await retrieve_precedents(session, chunk_embeddings=[query_chunk_embedding])

        self.assertEqual(len(results), 3)  # top_k is fixed at 3 by spec
        decisions = [r.decision for r in results]
        self.assertIn("reject", decisions)

    async def test_clean_newsletter_matches_approved_precedents(self):
        query_chunk_embedding = embed_text(
            "Quarterly market commentary with no performance claims or disclosures needed."
        )
        async with AsyncSessionLocal() as session:
            results = await retrieve_precedents(session, chunk_embeddings=[query_chunk_embedding])

        decisions = [r.decision for r in results]
        self.assertIn("approve", decisions)


if __name__ == "__main__":
    unittest.main()