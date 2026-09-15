"""create restaurant expenses

Revision ID: fd556354f5eb
Revises: d691624b3d09
Create Date: 2026-09-14
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "fd556354f5eb"
down_revision: str | None = "d691624b3d09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "expense_date",
            sa.Date(),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Numeric(12, 2),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "note",
            sa.Text(),
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
            name="fk_expenses_business_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_expenses_business_id",
        "expenses",
        ["business_id"],
    )

    op.create_index(
        "ix_expenses_expense_date",
        "expenses",
        ["expense_date"],
    )

    op.create_index(
        "ix_expenses_business_date",
        "expenses",
        ["business_id", "expense_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_expenses_business_date",
        table_name="expenses",
    )

    op.drop_index(
        "ix_expenses_expense_date",
        table_name="expenses",
    )

    op.drop_index(
        "ix_expenses_business_id",
        table_name="expenses",
    )

    op.drop_table("expenses")