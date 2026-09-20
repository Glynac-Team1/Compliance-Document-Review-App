"""add workspace_id to notifications

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-20

"""
from typing import Sequence, Union

from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE notifications "
        "ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)"
    )
    op.execute(
        "UPDATE notifications AS notifications "
        "SET workspace_id = documents.workspace_id "
        "FROM documents "
        "WHERE notifications.document_id = documents.id "
        "AND notifications.workspace_id IS NULL "
        "AND documents.workspace_id IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_notifications_workspace_id "
        "ON notifications (workspace_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_notifications_workspace_id")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS workspace_id")
