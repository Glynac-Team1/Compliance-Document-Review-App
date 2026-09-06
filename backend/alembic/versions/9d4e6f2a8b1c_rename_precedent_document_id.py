"""rename precedent source document column

Revision ID: 9d4e6f2a8b1c
Revises: 8c2f4e1a7b9d
"""
from typing import Sequence, Union

from alembic import op


revision: str = "9d4e6f2a8b1c"
down_revision: Union[str, None] = "8c2f4e1a7b9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("precedents", "document_id", new_column_name="source_document_id", nullable=True)


def downgrade() -> None:
    op.alter_column("precedents", "source_document_id", new_column_name="document_id", nullable=False)