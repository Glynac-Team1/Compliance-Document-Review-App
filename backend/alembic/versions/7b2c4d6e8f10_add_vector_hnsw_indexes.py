"""add cosine HNSW indexes for rules and precedents

Revision ID: 7b2c4d6e8f10
Revises: f5a7c9e1d3b2
Create Date: 2026-09-12

"""
from typing import Sequence, Union

from alembic import op


revision: str = "7b2c4d6e8f10"
down_revision: Union[str, None] = "f5a7c9e1d3b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_rules_embedding_hnsw_cosine",
        "rules",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.create_index(
        "ix_precedents_embedding_hnsw_cosine",
        "precedents",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_precedents_embedding_hnsw_cosine", table_name="precedents")
    op.drop_index("ix_rules_embedding_hnsw_cosine", table_name="rules")