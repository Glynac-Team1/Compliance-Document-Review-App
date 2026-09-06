"""add precedent key for seeded precedents

Revision ID: 8c2f4e1a7b9d
Revises: f7c3a91d0b2e
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c2f4e1a7b9d"
down_revision: Union[str, None] = "f7c3a91d0b2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("precedents", sa.Column("precedent_key", sa.String(), nullable=True))
    op.create_unique_constraint("uq_precedents_precedent_key", "precedents", ["precedent_key"])


def downgrade() -> None:
    op.drop_constraint("uq_precedents_precedent_key", "precedents", type_="unique")
    op.drop_column("precedents", "precedent_key")