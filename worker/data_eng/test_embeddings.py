import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from worker.data_eng.chunking import DocumentChunk
from worker.data_eng.disclosure_check import find_missing_disclosures
from worker.data_eng.embeddings import embed_document_chunks
from worker.data_eng.retrieval import retrieve_rules_for_document


class TestDocumentChunkEmbeddings(unittest.IsolatedAsyncioTestCase):
    async def test_retrieval_and_disclosure_detection_reuse_one_embedding_batch(self):
        chunks = [
            DocumentChunk(text="first", chunk_index=0, char_start=0, char_end=5),
            DocumentChunk(text="second", chunk_index=1, char_start=5, char_end=11),
        ]
        vectors = [[1.0, 0.0], [0.0, 1.0]]
        disclosure = SimpleNamespace(rule_key="disclosure", text="required", embedding=[1.0, 0.0])

        class Session:
            async def execute(self, _statement):
                return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [disclosure]))

        with patch("worker.data_eng.embeddings.embed_texts", return_value=vectors) as embed:
            prepared = embed_document_chunks(chunks)
            with patch("worker.data_eng.retrieval._top_k_rules_for_embedding", new=AsyncMock(return_value=[])):
                await retrieve_rules_for_document(Session(), prepared)
            await find_missing_disclosures(Session(), prepared)

        embed.assert_called_once_with(["first", "second"])
        self.assertEqual([chunk.embedding for chunk in prepared], vectors)


if __name__ == "__main__":
    unittest.main()