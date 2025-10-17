"""merge heads: bbc4f5258de3 and b1c2d3e4f5g6

Revision ID: merge_302c7ff1293d_b1c2d3e4f5g6
Revises: bbc4f5258de3, b1c2d3e4f5g6
Create Date: 2025-10-16 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'merge_302c7ff1293d_b1c2d3e4f5g6'
down_revision: Union[str, tuple[str, ...]] = ('bbc4f5258de3', 'b1c2d3e4f5g6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op merge migration: this revision ties two heads into one.
    pass


def downgrade() -> None:
    # Downgrading a merge revision would split history; keep as no-op.
    pass


