"""Small, labeled evaluation harness for disclosure-presence thresholds.

This intentionally reports retrieval classification metrics rather than claiming
statistical model quality. The examples must be labeled as disclosure-present
or disclosure-absent by a reviewer before a threshold is selected.
"""
from dataclasses import dataclass
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Rule
from worker.data_eng.disclosure_check import cosine_distance
from worker.data_eng.embeddings import embed_texts


@dataclass(frozen=True)
class DisclosureExample:
    rule_key: str
    embedding: list[float]
    expected_present: bool


@dataclass(frozen=True)
class LabeledDisclosureExample:
    rule_key: str
    text: str
    expected_present: bool


@dataclass(frozen=True)
class ThresholdMetrics:
    threshold: float
    true_positive: int
    false_positive: int
    false_negative: int
    precision: float
    recall: float
    f1: float


def evaluate_threshold(
    examples: Iterable[DisclosureExample],
    disclosure_embeddings: dict[str, list[float]],
    threshold: float,
) -> ThresholdMetrics:
    true_positive = false_positive = false_negative = 0
    for example in examples:
        disclosure_embedding = disclosure_embeddings[example.rule_key]
        predicted_present = cosine_distance(disclosure_embedding, example.embedding) <= threshold
        if predicted_present and example.expected_present:
            true_positive += 1
        elif predicted_present and not example.expected_present:
            false_positive += 1
        elif not predicted_present and example.expected_present:
            false_negative += 1

    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return ThresholdMetrics(
        threshold=threshold,
        true_positive=true_positive,
        false_positive=false_positive,
        false_negative=false_negative,
        precision=precision,
        recall=recall,
        f1=f1,
    )


def choose_threshold(
    examples: Iterable[DisclosureExample],
    disclosure_embeddings: dict[str, list[float]],
    candidates: Iterable[float],
) -> ThresholdMetrics:
    """Choose the candidate with the best F1 on labeled examples.

    F1 balances missed disclosures and false alarms. With few examples this is
    calibration evidence, not a statistically reliable production guarantee.
    """
    examples = list(examples)
    metrics = [
        evaluate_threshold(examples, disclosure_embeddings, threshold)
        for threshold in candidates
    ]
    if not metrics:
        raise ValueError("At least one threshold candidate is required")
    return max(metrics, key=lambda result: (result.f1, result.recall, -result.threshold))


async def evaluate_labeled_examples(
    session: AsyncSession,
    examples: Sequence[LabeledDisclosureExample],
    candidates: Iterable[float],
) -> ThresholdMetrics:
    """Embed labeled text, compare it with stored disclosure rules, and select F1."""
    if not examples:
        raise ValueError("At least one labeled example is required")

    rule_keys = {example.rule_key for example in examples}
    result = await session.execute(select(Rule).where(Rule.rule_key.in_(rule_keys)))
    rules = {rule.rule_key: rule for rule in result.scalars().all()}
    missing_rules = rule_keys - rules.keys()
    if missing_rules:
        raise ValueError(f"Disclosure rules not found: {sorted(missing_rules)}")

    vectors = embed_texts([example.text for example in examples])
    if len(vectors) != len(examples):
        raise ValueError("Embedding count does not match labeled example count")
    vector_examples = [
        DisclosureExample(example.rule_key, vector, example.expected_present)
        for example, vector in zip(examples, vectors)
    ]
    disclosure_embeddings = {
        rule_key: list(rule.embedding) for rule_key, rule in rules.items()
    }
    return choose_threshold(vector_examples, disclosure_embeddings, candidates)