"""add rule_key and lineage columns to rules

Revision ID: d4f19a02b6e1
Revises: bb703a78a45a

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4f19a02b6e1"
down_revision: Union[str, None] = "0b18da6ec898"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Added nullable first with a server_default so the migration is safe
    # to run against a table that may already have rows (none should yet,
    # but this is the correct pattern regardless), then we could tighten
    # to NOT NULL without a default in a later migration once backfilled.
    op.add_column(
        "rules",
        sa.Column("rule_key", sa.String(), nullable=False, server_default=sa.text("gen_random_uuid()::text")),
    )
    op.create_unique_constraint("uq_rules_rule_key", "rules", ["rule_key"])
    op.add_column("rules", sa.Column("source", sa.String(), nullable=False, server_default="synthetic-seed"))
    op.add_column("rules", sa.Column("corpus_version", sa.String(), nullable=False, server_default="v1"))
    op.add_column(
        "rules",
        sa.Column("embedding_model", sa.String(), nullable=False, server_default="BAAI/bge-base-en-v1.5"),
    )
    op.add_column(
        "rules",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.add_column(
        "rules",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_column("rules", "updated_at")
    op.drop_column("rules", "created_at")
    op.drop_column("rules", "embedding_model")
    op.drop_column("rules", "corpus_version")
    op.drop_column("rules", "source")
    op.drop_constraint("uq_rules_rule_key", "rules", type_="unique")
    op.drop_column("rules", "rule_key")