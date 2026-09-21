"""add structured analysis error fields

Revision ID: 9e7f6a1b2c3d
Revises: a116ed865bd7
Create Date: 2026-09-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9e7f6a1b2c3d"
down_revision: Union[str, None] = "a116ed865bd7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_analyses", sa.Column("error_code", sa.String(), nullable=True))
    op.add_column("ai_analyses", sa.Column("user_facing_error", sa.String(), nullable=True))
    op.add_column("ai_analyses", sa.Column("technical_error", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_analyses", "technical_error")
    op.drop_column("ai_analyses", "user_facing_error")
    op.drop_column("ai_analyses", "error_code")