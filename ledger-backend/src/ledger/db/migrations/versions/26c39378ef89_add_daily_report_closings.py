"""add daily report closings

Revision ID: 26c39378ef89
Revises: d1a14c065991
Create Date: 2026-09-18 18:35:40.602258

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "26c39378ef89"
down_revision: Union[str, Sequence[str], None] = "d1a14c065991"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "daily_report_closings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column(
            "accounting_fingerprint",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_closed", sa.Boolean(), nullable=False),
        sa.Column(
            "closed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["business_id"],
            ["businesses.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "business_id",
            "report_date",
            name="uq_daily_report_closing_business_date",
        ),
    )

    op.create_index(
        op.f("ix_daily_report_closings_business_id"),
        "daily_report_closings",
        ["business_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_daily_report_closings_report_date"),
        "daily_report_closings",
        ["report_date"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_daily_report_closings_report_date"),
        table_name="daily_report_closings",
    )

    op.drop_index(
        op.f("ix_daily_report_closings_business_id"),
        table_name="daily_report_closings",
    )

    op.drop_table("daily_report_closings")