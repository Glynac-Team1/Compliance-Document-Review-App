import unittest

from worker.data_eng.chunking import chunk_document, DEFAULT_CHUNK_SIZE


class TestChunking(unittest.TestCase):
    def test_empty_text_returns_no_chunks(self):
        self.assertEqual(chunk_document(""), [])

    def test_short_text_is_a_single_chunk(self):
        text = "Our fund guarantees a 12% annual return. Past performance is not indicative of future results."
        chunks = chunk_document(text, chunk_size=500, chunk_overlap=50)
        self.assertEqual(len(chunks), 1)
        self.assertIn("guarantees a 12%", chunks[0].text)

    def test_offsets_point_back_to_original_text(self):
        text = "Client accounts were reviewed. No irregularities were found. The advisor signed off."
        chunks = chunk_document(text, chunk_size=500, chunk_overlap=0)
        chunk = chunks[0]
        # char_start/char_end must index the ORIGINAL text, not chunk.text
        recovered = text[chunk.char_start : chunk.char_end]
        self.assertEqual(" ".join(recovered.split()), chunk.text)

    def test_long_text_splits_into_multiple_chunks(self):
        sentence = "This is a compliance sentence about disclosures and required risk statements. "
        text = sentence * 40  # long enough to force multiple chunks at default size
        chunks = chunk_document(text, chunk_size=DEFAULT_CHUNK_SIZE, chunk_overlap=100)
        self.assertGreater(len(chunks), 1)
        for c in chunks:
            self.assertLessEqual(len(c.text), DEFAULT_CHUNK_SIZE + 50)  # small slack for the last sentence added

    def test_overlap_repeats_tail_content_in_next_chunk(self):
        sentences = [f"This is sentence number {i} in the document about compliance." for i in range(30)]
        text = " ".join(sentences)
        chunks = chunk_document(text, chunk_size=300, chunk_overlap=100)
        self.assertGreater(len(chunks), 1)
        # some content from the end of chunk 0 should reappear at the start of chunk 1
        tail_of_first = chunks[0].text[-40:]
        self.assertTrue(any(word in chunks[1].text for word in tail_of_first.split()[:3]))

    def test_chunk_indexes_are_sequential(self):
        text = ("Sentence about risk. " * 100)
        chunks = chunk_document(text, chunk_size=400, chunk_overlap=50)
        self.assertEqual([c.chunk_index for c in chunks], list(range(len(chunks))))

    def test_no_sentence_boundaries_falls_back_to_hard_split(self):
        # A single "sentence" with no punctuation at all, longer than chunk_size —
        # simulates something like an XLSX row dump with no periods.
        text = "word " * 500  # ~2500 chars, no sentence-ending punctuation
        chunks = chunk_document(text, chunk_size=300, chunk_overlap=50)
        self.assertGreater(len(chunks), 1)
        for c in chunks:
            self.assertLessEqual(len(c.text), 300)


if __name__ == "__main__":
    unittest.main()