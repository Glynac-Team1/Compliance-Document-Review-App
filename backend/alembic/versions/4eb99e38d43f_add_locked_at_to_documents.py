"""add_locked_at_to_documents

Revision ID: 4eb99e38d43f
Revises: 9d4e6f2a8b1c
Create Date: 2026-09-10 21:23:55.625244

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4eb99e38d43f'
down_revision: Union[str, None] = '9d4e6f2a8b1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;")


def downgrade() -> None:
    op.drop_column("documents", "locked_at")
