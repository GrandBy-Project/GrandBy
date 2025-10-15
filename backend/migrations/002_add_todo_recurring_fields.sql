-- ====================================
-- TODO 테이블 확장: 카테고리 및 반복 일정 기능
-- 실행일: 2025-10-15
-- 작성자: TODO 기능 개발
-- ====================================

-- 실행 방법:
-- docker exec -i grandby_postgres psql -U grandby -d grandby_db < 002_add_todo_recurring_fields.sql

-- 1. category 컬럼 추가
ALTER TABLE todos ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- 2. 반복 일정 관련 컬럼 추가
ALTER TABLE todos ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurring_type VARCHAR(20);
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurring_interval INTEGER DEFAULT 1;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurring_days TEXT;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurring_day_of_month INTEGER;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurring_start_date DATE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurring_end_date DATE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS parent_recurring_id VARCHAR(36);

-- 완료 메시지
SELECT '✅ TODO 테이블 확장 완료' AS status;

