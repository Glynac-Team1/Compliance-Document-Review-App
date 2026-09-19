"""merge vector indexes and workspace security migrations

Revision ID: a1b2c3d4e5f6
Revises: 7b2c4d6e8f10, f1a2b3c4d5e6
Create Date: 2026-09-18 17:58:00.000000

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = ("7b2c4d6e8f10", "f1a2b3c4d5e6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
