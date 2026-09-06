"""
Shared local embedding model loader. Centralized here so the rules
corpus seed script and the document retrieval pipeline reuse the SAME
loaded model instance within a worker process, instead of each holding
its own copy in memory (~440MB each if duplicated).
"""
from functools import lru_cache
import logging

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "BAAI/bge-base-en-v1.5"  # 768-dim, matches rules.embedding column


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    logger.info("Loading embedding model %s (first run downloads ~440MB)...", EMBEDDING_MODEL_NAME)
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


def embed_text(text: str) -> list[float]:
    """Embeds a single string. Returns a flat list of 768 floats."""
    return get_embedding_model().encode(text, normalize_embeddings=True).tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batched embedding — the model processes all texts together in
    one call, which is meaningfully faster than calling embed_text() in
    a loop when a document has several chunks."""
    if not texts:
        return []
    vectors = get_embedding_model().encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vectors]