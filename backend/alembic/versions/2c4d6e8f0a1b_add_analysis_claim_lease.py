"""add analysis claim lease

Revision ID: 2c4d6e8f0a1b
Revises: 9e7f6a1b2c3d
Create Date: 2026-09-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2c4d6e8f0a1b"
down_revision: Union[str, None] = "9e7f6a1b2c3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_analyses", sa.Column("claim_token", sa.String(), nullable=True))
    op.add_column(
        "ai_analyses",
        sa.Column("claim_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_ai_analyses_claim_token", "ai_analyses", ["claim_token"])


def downgrade() -> None:
    op.drop_index("ix_ai_analyses_claim_token", table_name="ai_analyses")
    op.drop_column("ai_analyses", "claim_expires_at")
    op.drop_column("ai_analyses", "claim_token")