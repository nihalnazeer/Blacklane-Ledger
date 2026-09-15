"""create restaurant sales

Revision ID: d691624b3d09
Revises: 30ab4e740e66
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "d691624b3d09"
down_revision: str | None = "30ab4e740e66"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sales",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "business_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "sale_date",
            sa.Date(),
            nullable=False,
        ),
        sa.Column(
            "cash_income",
            sa.Numeric(12, 2),
            nullable=False,
        ),
        sa.Column(
            "bank_balance",
            sa.Numeric(12, 2),
            nullable=False,
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
            "sale_date",
            name="uq_sales_business_date",
        ),
    )

    op.create_index(
        "ix_sales_business_id",
        "sales",
        ["business_id"],
        unique=False,
    )

    op.create_index(
        "ix_sales_sale_date",
        "sales",
        ["sale_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sales_sale_date",
        table_name="sales",
    )

    op.drop_index(
        "ix_sales_business_id",
        table_name="sales",
    )

    op.drop_table("sales")