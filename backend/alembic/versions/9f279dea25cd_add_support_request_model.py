"""add support request model

Revision ID: 9f279dea25cd
Revises: a1b2c3d4e5f6
Create Date: 2026-09-19 12:05:03.397349

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9f279dea25cd'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('support_requests',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('advisor_id', sa.UUID(), nullable=False),
    sa.Column('workspace_id', sa.UUID(), nullable=True),
    sa.Column('subject', sa.String(), nullable=False),
    sa.Column('message', sa.String(), nullable=False),
    sa.Column('category', sa.Enum('general', 'document_review', 'technical_issue', name='supportcategory'), nullable=False),
    sa.Column('status', sa.Enum('submitted', 'in_progress', 'resolved', name='supportrequeststatus'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['advisor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('support_requests')
