"""add precedents table

Revision ID: f7c3a91d0b2e
Revises: 694b3c5d08db
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "f7c3a91d0b2e"
down_revision: Union[str, None] = "694b3c5d08db"  
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        "precedents",
        sa.Column(
            "source",
            sa.String(),
            nullable=False,
            server_default="synthetic-seed",
        ),
    )

    op.add_column(
        "precedents",
        sa.Column(
            "embedding_model",
            sa.String(),
            nullable=False,
            server_default="BAAI/bge-base-en-v1.5",
        ),
    )

    op.add_column(
        "precedents",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_column("precedents", "created_at")
    op.drop_column("precedents", "embedding_model")
    op.drop_column("precedents", "source")