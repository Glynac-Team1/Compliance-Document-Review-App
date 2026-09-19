"""add_workspaces_and_invitations

Revision ID: c7a8b9d0e1f2
Revises: 4eb99e38d43f
Create Date: 2026-09-17 18:20:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c7a8b9d0e1f2'
down_revision: str | None = '4eb99e38d43f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create workspaces table
    op.execute("""
    CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        slug VARCHAR UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Seed default 'Northstar Compliance' workspace dynamically
    op.execute("""
    INSERT INTO workspaces (id, name, slug)
    VALUES (gen_random_uuid(), 'Northstar Compliance', 'northstar')
    ON CONFLICT (slug) DO NOTHING
    """)

    # 3. Add workspace_id and is_admin columns to users
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("UPDATE users SET workspace_id = (SELECT id FROM workspaces WHERE slug = 'northstar' LIMIT 1) WHERE workspace_id IS NULL")

    # 4. Create invitationstatus enum and workspace_invitations table
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitationstatus') THEN
            CREATE TYPE invitationstatus AS ENUM ('pending', 'accepted', 'revoked');
        END IF;
    END$$;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS workspace_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id),
        email VARCHAR NOT NULL,
        role role NOT NULL,
        token VARCHAR UNIQUE NOT NULL,
        status invitationstatus NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_workspace_invitations_email ON workspace_invitations (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workspace_invitations_token ON workspace_invitations (token)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS workspace_invitations")
    op.execute("DROP TYPE IF EXISTS invitationstatus")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_admin")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS workspace_id")
    op.execute("DROP TABLE IF EXISTS workspaces")

