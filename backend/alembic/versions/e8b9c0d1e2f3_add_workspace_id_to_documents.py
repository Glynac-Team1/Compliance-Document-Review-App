"""add_workspace_id_to_documents

Revision ID: e8b9c0d1e2f3
Revises: c7a8b9d0e1f2
Create Date: 2026-09-18 09:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'e8b9c0d1e2f3'
down_revision: Union[str, None] = 'c7a8b9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)")
    op.execute("UPDATE documents SET workspace_id = (SELECT id FROM workspaces WHERE slug = 'northstar' LIMIT 1) WHERE workspace_id IS NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_workspace_id ON documents (workspace_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_documents_workspace_id")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS workspace_id")
