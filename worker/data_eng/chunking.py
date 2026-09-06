"""
Splits long document text into overlapping, sentence-aware chunks
before embedding.

Rules/disclosures (worker/ai/rules_corpus.py) don't need this — each
one is already a single atomic sentence, so "embed the whole thing"
IS "embed the right unit of meaning." A submitted document is not:
embedding a whole multi-paragraph document as one vector blurs
together unrelated claims and disclosures into a single averaged
meaning, which makes "which passage triggered this flag" impossible
to answer. Chunking keeps each embedded unit small enough that a
match is traceable to a specific, quotable piece of the document.

These chunks are NOT persisted — they exist only for the duration of
one document's analysis run (embed -> query the persisted `rules`
table -> discard). Unlike the rules corpus, there is no permanent
document-chunk table.
"""
from dataclasses import dataclass
import re

# Splits after sentence-ending punctuation, on the whitespace that
# follows, as long as a capital letter or digit comes next. `\s+` also
# matches blank lines, so this naturally splits at paragraph breaks too
# without needing a separate paragraph-splitting pass.
#
# Known limitation (documented, not fixed): this will mis-split on
# abbreviations like "Mr. Smith" or "e.g. this" — a heuristic, not a
# real sentence tokenizer. Same category of limitation as the regex
# PII masker; acceptable at this project's scope.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")

DEFAULT_CHUNK_SIZE = 800      # characters (~200 tokens, safely under bge-base's ~512-token limit)
DEFAULT_CHUNK_OVERLAP = 150   # characters carried from the end of one chunk into the next


@dataclass
class DocumentChunk:
    text: str          # normalized (single-spaced) text — what gets embedded
    chunk_index: int
    char_start: int    # offsets into the ORIGINAL document text, for exact-quote traceability
    char_end: int


def _split_into_sentences(text: str) -> list[tuple[str, int, int]]:
    """Returns (sentence_text, start_offset, end_offset), offsets
    relative to the original `text`. Uses a forward-only cursor with
    str.index(..., cursor) so repeated identical sentences elsewhere in
    the document don't get matched to the wrong occurrence."""
    sentences: list[tuple[str, int, int]] = []
    cursor = 0

    for piece in _SENTENCE_SPLIT.split(text):
        start = text.index(piece, cursor)
        cursor = start + len(piece)

        stripped = piece.strip()
        if not stripped:
            continue

        leading_ws = len(piece) - len(piece.lstrip())
        abs_start = start + leading_ws
        sentences.append((stripped, abs_start, abs_start + len(stripped)))

    return sentences


def chunk_document(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[DocumentChunk]:
    """Greedily packs sentences into chunks up to chunk_size characters,
    carrying the tail sentences of each chunk forward as overlap into
    the next one. A single sentence longer than chunk_size on its own
    (e.g. a spreadsheet row with no punctuation at all) falls back to a
    hard character-window split, since there's no sentence boundary to
    respect in that case."""
    sentences = _split_into_sentences(text)
    if not sentences:
        return []

    chunks: list[DocumentChunk] = []
    current: list[tuple[str, int, int]] = []
    current_len = 0

    def flush() -> None:
        if not current:
            return
        chunks.append(
            DocumentChunk(
                text=" ".join(s[0] for s in current),
                chunk_index=len(chunks),
                char_start=current[0][1],
                char_end=current[-1][2],
            )
        )

    for sentence, start, end in sentences:
        sentence_len = end - start

        if sentence_len > chunk_size:
            # Fallback path: one oversized "sentence" (no punctuation to
            # split on) gets hard-split by character window instead.
            flush()
            current, current_len = [], 0
            step = chunk_size - chunk_overlap
            for i in range(0, len(sentence), step):
                piece = sentence[i : i + chunk_size]
                chunks.append(
                    DocumentChunk(
                        text=piece,
                        chunk_index=len(chunks),
                        char_start=start + i,
                        char_end=start + i + len(piece),
                    )
                )
            continue

        if current_len + sentence_len > chunk_size and current:
            flush()
            # Carry the tail of the flushed chunk forward as overlap.
            overlap: list[tuple[str, int, int]] = []
            overlap_len = 0
            for s in reversed(current):
                s_len = s[2] - s[1]
                if overlap_len + s_len > chunk_overlap:
                    break
                overlap.insert(0, s)
                overlap_len += s_len
            current, current_len = overlap, overlap_len

        current.append((sentence, start, end))
        current_len += sentence_len

    flush()
    return chunks