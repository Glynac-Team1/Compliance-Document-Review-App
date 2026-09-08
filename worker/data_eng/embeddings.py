"""
Shared local embedding model loader. Centralized here so the rules
corpus seed script and the document retrieval pipeline reuse the SAME
loaded model instance within a worker process, instead of each holding
its own copy in memory (~440MB each if duplicated).
"""
from functools import lru_cache
import logging

from sentence_transformers import SentenceTransformer
from worker.data_eng.chunking import DocumentChunk

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "BAAI/bge-base-en-v1.5"  # 768-dim, matches rules.embedding column


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    logger.info("Loading embedding model %s (first run downloads ~440MB)...", EMBEDDING_MODEL_NAME)
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


def _add_compliance_context(text: str) -> str:
    """Make common compliance triggers explicit to the general embedding model."""
    lower_text = text.lower()
    cues: list[str] = []

    if any(phrase in lower_text for phrase in (
        "past performance",
        "annual return",
        "five years",
        "last five years",
        "historical returns",
        "portfolio returned",
    )):
        cues.append("Past performance is no guarantee of future results.")

    if any(phrase in lower_text for phrase in (
        "guaranteed",
        "guarantee",
        "fixed return",
        "zero risk",
        "risk-free",
        "safe return",
    )):
        cues.append("Guaranteed or risk-free returns are prohibited.")

    return f"{text} {' '.join(cues)}" if cues else text


def embed_text(text: str) -> list[float]:
    """Embeds a single string. Returns a flat list of 768 floats."""
    return get_embedding_model().encode(
        _add_compliance_context(text), normalize_embeddings=True
    ).tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batched embedding — the model processes all texts together in
    one call, which is meaningfully faster than calling embed_text() in
    a loop when a document has several chunks."""
    if not texts:
        return []
    prepared_texts = [_add_compliance_context(text) for text in texts]
    vectors = get_embedding_model().encode(prepared_texts, normalize_embeddings=True)
    return [v.tolist() for v in vectors]


def embed_document_chunks(chunks: list[DocumentChunk]) -> list[DocumentChunk]:
    """Populate each document chunk with its normalized embedding once."""
    if not chunks:
        return chunks

    embeddings = embed_texts([chunk.text for chunk in chunks])
    for chunk, embedding in zip(chunks, embeddings):
        chunk.embedding = embedding
    return chunks


def document_chunk_embeddings(chunks: list[DocumentChunk]) -> list[list[float]]:
    """Return prepared chunk embeddings, rejecting an incomplete pipeline."""
    embeddings = [chunk.embedding for chunk in chunks]
    if any(embedding is None for embedding in embeddings):
        raise ValueError("Document chunks must be embedded before downstream analysis")
    return [embedding for embedding in embeddings if embedding is not None]