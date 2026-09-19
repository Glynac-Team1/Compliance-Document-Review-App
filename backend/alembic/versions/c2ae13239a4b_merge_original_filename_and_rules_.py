"""merge original_filename and rules lineage branches

Revision ID: c2ae13239a4b
Revises: 0b18da6ec898, d4f19a02b6e1
Create Date: 2026-09-02 23:20:10.929730

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = 'c2ae13239a4b'
down_revision: str | None = ('0b18da6ec898', 'd4f19a02b6e1')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
