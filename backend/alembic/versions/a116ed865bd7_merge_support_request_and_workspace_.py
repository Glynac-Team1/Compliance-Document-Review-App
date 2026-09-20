"""merge support request and workspace notifications migrations

Revision ID: a116ed865bd7
Revises: 9f279dea25cd, b2c3d4e5f6a7
Create Date: 2026-09-20 18:37:18.880279

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a116ed865bd7'
down_revision: Union[str, None] = ('9f279dea25cd', 'b2c3d4e5f6a7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
