"""app-owned accounts for the cloud deployment: password hash, forced change, lockout

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("password_hash", sa.String(length=200), nullable=True))
        b.add_column(sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()))
        b.add_column(sa.Column("failed_logins", sa.Integer(), nullable=False, server_default="0"))
        b.add_column(sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as b:
        for c in ("locked_until", "failed_logins", "must_change_password", "password_hash"):
            b.drop_column(c)
