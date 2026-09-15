"""add role to users

Revision ID: c7e2a4f9d1b6
Revises: a1f3c9d7e2b4
Create Date: 2026-09-16 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c7e2a4f9d1b6'
down_revision: Union[str, Sequence[str], None] = 'a1f3c9d7e2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=16), nullable=False, server_default='operator'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'role')
