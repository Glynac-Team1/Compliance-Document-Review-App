"""add_locked_at_to_documents

Revision ID: 4eb99e38d43f
Revises: 9d4e6f2a8b1c
Create Date: 2026-09-10 21:23:55.625244

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4eb99e38d43f'
down_revision: str | None = 'e4afc062d6c3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;")


def downgrade() -> None:
    op.drop_column("documents", "locked_at")
