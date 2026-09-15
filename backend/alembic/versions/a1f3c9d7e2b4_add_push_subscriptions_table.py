"""add push_subscriptions table

Revision ID: a1f3c9d7e2b4
Revises: 11b0ace100c9
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Same correction as 11b0ace100c9: ANSI form both SQLite and Postgres accept.
_CREATED_AT_DEFAULT = sa.text("CURRENT_TIMESTAMP")

# revision identifiers, used by Alembic.
revision: str = 'a1f3c9d7e2b4'
down_revision: Union[str, Sequence[str], None] = '11b0ace100c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.String(length=255), nullable=False),
        sa.Column('auth', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=_CREATED_AT_DEFAULT, nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_push_subscriptions_user_id'), 'push_subscriptions', ['user_id'], unique=False)
    op.create_unique_constraint(
        'uq_push_subscription_user_endpoint', 'push_subscriptions', ['user_id', 'endpoint']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_push_subscription_user_endpoint', 'push_subscriptions', type_='unique')
    op.drop_index(op.f('ix_push_subscriptions_user_id'), table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
