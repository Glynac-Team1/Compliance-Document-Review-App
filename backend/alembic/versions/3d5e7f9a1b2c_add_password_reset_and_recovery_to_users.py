"""add password reset and recovery to users

Revision ID: 3d5e7f9a1b2c
Revises: 2c4d6e8f0a1b
Create Date: 2026-09-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3d5e7f9a1b2c"
down_revision: Union[str, None] = "2c4d6e8f0a1b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("reset_token", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("recovery_key_hash", sa.String(), nullable=True))
    op.create_index("ix_users_reset_token", "users", ["reset_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_reset_token", table_name="users")
    op.drop_column("users", "recovery_key_hash")
    op.drop_column("users", "reset_token_expires_at")
    op.drop_column("users", "reset_token")
