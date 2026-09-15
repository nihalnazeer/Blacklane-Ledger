
"""add expense types and monthly report closing

Revision ID: df934d5daadc
Revises: 3ef3e106396e
Create Date: 2026-09-15 13:52:21.358159

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "df934d5daadc"
down_revision: Union[str, Sequence[str], None] = "3ef3e106396e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "monthly_report_closings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column(
            "bank_balance",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "closing_expense",
            sa.Numeric(precision=12, scale=2),
            nullable=False,
        ),
        sa.Column(
            "is_closed",
            sa.Boolean(),
            nullable=False,
        ),
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
            "year",
            "month",
            name="uq_monthly_report_closing_business_month",
        ),
    )

    op.create_index(
        op.f("ix_monthly_report_closings_business_id"),
        "monthly_report_closings",
        ["business_id"],
        unique=False,
    )

    # Existing expenses need a valid category.
    # All existing expenses are treated as general expenses.
    op.add_column(
        "expenses",
        sa.Column(
            "expense_type",
            sa.String(length=30),
            nullable=False,
            server_default="general",
        ),
    )

    # Remove the database-level default after existing rows
    # have been populated. New records get their value from
    # the application model/schema.
    op.alter_column(
        "expenses",
        "expense_type",
        server_default=None,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "expenses",
        "expense_type",
    )

    op.drop_index(
        op.f("ix_monthly_report_closings_business_id"),
        table_name="monthly_report_closings",
    )

    op.drop_table(
        "monthly_report_closings",
    )
