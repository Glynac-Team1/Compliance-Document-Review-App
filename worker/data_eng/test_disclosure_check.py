import unittest

from app.database import AsyncSessionLocal
from worker.data_eng.disclosure_check import cosine_distance, find_missing_disclosures
from worker.data_eng.embeddings import embed_texts


class TestCosineDistanceHelper(unittest.TestCase):
    def test_identical_vectors_have_zero_distance(self):
        v = [0.6, 0.8]
        self.assertAlmostEqual(cosine_distance(v, v), 0.0, places=6)

    def test_orthogonal_unit_vectors_have_distance_one(self):
        self.assertAlmostEqual(cosine_distance([1.0, 0.0], [0.0, 1.0]), 1.0, places=6)

    def test_opposite_vectors_have_distance_two(self):
        self.assertAlmostEqual(cosine_distance([1.0, 0.0], [-1.0, 0.0]), 2.0, places=6)


class TestMissingDisclosureDetection(unittest.IsolatedAsyncioTestCase):
    async def test_reworded_disclosure_is_recognized_as_present(self):
        embeddings = embed_texts([
            "Please note that all investments carry market risk, and you could lose some or all of your principal."
        ])
        async with AsyncSessionLocal() as session:
            missing = await find_missing_disclosures(session, embeddings)
        self.assertNotIn("RULE_DISCLOSURE_PRINCIPAL_RISK", [m.rule_key for m in missing])

    async def test_unrelated_content_flags_disclosures_as_missing(self):
        embeddings = embed_texts(["Please schedule a call next Tuesday to discuss the office holiday party."])
        async with AsyncSessionLocal() as session:
            missing = await find_missing_disclosures(session, embeddings)
        self.assertIn("RULE_DISCLOSURE_PRINCIPAL_RISK", [m.rule_key for m in missing])
        self.assertIn("RULE_DISCLOSURE_PAST_PERFORMANCE", [m.rule_key for m in missing])

    async def test_empty_document_flags_all_disclosures_missing(self):
        async with AsyncSessionLocal() as session:
            missing = await find_missing_disclosures(session, chunk_embeddings=[])
        rule_keys = [m.rule_key for m in missing]
        self.assertIn("RULE_DISCLOSURE_PRINCIPAL_RISK", rule_keys)
        self.assertIn("RULE_DISCLOSURE_TAX_LEGAL", rule_keys)


if __name__ == "__main__":
    unittest.main()