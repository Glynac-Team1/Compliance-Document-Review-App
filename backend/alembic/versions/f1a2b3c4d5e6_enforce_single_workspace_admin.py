"""enforce_single_workspace_admin

Revision ID: f1a2b3c4d5e6
Revises: e8b9c0d1e2f3
Create Date: 2026-09-18 13:30:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: str | None = 'e8b9c0d1e2f3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Sanitize existing data: Advisors can NEVER be administrators
    op.execute("UPDATE users SET is_admin = FALSE WHERE role = 'advisor' AND is_admin = TRUE")

    # 2. Sanitize existing data: For any workspace with multiple administrators, keep only the earliest created officer
    op.execute("""
    WITH ranked_admins AS (
        SELECT id, workspace_id,
               ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at ASC) as rn
        FROM users
        WHERE is_admin = TRUE AND workspace_id IS NOT NULL
    )
    UPDATE users
    SET is_admin = FALSE
    WHERE id IN (
        SELECT id FROM ranked_admins WHERE rn > 1
    )
    """)

    # 3. Create partial unique index guaranteeing at most ONE admin per workspace
    op.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_single_admin
    ON users (workspace_id)
    WHERE (is_admin = TRUE);
    """)

    # 4. Create check constraint guaranteeing advisors cannot be administrators
    op.execute("""
    ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_admin_must_be_officer;
    """)
    op.execute("""
    ALTER TABLE users
    ADD CONSTRAINT chk_admin_must_be_officer
    CHECK (is_admin = FALSE OR role = 'officer');
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_admin_must_be_officer")
    op.execute("DROP INDEX IF EXISTS uq_workspace_single_admin")
