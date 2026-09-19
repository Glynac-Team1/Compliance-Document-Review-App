"""add claimed to auditaction enum

Revision ID: e4afc062d6c3
Revises: 9d4e6f2a8b1c
Create Date: 2026-09-09 04:45:00.767753

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e4afc062d6c3'
down_revision: str | None = '9d4e6f2a8b1c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'claimed'")


def downgrade() -> None:
    pass