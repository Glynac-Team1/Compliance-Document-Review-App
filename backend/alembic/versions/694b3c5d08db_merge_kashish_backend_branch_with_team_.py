"""merge kashish backend branch with team migrations

Revision ID: 694b3c5d08db
Revises: 2ab93ffb5fc5, d35155d3eae6
Create Date: 2026-09-06 11:11:51.140461

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '694b3c5d08db'
down_revision: Union[str, None] = ('2ab93ffb5fc5', 'd35155d3eae6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
