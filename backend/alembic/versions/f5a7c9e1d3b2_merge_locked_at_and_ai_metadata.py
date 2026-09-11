"""merge locked_at and AI metadata migrations

Revision ID: f5a7c9e1d3b2
Revises: 4eb99e38d43f, d4285f7785dc
Create Date: 2026-09-11

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f5a7c9e1d3b2"
down_revision: Union[str, None] = ("4eb99e38d43f", "d4285f7785dc")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass