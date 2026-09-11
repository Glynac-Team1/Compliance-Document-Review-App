"""add claimed to auditaction enum

Revision ID: e4afc062d6c3
Revises: 9d4e6f2a8b1c
Create Date: 2026-09-09 04:45:00.767753

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4afc062d6c3'
down_revision: Union[str, None] = '9d4e6f2a8b1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'claimed'")


def downgrade() -> None:
    pass