"""remove business slug add business type

Revision ID: 30ab4e740e66
Revises: 8aa12f088826
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "30ab4e740e66"
down_revision: str | None = "8aa12f088826"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column(
            "business_type",
            sa.String(length=50),
            nullable=False,
            server_default="restaurant",
        ),
    )

    op.alter_column(
        "businesses",
        "business_type",
        server_default=None,
    )

    op.drop_index(
        "ix_businesses_slug",
        table_name="businesses",
    )

    op.drop_column(
        "businesses",
        "slug",
    )


def downgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column(
            "slug",
            sa.String(length=200),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_businesses_slug",
        "businesses",
        ["slug"],
        unique=True,
    )

    op.drop_column(
        "businesses",
        "business_type",
    )