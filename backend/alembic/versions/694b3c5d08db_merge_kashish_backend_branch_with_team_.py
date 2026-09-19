"""merge kashish backend branch with team migrations

Revision ID: 694b3c5d08db
Revises: 2ab93ffb5fc5, d35155d3eae6
Create Date: 2026-09-06 11:11:51.140461

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '694b3c5d08db'
down_revision: str | None = ('2ab93ffb5fc5', 'd35155d3eae6')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
