"""update employee salary accounting

Revision ID: 3ef3e106396e
Revises: 850830ab3d57
Create Date: 2026-09-14 22:12:09.434378

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3ef3e106396e"
down_revision: Union[str, Sequence[str], None] = "850830ab3d57"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ------------------------------------------------------------------
    # 1. Rename the existing employee salary columns.
    #
    # This preserves all existing employee data, including Ahmad's
    # current RM100.00 salary and monthly payment method.
    # ------------------------------------------------------------------

    op.alter_column(
        "employees",
        "compensation_amount",
        new_column_name="daily_salary",
    )

    op.alter_column(
        "employees",
        "compensation_type",
        new_column_name="payment_method",
    )

    # ------------------------------------------------------------------
    # 2. Create salary history.
    #
    # This allows salary changes to take effect from a specific date
    # without changing historical salary calculations.
    # ------------------------------------------------------------------

    op.create_table(
        "employee_salary_history",
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
            "effective_from",
            sa.Date(),
            nullable=False,
        ),
        sa.Column(
            "daily_salary",
            sa.Numeric(12, 2),
            nullable=False,
        ),
        sa.Column(
            "payment_method",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "created_at",
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
            "effective_from",
            name="uq_employee_salary_history_employee_date",
        ),
    )

    # ------------------------------------------------------------------
    # 3. Indexes.
    # ------------------------------------------------------------------

    op.create_index(
        "ix_employee_salary_history_employee_id",
        "employee_salary_history",
        ["employee_id"],
        unique=False,
    )

    op.create_index(
        "ix_employee_salary_history_effective_from",
        "employee_salary_history",
        ["effective_from"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 4. Migrate existing employee salary information into history.
    #
    # Every existing employee gets a salary-history entry beginning
    # on their employee creation date.
    #
    # This preserves Ahmad:
    #
    #     daily_salary   = 100.00
    #     payment_method = monthly
    # ------------------------------------------------------------------

    op.execute(
        """
        INSERT INTO employee_salary_history (
            id,
            employee_id,
            effective_from,
            daily_salary,
            payment_method,
            created_at
        )
        SELECT
            gen_random_uuid(),
            id,
            created_at::date,
            daily_salary,
            payment_method,
            NOW()
        FROM employees
        """
    )


def downgrade() -> None:
    """Downgrade schema."""

    # Remove salary history first because it references employees.
    op.drop_index(
        "ix_employee_salary_history_effective_from",
        table_name="employee_salary_history",
    )

    op.drop_index(
        "ix_employee_salary_history_employee_id",
        table_name="employee_salary_history",
    )

    op.drop_table("employee_salary_history")

    # Restore the original column names.
    op.alter_column(
        "employees",
        "payment_method",
        new_column_name="compensation_type",
    )

    op.alter_column(
        "employees",
        "daily_salary",
        new_column_name="compensation_amount",
    )