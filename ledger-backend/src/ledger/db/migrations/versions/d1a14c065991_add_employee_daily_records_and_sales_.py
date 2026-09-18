"""add employee daily records and sales atm topup

Revision ID: <GENERATED_REVISION_ID>
Revises: 09b6b669fa59
Create Date: 2026-09-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d1a14c065991"
down_revision: str | None = "09b6b669fa59"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""

    # ------------------------------------------------------------------
    # 1. Add explicit employee accounting start date.
    #
    # Existing employees previously used created_at.date() as the
    # effective accounting start. Preserve that behavior when
    # introducing the new explicit field.
    # ------------------------------------------------------------------

    op.add_column(
        "employees",
        sa.Column(
            "accounting_start_date",
            sa.Date(),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE employees
        SET accounting_start_date = created_at::date
        WHERE accounting_start_date IS NULL
        """
    )

    op.alter_column(
        "employees",
        "accounting_start_date",
        nullable=False,
    )

    op.create_index(
        "ix_employees_accounting_start_date",
        "employees",
        ["accounting_start_date"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 2. Rename sales.bank_balance -> sales.atm_topup.
    #
    # IMPORTANT:
    # This is intentionally a rename rather than dropping the old
    # column and creating a new one. Existing sales data is therefore
    # preserved.
    # ------------------------------------------------------------------

    op.alter_column(
        "sales",
        "bank_balance",
        new_column_name="atm_topup",
    )

    # ------------------------------------------------------------------
    # 3. Create employee daily records.
    #
    # One employee can have:
    #
    #   - one day record   (7 AM -> 7 PM)
    #   - one night record (7 PM -> 7 AM)
    #
    # for the same accounting date.
    #
    # The unique constraint prevents duplicate records for the same
    # employee/date/shift.
    # ------------------------------------------------------------------

    op.create_table(
        "employee_daily_records",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "employee_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "record_date",
            sa.Date(),
            nullable=False,
        ),
        sa.Column(
            "shift",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "salary_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0.00"),
        ),
        sa.Column(
            "overtime",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0.00"),
        ),
        sa.Column(
            "salary_cut",
            sa.Numeric(12, 2),
            nullable=False,
            server_default=sa.text("0.00"),
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
            ["employee_id"],
            ["employees.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "employee_id",
            "record_date",
            "shift",
            name="uq_employee_daily_records_employee_date_shift",
        ),
    )

    op.create_index(
        "ix_employee_daily_records_employee_id",
        "employee_daily_records",
        ["employee_id"],
        unique=False,
    )

    op.create_index(
        "ix_employee_daily_records_record_date",
        "employee_daily_records",
        ["record_date"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    # ------------------------------------------------------------------
    # 1. Remove employee daily records.
    # ------------------------------------------------------------------

    op.drop_index(
        "ix_employee_daily_records_record_date",
        table_name="employee_daily_records",
    )

    op.drop_index(
        "ix_employee_daily_records_employee_id",
        table_name="employee_daily_records",
    )

    op.drop_table("employee_daily_records")

    # ------------------------------------------------------------------
    # 2. Restore the original sales column name.
    # ------------------------------------------------------------------

    op.alter_column(
        "sales",
        "atm_topup",
        new_column_name="bank_balance",
    )

    # ------------------------------------------------------------------
    # 3. Remove explicit employee accounting start date.
    # ------------------------------------------------------------------

    op.drop_index(
        "ix_employees_accounting_start_date",
        table_name="employees",
    )

    op.drop_column(
        "employees",
        "accounting_start_date",
    )