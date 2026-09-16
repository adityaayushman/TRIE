"""add locations table and risk_events.location_id

Revision ID: d4b8e1f6a3c2
Revises: c7e2a4f9d1b6
Create Date: 2026-09-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Same correction as earlier migrations: ANSI form both SQLite and Postgres accept.
_CREATED_AT_DEFAULT = sa.text("CURRENT_TIMESTAMP")

# revision identifiers, used by Alembic.
revision: str = 'd4b8e1f6a3c2'
down_revision: Union[str, Sequence[str], None] = 'c7e2a4f9d1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'locations',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=_CREATED_AT_DEFAULT, nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.add_column('risk_events', sa.Column('location_id', sa.Uuid(), nullable=True))
    op.create_index(op.f('ix_risk_events_location_id'), 'risk_events', ['location_id'], unique=False)
    op.create_foreign_key(
        'fk_risk_events_location_id', 'risk_events', 'locations', ['location_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_risk_events_location_id', 'risk_events', type_='foreignkey')
    op.drop_index(op.f('ix_risk_events_location_id'), table_name='risk_events')
    op.drop_column('risk_events', 'location_id')
    op.drop_table('locations')
