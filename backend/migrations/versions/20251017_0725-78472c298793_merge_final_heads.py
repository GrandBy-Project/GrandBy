"""merge final heads

Revision ID: 78472c298793
Revises: 302c7ff1293d, merge_302c7ff1293d_b1c2d3e4f5g6
Create Date: 2025-10-17 07:25:26.198401

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '78472c298793'
down_revision: Union[str, None] = ('302c7ff1293d', 'merge_302c7ff1293d_b1c2d3e4f5g6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

