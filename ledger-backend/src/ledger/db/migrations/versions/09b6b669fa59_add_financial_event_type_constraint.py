"""add financial event type constraint

Revision ID: 09b6b669fa59
Revises: df934d5daadc
Create Date: 2026-09-15 16:57:05.821311

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "09b6b669fa59"
down_revision: Union[str, Sequence[str], None] = "df934d5daadc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint(
        "ck_employee_financial_events_event_type",
        "employee_financial_events",
        """
        event_type IN (
            'advance',
            'overtime',
            'leave_no_salary',
            'payment',
            'debt_offset'
        )
        """,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "ck_employee_financial_events_event_type",
        "employee_financial_events",
        type_="check",
    )