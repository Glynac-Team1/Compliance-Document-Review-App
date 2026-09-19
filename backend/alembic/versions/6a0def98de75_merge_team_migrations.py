"""Merge team migrations

Revision ID: 6a0def98de75
Revises: 0b18da6ec898, d4f19a02b6e1
Create Date: 2026-09-03 23:33:47.743193

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '6a0def98de75'
down_revision: str | None = ('0b18da6ec898', 'd4f19a02b6e1')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
