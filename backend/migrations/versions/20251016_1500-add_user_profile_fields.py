"""Add user profile fields

Revision ID: b1c2d3e4f5g6
Revises: aec47b8e33b6
Create Date: 2025-10-16 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, None] = '302c7ff1293d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Gender enum 생성
    gender_enum = sa.Enum('MALE', 'FEMALE', name='gender')
    gender_enum.create(op.get_bind(), checkfirst=True)
    
    # users 테이블에 새 컬럼 추가
    op.add_column('users', sa.Column('birth_date', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('gender', gender_enum, nullable=True))
    op.add_column('users', sa.Column('profile_image_url', sa.String(length=500), nullable=True))
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # users 테이블에서 컬럼 제거
    op.drop_column('users', 'deleted_at')
    op.drop_column('users', 'profile_image_url')
    op.drop_column('users', 'gender')
    op.drop_column('users', 'birth_date')
    
    # Gender enum 제거
    gender_enum = sa.Enum('MALE', 'FEMALE', name='gender')
    gender_enum.drop(op.get_bind(), checkfirst=True)

